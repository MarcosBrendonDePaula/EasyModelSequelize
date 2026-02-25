import type { SchemaModel, SchemaField, GeneratedFile, GeneratorResult, MigrationEntry, MigrationOp } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'
import { type SequelizeDialect, DIALECT_CONFIGS } from './sequelize.generator'

export class SequelizeTSGenerator implements CodeGenerator {
  readonly metadata: GeneratorMetadata
  private readonly dialect: SequelizeDialect
  private readonly dialectCfg: (typeof DIALECT_CONFIGS)[SequelizeDialect]

  constructor(dialect: SequelizeDialect = 'postgres') {
    this.dialect = dialect
    this.dialectCfg = DIALECT_CONFIGS[dialect]
    this.metadata = {
      id: dialect === 'postgres' ? 'sequelize-ts' : `sequelize-ts-${dialect}`,
      name: `Sequelize TS (${this.dialectCfg.name})`,
      description: `Sequelize v6 TypeScript project with typed models, migrations, and ${this.dialectCfg.name} config`,
      language: 'typescript',
      framework: 'Sequelize',
      category: 'Sequelize',
      dialect: this.dialectCfg.name,
    }
  }

  // ════════════════════════════════════════════════════════════
  //  Public API
  // ════════════════════════════════════════════════════════════

  generate(models: SchemaModel[], migrations?: MigrationEntry[]): GeneratorResult {
    const files: GeneratedFile[] = []
    const errors: string[] = []

    // ── Models ───────────────────────────────────────────────
    for (const model of models) {
      try {
        files.push({
          path: `src/models/${this.safeName(model.name)}.ts`,
          content: this.genModel(model, models),
          language: 'typescript'
        })
      } catch (err: any) {
        errors.push(`Model "${model.name}": ${err.message}`)
      }
    }

    // src/models/index.ts — typed auto-loader + association setup
    files.push({
      path: 'src/models/index.ts',
      content: this.genModelsIndex(models),
      language: 'typescript'
    })

    // ── Migrations ───────────────────────────────────────────
    if (migrations && migrations.length > 0) {
      const migrationFiles = this.genIncrementalMigrations(migrations)
      files.push(...migrationFiles)
    } else {
      const sortedModels = this.topologicalSort(models)
      for (let i = 0; i < sortedModels.length; i++) {
        const model = sortedModels[i]
        try {
          const seq = String(i + 1).padStart(3, '0')
          const ts = `20250101000${seq}`
          files.push({
            path: `src/migrations/${ts}-create-${this.toSnakeCase(model.name)}.ts`,
            content: this.genMigration(model, models),
            language: 'typescript'
          })
        } catch (err: any) {
          errors.push(`Migration "${model.name}": ${err.message}`)
        }
      }
    }

    // ── Seeders stub ─────────────────────────────────────────
    files.push({ path: 'src/seeders/.gitkeep', content: '', language: 'text' })

    // ── Config & scaffolding ─────────────────────────────────
    files.push({ path: 'src/config/database.ts', content: this.genDatabaseConfig(), language: 'typescript' })
    files.push({ path: '.sequelizerc', content: this.genSequelizeRc(), language: 'javascript' })
    files.push({ path: '.env.example', content: this.genEnvExample(), language: 'text' })
    files.push({ path: 'tsconfig.json', content: this.genTsConfig(), language: 'json' })
    files.push({ path: 'package.json', content: this.genPackageJson(), language: 'json' })

    // ── Schema backup ────────────────────────────────────────
    files.push({ path: 'db.json', content: JSON.stringify(models, null, 2), language: 'json' })

    return { generatorId: this.metadata.id, generatorName: this.metadata.name, files, errors }
  }

  previewModel(model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[] {
    return [{
      path: `src/models/${this.safeName(model.name)}.ts`,
      content: this.genModel(model, allModels),
      language: 'typescript'
    }]
  }

  // ════════════════════════════════════════════════════════════
  //  Model — class-based with typed attributes + CreationAttributes
  // ════════════════════════════════════════════════════════════

  private genModel(model: SchemaModel, allModels: SchemaModel[]): string {
    const name = this.safeName(model.name)
    const table = this.toSnakeCase(name)

    // Build TypeScript interface for attributes
    const attrLines = model.fields.map(f => {
      const optional = f.properties.allowNull || f.properties.autoIncrement || !!f.properties.defaultValue
      return `  ${f.name}${optional ? '?' : ''}: ${this.mapTsType(f)};`
    })

    // FK attributes from incoming associations (belongsTo)
    const fkAttrs: string[] = []
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        if (assoc.type === 'M:N') continue
        const fkName = this.fkCamel(other.name)
        if (!model.fields.some(f => f.name === fkName)) {
          fkAttrs.push(`  ${fkName}?: number;`)
        }
      }
    }

    // Creation attributes — optional fields
    const creationOptional = model.fields
      .filter(f => f.properties.allowNull || f.properties.autoIncrement || !!f.properties.defaultValue)
      .map(f => `'${f.name}'`)
    const fkOptionalNames = fkAttrs.map(l => {
      const match = l.match(/^\s+(\w+)\??:/)
      return match ? `'${match[1]}'` : ''
    }).filter(Boolean)
    const allOptional = [...creationOptional, ...fkOptionalNames]

    const creationType = allOptional.length > 0
      ? `Optional<${name}Attributes, ${allOptional.join(' | ')}>`
      : `${name}Attributes`

    // Build field definitions for Model.init()
    const fieldDefLines = model.fields.map(f => this.buildField(f))

    // Add FK fields to Model.init() for belongsTo side
    const fkFieldDefs = this.buildModelFKFields(model, allModels)
    const fieldDefs = [...fieldDefLines, ...fkFieldDefs].join(',\n')

    // Build association method
    const assocLines = this.buildAssociateFn(model, allModels)

    // Imports for associations
    const assocImports = this.getAssocImports(model, allModels)
    const assocImportLines = assocImports.length > 0
      ? assocImports.map(n => `import type { ${n} } from './${n}';`).join('\n') + '\n'
      : ''

    return `import {
  Model,
  DataTypes,
  type Sequelize,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type Optional,
} from 'sequelize';
${assocImportLines}
// ── Attributes ────────────────────────────────────────────

export interface ${name}Attributes {
${attrLines.join('\n')}
${fkAttrs.join('\n')}
}

export type ${name}CreationAttributes = ${creationType};

// ── Model ─────────────────────────────────────────────────

export class ${name} extends Model<${name}Attributes, ${name}CreationAttributes> implements ${name}Attributes {
${model.fields.map(f => {
  const optional = f.properties.allowNull || f.properties.autoIncrement || !!f.properties.defaultValue
  return `  declare ${f.name}${optional ? '?' : ''}: ${this.mapTsType(f)};`
}).join('\n')}
${fkAttrs.map(l => `  declare ${l.trim().replace(/;$/, '').replace(/\??:/, '?:')};`).join('\n')}

  // Timestamps
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: Record<string, any>): void {
${assocLines || '    // No associations'}
  }

  static initModel(sequelize: Sequelize): typeof ${name} {
    ${name}.init(
      {
${fieldDefs}
      },
      {
        sequelize,
        modelName: '${name}',
        tableName: '${table}',
        underscored: true,
        timestamps: true,
        paranoid: false,
      },
    );
    return ${name};
  }
}

export default ${name};
`
  }

  private buildField(field: SchemaField): string {
    const I = '        '
    const lines: string[] = []

    if (field.type === 'ENUM' && field.properties.enumValues?.length) {
      lines.push(`${I}type: DataTypes.ENUM(${field.properties.enumValues.map(v => `'${v}'`).join(', ')})`)
    } else if (field.type === 'ARRAY') {
      if (this.dialect === 'postgres') {
        lines.push(`${I}type: DataTypes.ARRAY(DataTypes.TEXT)`)
      } else {
        lines.push(`${I}type: DataTypes.JSON`)
      }
    } else if (field.type === 'DECIMAL' && (field.properties.precision > 0 || field.properties.scale > 0)) {
      const p = field.properties.precision || 10
      const s = field.properties.scale || 2
      lines.push(`${I}type: DataTypes.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'MONEY') {
      const p = field.properties.precision || 19
      const s = field.properties.scale || 4
      lines.push(`${I}type: DataTypes.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'RANGE') {
      if (this.dialect === 'postgres') {
        lines.push(`${I}type: DataTypes.RANGE(DataTypes.INTEGER)`)
      } else {
        lines.push(`${I}type: DataTypes.JSON`)
      }
    } else if (field.type === 'VIRTUAL') {
      lines.push(`${I}type: DataTypes.VIRTUAL`)
    } else if ((field.type === 'STRING' || field.type === 'CHAR') && field.properties.length > 0) {
      lines.push(`${I}type: DataTypes.${field.type}(${field.properties.length})`)
    } else {
      lines.push(`${I}type: DataTypes.${field.type}`)
    }

    if (field.properties.primaryKey) lines.push(`${I}primaryKey: true`)
    if (field.properties.autoIncrement) lines.push(`${I}autoIncrement: true`)
    if (field.properties.unique && !field.properties.primaryKey) lines.push(`${I}unique: true`)

    lines.push(`${I}allowNull: ${field.properties.allowNull}`)

    const validates = this.buildValidate(field)
    if (validates) lines.push(validates)

    if (field.properties.defaultValue) {
      lines.push(`${I}defaultValue: ${this.formatDefault(field)}`)
    }

    const colName = this.toSnakeCase(field.name)
    const fieldAttr = colName !== field.name ? `\n${I}field: '${colName}',` : ''

    return `      ${field.name}: {${fieldAttr}\n${lines.join(',\n')},\n      }`
  }

  private buildValidate(field: SchemaField): string | null {
    const I = '        '
    const rules: string[] = []

    if (!field.properties.allowNull && !field.properties.primaryKey) {
      rules.push(`          notNull: { msg: '${field.name} is required' }`)
      if (['STRING', 'TEXT', 'CHAR'].includes(field.type)) {
        rules.push(`          notEmpty: { msg: '${field.name} cannot be empty' }`)
      }
    }
    if (field.type === 'UUID') rules.push(`          isUUID: 4`)
    if (['FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(field.type)) rules.push(`          isDecimal: true`)
    if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT'].includes(field.type) && !field.properties.primaryKey) rules.push(`          isInt: true`)

    if (rules.length === 0) return null
    return `${I}validate: {\n${rules.join(',\n')},\n${I}}`
  }

  /** FK fields injected into Model.init() for the belongsTo side */
  private buildModelFKFields(model: SchemaModel, allModels: SchemaModel[]): string[] {
    const fks: string[] = []
    const seen = new Set<string>()

    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        if (assoc.type === 'M:N') continue

        const fkName = this.fk(other.name)
        if (seen.has(fkName)) continue
        if (model.fields.some(f => f.name === fkName)) continue
        seen.add(fkName)

        const I = '        '
        const refTable = this.toSnakeCase(other.name)
        const lines = [
          `${I}type: DataTypes.INTEGER`,
          `${I}allowNull: true`,
          `${I}references: {\n${I}  model: '${refTable}',\n${I}  key: 'id',\n${I}}`,
          `${I}onUpdate: 'CASCADE'`,
          `${I}onDelete: '${assoc.type === '1:1' ? 'SET NULL' : 'CASCADE'}'`,
        ]
        fks.push(`      ${fkName}: {\n${lines.join(',\n')},\n      }`)
      }
    }

    return fks
  }

  // ════════════════════════════════════════════════════════════
  //  Associations
  // ════════════════════════════════════════════════════════════

  private buildAssociateFn(model: SchemaModel, allModels: SchemaModel[]): string {
    const lines: string[] = []
    const src = this.safeName(model.name)

    for (const assoc of model.associations) {
      const target = allModels.find(m => m.id === assoc.targetModelId)
      if (!target) continue
      const tgt = this.safeName(target.name)
      const alias = assoc.alias
      const aliasOpt = alias ? `, as: '${alias}'` : ''

      switch (assoc.type) {
        case '1:1':
          lines.push(`    ${src}.hasOne(models.${tgt}, { foreignKey: '${this.fk(model.name)}'${aliasOpt}, onDelete: 'SET NULL', onUpdate: 'CASCADE' });`)
          break
        case '1:M':
          lines.push(`    ${src}.hasMany(models.${tgt}, { foreignKey: '${this.fk(model.name)}'${aliasOpt}, onDelete: 'CASCADE', onUpdate: 'CASCADE' });`)
          break
        case 'M:N': {
          const through = assoc.through || `${this.toSnakeCase(src)}_${this.toSnakeCase(tgt)}`
          lines.push(`    ${src}.belongsToMany(models.${tgt}, { through: '${through}', foreignKey: '${this.fk(model.name)}', otherKey: '${this.fk(target.name)}'${aliasOpt}, onDelete: 'CASCADE' });`)
          break
        }
      }
    }

    // Inverse belongsTo
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        const otherName = this.safeName(other.name)
        if (assoc.type === '1:1' || assoc.type === '1:M') {
          lines.push(`    ${src}.belongsTo(models.${otherName}, { foreignKey: '${this.fk(other.name)}', onDelete: 'CASCADE', onUpdate: 'CASCADE' });`)
        }
      }
    }

    return [...new Set(lines)].join('\n')
  }

  private getAssocImports(model: SchemaModel, allModels: SchemaModel[]): string[] {
    const names = new Set<string>()
    for (const assoc of model.associations) {
      const t = allModels.find(m => m.id === assoc.targetModelId)
      if (t) names.add(this.safeName(t.name))
    }
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId === model.id && (assoc.type === '1:1' || assoc.type === '1:M')) {
          names.add(this.safeName(other.name))
        }
      }
    }
    return [...names]
  }

  // ════════════════════════════════════════════════════════════
  //  models/index.ts — typed loader + associate
  // ════════════════════════════════════════════════════════════

  private genModelsIndex(models: SchemaModel[]): string {
    const imports = models.map(m => {
      const name = this.safeName(m.name)
      return `import { ${name} } from './${name}';`
    }).join('\n')

    const initCalls = models.map(m => {
      const name = this.safeName(m.name)
      return `  ${name}.initModel(sequelize);`
    }).join('\n')

    const assocCalls = models.map(m => {
      const name = this.safeName(m.name)
      return `  ${name}.associate(db);`
    }).join('\n')

    const dbEntries = models.map(m => {
      const name = this.safeName(m.name)
      return `  ${name}`
    }).join(',\n')

    const reExports = models.map(m => {
      const name = this.safeName(m.name)
      return `export { ${name} } from './${name}';`
    }).join('\n')

    return `import { Sequelize } from 'sequelize';
import config from '../config/database';
${imports}

const env = (process.env.NODE_ENV || 'development') as keyof typeof config;
const dbConfig = config[env];

let sequelize: Sequelize;
if ('use_env_variable' in dbConfig && dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable]!, dbConfig);
} else {
  sequelize = new Sequelize(
    dbConfig.database!,
    dbConfig.username!,
    dbConfig.password ?? undefined,
    dbConfig,
  );
}

// Initialize models
${initCalls}

// Build db object for associations
const db = {
${dbEntries},
};

// Set up associations
${assocCalls}

export { sequelize, Sequelize };
export default db;
${reExports}
`
  }

  // ════════════════════════════════════════════════════════════
  //  Migration — queryInterface.createTable / dropTable (TS)
  // ════════════════════════════════════════════════════════════

  private genMigration(model: SchemaModel, allModels: SchemaModel[]): string {
    const table = this.toSnakeCase(model.name)
    const colLines: string[] = []

    for (const field of model.fields) {
      if (field.type === 'VIRTUAL') continue
      colLines.push(this.buildMigrationColumn(field))
    }

    const incomingFKs = this.getIncomingFKs(model, allModels)
    for (const fkCol of incomingFKs) colLines.push(fkCol)

    colLines.push(`      created_at: {\n        type: Sequelize.DATE,\n        allowNull: false,\n        defaultValue: Sequelize.literal('NOW()'),\n      }`)
    colLines.push(`      updated_at: {\n        type: Sequelize.DATE,\n        allowNull: false,\n        defaultValue: Sequelize.literal('NOW()'),\n      }`)

    return `import type { QueryInterface } from 'sequelize';
import { Sequelize } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable('${table}', {
${colLines.join(',\n')}
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable('${table}');
  },
};
`
  }

  private buildMigrationColumn(field: SchemaField): string {
    if (field.type === 'VIRTUAL') return ''
    const I = '        '
    const col = this.toSnakeCase(field.name)
    const lines: string[] = []

    if (field.type === 'ENUM' && field.properties.enumValues?.length) {
      lines.push(`${I}type: Sequelize.ENUM(${field.properties.enumValues.map(v => `'${v}'`).join(', ')})`)
    } else if (field.type === 'ARRAY') {
      if (this.dialect === 'postgres') {
        lines.push(`${I}type: Sequelize.ARRAY(Sequelize.TEXT)`)
      } else {
        lines.push(`${I}type: Sequelize.JSON`)
      }
    } else if (field.type === 'DECIMAL' && (field.properties.precision > 0 || field.properties.scale > 0)) {
      const p = field.properties.precision || 10
      const s = field.properties.scale || 2
      lines.push(`${I}type: Sequelize.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'MONEY') {
      const p = field.properties.precision || 19
      const s = field.properties.scale || 4
      lines.push(`${I}type: Sequelize.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'RANGE') {
      if (this.dialect === 'postgres') {
        lines.push(`${I}type: Sequelize.RANGE(Sequelize.INTEGER)`)
      } else {
        lines.push(`${I}type: Sequelize.JSON`)
      }
    } else if ((field.type === 'STRING' || field.type === 'CHAR') && field.properties.length > 0) {
      lines.push(`${I}type: Sequelize.${field.type}(${field.properties.length})`)
    } else {
      lines.push(`${I}type: Sequelize.${field.type}`)
    }
    if (field.properties.primaryKey) lines.push(`${I}primaryKey: true`)
    if (field.properties.autoIncrement) lines.push(`${I}autoIncrement: true`)
    if (field.properties.unique && !field.properties.primaryKey) lines.push(`${I}unique: true`)
    lines.push(`${I}allowNull: ${field.properties.allowNull}`)
    if (field.properties.defaultValue) lines.push(`${I}defaultValue: ${this.formatDefault(field)}`)

    return `      ${col}: {\n${lines.join(',\n')},\n      }`
  }

  private getIncomingFKs(model: SchemaModel, allModels: SchemaModel[]): string[] {
    const fks: string[] = []
    const seen = new Set<string>()

    for (const other of allModels) {
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        if (assoc.type === 'M:N') continue

        const colName = this.toSnakeCase(this.fk(other.name))
        if (seen.has(colName)) continue
        seen.add(colName)

        const refTable = this.toSnakeCase(other.name)
        const I = '        '
        const lines = [
          `${I}type: Sequelize.INTEGER`,
          `${I}allowNull: true`,
          `${I}references: {\n${I}  model: '${refTable}',\n${I}  key: 'id',\n${I}}`,
          `${I}onUpdate: 'CASCADE'`,
          `${I}onDelete: '${assoc.type === '1:1' ? 'SET NULL' : 'CASCADE'}'`,
        ]
        fks.push(`      ${colName}: {\n${lines.join(',\n')},\n      }`)
      }
    }

    return fks
  }

  // ════════════════════════════════════════════════════════════
  //  Incremental migrations — from MigrationEntry history (TS)
  // ════════════════════════════════════════════════════════════

  private genIncrementalMigrations(migrations: MigrationEntry[]): GeneratedFile[] {
    const files: GeneratedFile[] = []

    for (let i = 0; i < migrations.length; i++) {
      const entry = migrations[i]
      const ts = this.migrationTimestamp(entry.timestamp, i)
      const slug = this.slugify(entry.description)

      files.push({
        path: `src/migrations/${ts}-${slug}.ts`,
        content: this.genMigrationFromOps(entry.ops),
        language: 'typescript'
      })
    }

    return files
  }

  private genMigrationFromOps(ops: MigrationOp[]): string {
    const upLines: string[] = []
    const downLines: string[] = []

    for (const op of ops) {
      switch (op.type) {
        case 'createTable': {
          const cols = ops.filter(o => o.type === 'addColumn' && o.table === op.table && o.field && o.field.type !== 'VIRTUAL')
          const colDefs = cols.map(c => this.buildMigrationColumnFromField(c.field!)).join(',\n')
          const timestamps = [
            `      created_at: {\n        type: Sequelize.DATE,\n        allowNull: false,\n        defaultValue: Sequelize.literal('NOW()'),\n      }`,
            `      updated_at: {\n        type: Sequelize.DATE,\n        allowNull: false,\n        defaultValue: Sequelize.literal('NOW()'),\n      }`
          ].join(',\n')
          const allCols = colDefs ? `${colDefs},\n${timestamps}` : timestamps

          upLines.push(`    await queryInterface.createTable('${op.table}', {\n${allCols}\n    });`)
          downLines.unshift(`    await queryInterface.dropTable('${op.table}');`)
          break
        }
        case 'dropTable':
          upLines.push(`    await queryInterface.dropTable('${op.table}');`)
          downLines.unshift(`    // TODO: Recreate table '${op.table}' if needed`)
          break
        case 'renameTable':
          upLines.push(`    await queryInterface.renameTable('${op.previousName}', '${op.table}');`)
          downLines.unshift(`    await queryInterface.renameTable('${op.table}', '${op.previousName}');`)
          break
        case 'addColumn': {
          const hasCreateTable = ops.some(o => o.type === 'createTable' && o.table === op.table)
          if (hasCreateTable) break
          if (op.field?.type === 'VIRTUAL') break
          if (op.field) {
            const colDef = this.buildMigrationColumnInline(op.field)
            upLines.push(`    await queryInterface.addColumn('${op.table}', '${op.column}', ${colDef});`)
            downLines.unshift(`    await queryInterface.removeColumn('${op.table}', '${op.column}');`)
          } else if (op.reference) {
            const refDef = [
              `      type: Sequelize.INTEGER`,
              `      allowNull: true`,
              `      references: {\n        model: '${op.reference.model}',\n        key: '${op.reference.key}',\n      }`,
              `      onUpdate: '${op.reference.onUpdate || 'CASCADE'}'`,
              `      onDelete: '${op.reference.onDelete || 'CASCADE'}'`,
            ].join(',\n')
            upLines.push(`    await queryInterface.addColumn('${op.table}', '${op.column}', {\n${refDef},\n    });`)
            downLines.unshift(`    await queryInterface.removeColumn('${op.table}', '${op.column}');`)
          }
          break
        }
        case 'removeColumn':
          upLines.push(`    await queryInterface.removeColumn('${op.table}', '${op.column}');`)
          if (op.previousField) {
            const colDef = this.buildMigrationColumnInline(op.previousField)
            downLines.unshift(`    await queryInterface.addColumn('${op.table}', '${op.column}', ${colDef});`)
          } else {
            downLines.unshift(`    // TODO: Re-add column '${op.column}' to '${op.table}' if needed`)
          }
          break
        case 'changeColumn':
          if (op.field?.type === 'VIRTUAL') break
          if (op.field) {
            const colDef = this.buildMigrationColumnInline(op.field)
            upLines.push(`    await queryInterface.changeColumn('${op.table}', '${op.column}', ${colDef});`)
          }
          if (op.previousField) {
            const prevDef = this.buildMigrationColumnInline(op.previousField)
            downLines.unshift(`    await queryInterface.changeColumn('${op.table}', '${op.column}', ${prevDef});`)
          }
          break
      }
    }

    return `import type { QueryInterface } from 'sequelize';
import { Sequelize } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
${upLines.join('\n\n')}
  },

  async down(queryInterface: QueryInterface): Promise<void> {
${downLines.join('\n\n')}
  },
};
`
  }

  private buildMigrationColumnFromField(field: SchemaField): string {
    if (field.type === 'VIRTUAL') return ''
    const I = '        '
    const col = this.toSnakeCase(field.name)
    const lines: string[] = []

    if (field.type === 'ENUM' && field.properties.enumValues?.length) {
      lines.push(`${I}type: Sequelize.ENUM(${field.properties.enumValues.map(v => `'${v}'`).join(', ')})`)
    } else if (field.type === 'ARRAY') {
      if (this.dialect === 'postgres') {
        lines.push(`${I}type: Sequelize.ARRAY(Sequelize.TEXT)`)
      } else {
        lines.push(`${I}type: Sequelize.JSON`)
      }
    } else if (field.type === 'DECIMAL' && (field.properties.precision > 0 || field.properties.scale > 0)) {
      const p = field.properties.precision || 10
      const s = field.properties.scale || 2
      lines.push(`${I}type: Sequelize.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'MONEY') {
      const p = field.properties.precision || 19
      const s = field.properties.scale || 4
      lines.push(`${I}type: Sequelize.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'RANGE') {
      if (this.dialect === 'postgres') {
        lines.push(`${I}type: Sequelize.RANGE(Sequelize.INTEGER)`)
      } else {
        lines.push(`${I}type: Sequelize.JSON`)
      }
    } else if ((field.type === 'STRING' || field.type === 'CHAR') && field.properties.length > 0) {
      lines.push(`${I}type: Sequelize.${field.type}(${field.properties.length})`)
    } else {
      lines.push(`${I}type: Sequelize.${field.type}`)
    }
    if (field.properties.primaryKey) lines.push(`${I}primaryKey: true`)
    if (field.properties.autoIncrement) lines.push(`${I}autoIncrement: true`)
    if (field.properties.unique && !field.properties.primaryKey) lines.push(`${I}unique: true`)
    lines.push(`${I}allowNull: ${field.properties.allowNull}`)
    if (field.properties.defaultValue) lines.push(`${I}defaultValue: ${this.formatDefault(field)}`)

    return `      ${col}: {\n${lines.join(',\n')},\n      }`
  }

  private buildMigrationColumnInline(field: SchemaField): string {
    if (field.type === 'VIRTUAL') return '{ /* VIRTUAL - not stored in DB */ }'
    const lines: string[] = []

    if (field.type === 'ENUM' && field.properties.enumValues?.length) {
      lines.push(`      type: Sequelize.ENUM(${field.properties.enumValues.map(v => `'${v}'`).join(', ')})`)
    } else if (field.type === 'ARRAY') {
      if (this.dialect === 'postgres') {
        lines.push(`      type: Sequelize.ARRAY(Sequelize.TEXT)`)
      } else {
        lines.push(`      type: Sequelize.JSON`)
      }
    } else if (field.type === 'DECIMAL' && (field.properties.precision > 0 || field.properties.scale > 0)) {
      const p = field.properties.precision || 10
      const s = field.properties.scale || 2
      lines.push(`      type: Sequelize.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'MONEY') {
      const p = field.properties.precision || 19
      const s = field.properties.scale || 4
      lines.push(`      type: Sequelize.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'RANGE') {
      if (this.dialect === 'postgres') {
        lines.push(`      type: Sequelize.RANGE(Sequelize.INTEGER)`)
      } else {
        lines.push(`      type: Sequelize.JSON`)
      }
    } else if ((field.type === 'STRING' || field.type === 'CHAR') && field.properties.length > 0) {
      lines.push(`      type: Sequelize.${field.type}(${field.properties.length})`)
    } else {
      lines.push(`      type: Sequelize.${field.type}`)
    }
    if (field.properties.primaryKey) lines.push(`      primaryKey: true`)
    if (field.properties.autoIncrement) lines.push(`      autoIncrement: true`)
    if (field.properties.unique && !field.properties.primaryKey) lines.push(`      unique: true`)
    lines.push(`      allowNull: ${field.properties.allowNull}`)
    if (field.properties.defaultValue) lines.push(`      defaultValue: ${this.formatDefault(field)}`)

    return `{\n${lines.join(',\n')},\n    }`
  }

  private migrationTimestamp(ts: number, index: number): string {
    const d = new Date(ts)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const dy = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    const s = String(d.getSeconds()).padStart(2, '0')
    const seq = String(index).padStart(2, '0')
    return `${y}${mo}${dy}${h}${mi}${s}${seq}`
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'migration'
  }

  // ════════════════════════════════════════════════════════════
  //  Config / scaffolding files
  // ════════════════════════════════════════════════════════════

  private genDatabaseConfig(): string {
    return this.genTsDatabaseConfigForDialect()
  }

  private genTsDatabaseConfigForDialect(): string {
    const d = this.dialect
    const cfg = this.dialectCfg

    if (d === 'sqlite') {
      return `import 'dotenv/config';
import type { Options } from 'sequelize';

interface DbConfig {
  [key: string]: Options;
}

const config: DbConfig = {
  development: {
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE ?? './database.sqlite',
    logging: console.log,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  production: {
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE ?? './database.sqlite',
    logging: false,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
};

export default config;
`
    }

    const user = d === 'mssql' ? 'sa' : d === 'mysql' ? 'root' : 'postgres'
    const pass = d === 'mssql' ? 'YourStrong!Passw0rd' : d === 'mysql' ? 'root' : 'postgres'
    const port = cfg.port

    const dialectOpts = d === 'mssql'
      ? `\n    dialectOptions: { options: { encrypt: false, trustServerCertificate: true } },`
      : ''
    const dialectOptsProd = d === 'postgres'
      ? `\n    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },`
      : d === 'mssql'
        ? `\n    dialectOptions: { options: { encrypt: true, trustServerCertificate: false } },`
        : ''

    return `import 'dotenv/config';
import type { Options } from 'sequelize';

interface DbConfig {
  [key: string]: Options & { use_env_variable?: string };
}

const config: DbConfig = {
  development: {
    username: process.env.DB_USER ?? '${user}',
    password: process.env.DB_PASSWORD ?? '${pass}',
    database: process.env.DB_NAME ?? 'app_development',
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT) || ${port},
    dialect: '${d}',
    logging: console.log,${dialectOpts}
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  test: {
    username: process.env.DB_USER ?? '${user}',
    password: process.env.DB_PASSWORD ?? '${pass}',
    database: process.env.DB_NAME ?? 'app_test',
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT) || ${port},
    dialect: '${d}',
    logging: false,${dialectOpts}
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: '${d}',
    logging: false,${dialectOptsProd}
    define: { underscored: true, freezeTableName: true, timestamps: true },
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  },
};

export default config;
`
  }

  private genSequelizeRc(): string {
    return `const path = require('path');

module.exports = {
  config: path.resolve('dist', 'config', 'database.js'),
  'models-path': path.resolve('dist', 'models'),
  'seeders-path': path.resolve('dist', 'seeders'),
  'migrations-path': path.resolve('dist', 'migrations'),
};
`
  }

  private genEnvExample(): string {
    return this.dialectCfg.envExample
  }

  private genTsConfig(): string {
    const cfg = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    }
    return JSON.stringify(cfg, null, 2) + '\n'
  }

  private genPackageJson(): string {
    const pkg = {
      name: 'sequelize-models-ts',
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'tsc',
        'db:create': 'npx sequelize-cli db:create',
        'db:migrate': 'npm run build && npx sequelize-cli db:migrate',
        'db:migrate:undo': 'npx sequelize-cli db:migrate:undo',
        'db:migrate:undo:all': 'npx sequelize-cli db:migrate:undo:all',
        'db:seed': 'npm run build && npx sequelize-cli db:seed:all',
        'db:seed:undo': 'npx sequelize-cli db:seed:undo:all',
        'db:reset': 'npm run build && npx sequelize-cli db:migrate:undo:all && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all',
      },
      dependencies: {
        dotenv: '^16.4.0',
        ...this.dialectCfg.driverPkg,
        sequelize: '^6.37.0',
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        'sequelize-cli': '^6.6.0',
        typescript: '^5.3.0',
      },
    }
    return JSON.stringify(pkg, null, 2) + '\n'
  }

  // ════════════════════════════════════════════════════════════
  //  Topological sort
  // ════════════════════════════════════════════════════════════

  private topologicalSort(models: SchemaModel[]): SchemaModel[] {
    const idToModel = new Map(models.map(m => [m.id, m]))
    const visited = new Set<string>()
    const sorted: SchemaModel[] = []

    const visit = (model: SchemaModel) => {
      if (visited.has(model.id)) return
      visited.add(model.id)
      for (const other of models) {
        for (const assoc of other.associations) {
          if (assoc.targetModelId === model.id && assoc.type !== 'M:N') {
            const dep = idToModel.get(other.id)
            if (dep) visit(dep)
          }
        }
      }
      sorted.push(model)
    }

    for (const m of models) visit(m)
    return sorted
  }

  // ════════════════════════════════════════════════════════════
  //  Helpers
  // ════════════════════════════════════════════════════════════

  private safeName(name: string): string {
    return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  }

  private toSnakeCase(name: string): string {
    return name
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .toLowerCase()
  }

  private fk(modelName: string): string {
    return this.toSnakeCase(modelName) + '_id'
  }

  /** camelCase FK name for TS attributes: User → userId */
  private fkCamel(modelName: string): string {
    const safe = this.safeName(modelName)
    return safe.charAt(0).toLowerCase() + safe.slice(1) + 'Id'
  }

  private mapTsType(field: SchemaField): string {
    switch (field.type) {
      case 'INTEGER':
      case 'SMALLINT':
      case 'BIGINT':
      case 'TINYINT':
      case 'FLOAT':
      case 'REAL':
      case 'DOUBLE':
      case 'DECIMAL':
      case 'MONEY':
        return 'number'
      case 'STRING':
      case 'TEXT':
      case 'CHAR':
      case 'UUID':
        return 'string'
      case 'ENUM':
        return field.properties.enumValues?.length
          ? field.properties.enumValues.map(v => `'${v}'`).join(' | ')
          : 'string'
      case 'BOOLEAN':
        return 'boolean'
      case 'DATE':
      case 'DATEONLY':
        return 'Date'
      case 'TIME':
        return 'string'
      case 'JSON':
      case 'JSONB':
        return 'Record<string, unknown>'
      case 'BLOB':
        return 'Buffer'
      case 'ARRAY':
        return 'string[]'
      case 'RANGE':
        return 'string'
      case 'VIRTUAL':
        return 'unknown'
      default:
        return 'unknown'
    }
  }

  private formatDefault(field: SchemaField): string {
    const val = field.properties.defaultValue
    if (!val) return "''"

    if (val.startsWith('Sequelize.') || val === 'NOW()') {
      return val === 'NOW()' ? "Sequelize.literal('NOW()')" : val
    }

    const numericTypes = ['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY']
    if (numericTypes.includes(field.type)) {
      const num = Number(val)
      return isNaN(num) ? `'${val}'` : String(num)
    }

    if (field.type === 'BOOLEAN') return val === 'true' ? 'true' : 'false'
    if (field.type === 'UUID') return 'DataTypes.UUIDV4'
    return `'${val}'`
  }
}
