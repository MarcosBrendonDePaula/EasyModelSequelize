import type { SchemaModel, SchemaField, SchemaAssociation, GeneratedFile, GeneratorResult, MigrationEntry, MigrationOp } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'

export type SequelizeDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql'

interface DialectConfig {
  name: string
  driverPkg: Record<string, string>
  port: number
  envExample: string
  configFn: (dialect: SequelizeDialect) => string
}

export const DIALECT_CONFIGS: Record<SequelizeDialect, DialectConfig> = {
  postgres: {
    name: 'PostgreSQL',
    driverPkg: { pg: '^8.13.0', 'pg-hstore': '^2.3.4' },
    port: 5432,
    envExample: `# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=app_development
DB_USER=postgres
DB_PASSWORD=postgres

# Production (used via use_env_variable)
# DATABASE_URL=postgres://user:pass@host:5432/dbname

NODE_ENV=development
`,
    configFn: () => `'use strict';

require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME     || 'app_development',
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 5432,
    dialect:  'postgres',
    logging:  console.log,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  test: {
    username: process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME     || 'app_test',
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 5432,
    dialect:  'postgres',
    logging:  false,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect:  'postgres',
    logging:  false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    define: { underscored: true, freezeTableName: true, timestamps: true },
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  },
};
`,
  },

  mysql: {
    name: 'MySQL',
    driverPkg: { mysql2: '^3.11.0' },
    port: 3306,
    envExample: `# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=app_development
DB_USER=root
DB_PASSWORD=root

NODE_ENV=development
`,
    configFn: () => `'use strict';

require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME     || 'app_development',
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 3306,
    dialect:  'mysql',
    logging:  console.log,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  test: {
    username: process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME     || 'app_test',
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 3306,
    dialect:  'mysql',
    logging:  false,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect:  'mysql',
    logging:  false,
    define: { underscored: true, freezeTableName: true, timestamps: true },
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  },
};
`,
  },

  sqlite: {
    name: 'SQLite',
    driverPkg: { sqlite3: '^5.1.0' },
    port: 0,
    envExample: `# Database
DB_STORAGE=./database.sqlite

NODE_ENV=development
`,
    configFn: () => `'use strict';

require('dotenv').config();

module.exports = {
  development: {
    dialect:  'sqlite',
    storage:  process.env.DB_STORAGE || './database.sqlite',
    logging:  console.log,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  test: {
    dialect:  'sqlite',
    storage:  ':memory:',
    logging:  false,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  production: {
    dialect:  'sqlite',
    storage:  process.env.DB_STORAGE || './database.sqlite',
    logging:  false,
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
};
`,
  },

  mssql: {
    name: 'SQL Server',
    driverPkg: { tedious: '^18.6.0' },
    port: 1433,
    envExample: `# Database
DB_HOST=127.0.0.1
DB_PORT=1433
DB_NAME=app_development
DB_USER=sa
DB_PASSWORD=YourStrong!Passw0rd

NODE_ENV=development
`,
    configFn: () => `'use strict';

require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER     || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
    database: process.env.DB_NAME     || 'app_development',
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 1433,
    dialect:  'mssql',
    logging:  console.log,
    dialectOptions: { options: { encrypt: false, trustServerCertificate: true } },
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  test: {
    username: process.env.DB_USER     || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
    database: process.env.DB_NAME     || 'app_test',
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 1433,
    dialect:  'mssql',
    logging:  false,
    dialectOptions: { options: { encrypt: false, trustServerCertificate: true } },
    define: { underscored: true, freezeTableName: true, timestamps: true },
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect:  'mssql',
    logging:  false,
    dialectOptions: { options: { encrypt: true, trustServerCertificate: false } },
    define: { underscored: true, freezeTableName: true, timestamps: true },
    pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  },
};
`,
  },
}

export class SequelizeGenerator implements CodeGenerator {
  readonly metadata: GeneratorMetadata
  private readonly dialect: SequelizeDialect
  private readonly dialectCfg: DialectConfig

  constructor(dialect: SequelizeDialect = 'postgres') {
    this.dialect = dialect
    this.dialectCfg = DIALECT_CONFIGS[dialect]
    this.metadata = {
      id: dialect === 'postgres' ? 'sequelize' : `sequelize-${dialect}`,
      name: `Sequelize JS (${this.dialectCfg.name})`,
      description: `Sequelize v6 project with class-based models, migrations, and ${this.dialectCfg.name} config`,
      language: 'javascript',
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
          path: `models/${this.safeName(model.name)}.js`,
          content: this.genModel(model, models),
          language: 'javascript'
        })
      } catch (err: any) {
        errors.push(`Model "${model.name}": ${err.message}`)
      }
    }

    // models/index.js — auto-loader + association setup
    files.push({
      path: 'models/index.js',
      content: this.genModelsIndex(),
      language: 'javascript'
    })

    // ── Migrations ───────────────────────────────────────────
    if (migrations && migrations.length > 0) {
      // Incremental migrations from history
      const migrationFiles = this.genIncrementalMigrations(migrations)
      files.push(...migrationFiles)
    } else {
      // Fresh createTable migrations (no history)
      const sortedModels = this.topologicalSort(models)
      for (let i = 0; i < sortedModels.length; i++) {
        const model = sortedModels[i]
        try {
          const seq = String(i + 1).padStart(3, '0')
          const ts = `20250101000${seq}`
          files.push({
            path: `migrations/${ts}-create-${this.toSnakeCase(model.name)}.js`,
            content: this.genMigration(model, models),
            language: 'javascript'
          })
        } catch (err: any) {
          errors.push(`Migration "${model.name}": ${err.message}`)
        }
      }
    }

    // ── Seeders stub ─────────────────────────────────────────
    files.push({
      path: 'seeders/.gitkeep',
      content: '',
      language: 'text'
    })

    // ── Config & scaffolding ─────────────────────────────────
    files.push({ path: 'config/database.js', content: this.genDatabaseConfig(), language: 'javascript' })
    files.push({ path: '.sequelizerc', content: this.genSequelizeRc(), language: 'javascript' })
    files.push({ path: '.env.example', content: this.genEnvExample(), language: 'text' })
    files.push({ path: 'package.json', content: this.genPackageJson(), language: 'json' })

    // ── Schema backup ────────────────────────────────────────
    files.push({ path: 'db.json', content: JSON.stringify(models, null, 2), language: 'json' })

    return { generatorId: this.metadata.id, generatorName: this.metadata.name, files, errors }
  }

  previewModel(model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[] {
    return [{
      path: `models/${this.safeName(model.name)}.js`,
      content: this.genModel(model, allModels),
      language: 'javascript'
    }]
  }

  // ════════════════════════════════════════════════════════════
  //  Model — class-based Model.init() pattern (recommended)
  // ════════════════════════════════════════════════════════════

  private genModel(model: SchemaModel, allModels: SchemaModel[]): string {
    const name = this.safeName(model.name)
    const table = this.toSnakeCase(name)
    const fieldLines = model.fields.map(f => this.buildField(f))

    // Add FK fields from incoming associations (belongsTo side)
    const fkFields = this.buildModelFKFields(model, allModels)
    const allFields = [...fieldLines, ...fkFields].join(',\n')

    // Build static associate() method
    const assocLines = this.buildAssociateFn(model, allModels)

    return `'use strict';

const { Model, DataTypes } = require('sequelize');

class ${name} extends Model {
  static associate(models) {
${assocLines || '    // No associations'}
  }
}

module.exports = (sequelize) => {
  ${name}.init({
${allFields}
  }, {
    sequelize,
    modelName: '${name}',
    tableName: '${table}',
    underscored: true,
    timestamps: true,
    paranoid: false,
  });

  return ${name};
};
`
  }

  private buildField(field: SchemaField): string {
    const I = '      '
    const lines: string[] = []

    if (field.type === 'ENUM' && field.properties.enumValues?.length) {
      lines.push(`${I}type: DataTypes.ENUM(${field.properties.enumValues.map(v => `'${v}'`).join(', ')})`)
    } else if (field.type === 'ARRAY') {
      // ARRAY is only supported on PostgreSQL; fallback to JSON for other dialects
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
      // Sequelize has no DataTypes.MONEY, use DECIMAL with custom precision/scale
      const p = field.properties.precision || 19
      const s = field.properties.scale || 4
      lines.push(`${I}type: DataTypes.DECIMAL(${p}, ${s})`)
    } else if (field.type === 'RANGE') {
      // RANGE is PostgreSQL-specific; fallback to JSON for other dialects
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

    // Validations
    const validates = this.buildValidate(field)
    if (validates) lines.push(validates)

    if (field.properties.defaultValue) {
      lines.push(`${I}defaultValue: ${this.formatDefault(field)}`)
    }

    // field: for FK columns the column name is already snake_case in the schema
    const colName = this.toSnakeCase(field.name)
    const fieldAttr = colName !== field.name ? `\n${I}field: '${colName}',` : ''

    return `    ${field.name}: {${fieldAttr}\n${lines.join(',\n')},\n    }`
  }

  private buildValidate(field: SchemaField): string | null {
    const I = '      '
    const rules: string[] = []

    if (!field.properties.allowNull && !field.properties.primaryKey) {
      rules.push(`        notNull: { msg: '${field.name} is required' }`)
      if (['STRING', 'TEXT', 'CHAR'].includes(field.type)) {
        rules.push(`        notEmpty: { msg: '${field.name} cannot be empty' }`)
      }
    }

    if (field.type === 'UUID') {
      rules.push(`        isUUID: 4`)
    }

    if (['FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(field.type)) {
      rules.push(`        isDecimal: true`)
    }

    if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT'].includes(field.type) && !field.properties.primaryKey) {
      rules.push(`        isInt: true`)
    }

    if (rules.length === 0) return null
    return `${I}validate: {\n${rules.join(',\n')},\n${I}}`
  }

  // ════════════════════════════════════════════════════════════
  //  Associations — inside static associate(models)
  // ════════════════════════════════════════════════════════════

  private buildAssociateFn(model: SchemaModel, allModels: SchemaModel[]): string {
    if (model.associations.length === 0) return ''

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

    // Add inverse belongsTo for models that are targeted by 1:1 or 1:M from others
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

    // Deduplicate (same line might be written from both directions)
    return [...new Set(lines)].join('\n')
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

        const I = '      '
        const refTable = this.toSnakeCase(other.name)
        const lines = [
          `${I}type: DataTypes.INTEGER`,
          `${I}allowNull: true`,
          `${I}references: {\n${I}  model: '${refTable}',\n${I}  key: 'id',\n${I}}`,
          `${I}onUpdate: 'CASCADE'`,
          `${I}onDelete: '${assoc.type === '1:1' ? 'SET NULL' : 'CASCADE'}'`,
        ]
        fks.push(`    ${fkName}: {\n${lines.join(',\n')},\n    }`)
      }
    }

    return fks
  }

  // ════════════════════════════════════════════════════════════
  //  models/index.js — auto-discover + associate
  // ════════════════════════════════════════════════════════════

  private genModelsIndex(): string {
    return `'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];
const db = {};

let sequelize;
if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
}

// Auto-load all model files in this directory
const basename = path.basename(__filename);
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      !file.includes('.test.')
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize);
    db[model.name] = model;
  });

// Set up associations
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
`
  }

  // ════════════════════════════════════════════════════════════
  //  Migration — queryInterface.createTable / dropTable
  // ════════════════════════════════════════════════════════════

  private genMigration(model: SchemaModel, allModels: SchemaModel[]): string {
    const table = this.toSnakeCase(model.name)

    // Build columns: explicit fields + FK columns from incoming associations
    const colLines: string[] = []

    for (const field of model.fields) {
      // Skip VIRTUAL fields - they are not stored in the database
      if (field.type === 'VIRTUAL') continue
      colLines.push(this.buildMigrationColumn(field))
    }

    // Add FK columns for associations where this model is the target (belongsTo side)
    const incomingFKs = this.getIncomingFKs(model, allModels)
    for (const fkCol of incomingFKs) {
      colLines.push(fkCol)
    }

    // Add timestamps
    colLines.push(`      created_at: {\n        type: Sequelize.DATE,\n        allowNull: false,\n        defaultValue: Sequelize.literal('NOW()'),\n      }`)
    colLines.push(`      updated_at: {\n        type: Sequelize.DATE,\n        allowNull: false,\n        defaultValue: Sequelize.literal('NOW()'),\n      }`)

    return `'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('${table}', {
${colLines.join(',\n')}
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('${table}');
  },
};
`
  }

  private buildMigrationColumn(field: SchemaField): string {
    // VIRTUAL fields must not appear in migrations
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

    if (field.properties.defaultValue) {
      lines.push(`${I}defaultValue: ${this.formatDefault(field)}`)
    }

    return `      ${col}: {\n${lines.join(',\n')},\n      }`
  }

  /** FK columns injected into tables that are on the belongsTo side */
  private getIncomingFKs(model: SchemaModel, allModels: SchemaModel[]): string[] {
    const fks: string[] = []
    const seen = new Set<string>()

    for (const other of allModels) {
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        if (assoc.type === 'M:N') continue // junction table handles FKs

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
  //  Config / scaffolding files
  // ════════════════════════════════════════════════════════════

  private genDatabaseConfig(): string {
    return this.dialectCfg.configFn(this.dialect)
  }

  private genSequelizeRc(): string {
    return `const path = require('path');

module.exports = {
  config:         path.resolve('config', 'database.js'),
  'models-path':  path.resolve('models'),
  'seeders-path': path.resolve('seeders'),
  'migrations-path': path.resolve('migrations'),
};
`
  }

  private genEnvExample(): string {
    return this.dialectCfg.envExample
  }

  private genPackageJson(): string {
    const pkg = {
      name: 'sequelize-models',
      version: '1.0.0',
      private: true,
      scripts: {
        'db:create':  'npx sequelize-cli db:create',
        'db:migrate': 'npx sequelize-cli db:migrate',
        'db:migrate:undo': 'npx sequelize-cli db:migrate:undo',
        'db:migrate:undo:all': 'npx sequelize-cli db:migrate:undo:all',
        'db:seed':    'npx sequelize-cli db:seed:all',
        'db:seed:undo': 'npx sequelize-cli db:seed:undo:all',
        'db:reset':   'npx sequelize-cli db:migrate:undo:all && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all',
      },
      dependencies: {
        dotenv: '^16.4.0',
        ...this.dialectCfg.driverPkg,
        sequelize: '^6.37.0',
      },
      devDependencies: {
        'sequelize-cli': '^6.6.0',
      },
    }
    return JSON.stringify(pkg, null, 2) + '\n'
  }

  // ════════════════════════════════════════════════════════════
  //  Incremental migrations — from MigrationEntry history
  // ════════════════════════════════════════════════════════════

  private genIncrementalMigrations(migrations: MigrationEntry[]): GeneratedFile[] {
    const files: GeneratedFile[] = []

    for (let i = 0; i < migrations.length; i++) {
      const entry = migrations[i]
      const ts = this.migrationTimestamp(entry.timestamp, i)
      const slug = this.slugify(entry.description)

      const content = this.genMigrationFromOps(entry.ops)
      files.push({
        path: `migrations/${ts}-${slug}.js`,
        content,
        language: 'javascript'
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
          // Collect all addColumn ops for this table that follow (excluding VIRTUAL fields)
          const cols = ops.filter(o =>
            o.type === 'addColumn' && o.table === op.table && o.field && o.field.type !== 'VIRTUAL'
          )
          const colDefs = cols.map(c => this.buildMigrationColumnFromField(c.field!)).filter(c => c !== '').join(',\n')

          // Add timestamps
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
          // For down: we can't fully reconstruct the table, but provide a comment
          downLines.unshift(`    // TODO: Recreate table '${op.table}' if needed`)
          break

        case 'renameTable':
          upLines.push(`    await queryInterface.renameTable('${op.previousName}', '${op.table}');`)
          downLines.unshift(`    await queryInterface.renameTable('${op.table}', '${op.previousName}');`)
          break

        case 'addColumn': {
          // Skip if part of a createTable (already handled above)
          const hasCreateTable = ops.some(o => o.type === 'createTable' && o.table === op.table)
          if (hasCreateTable) break

          // Skip VIRTUAL fields - they are not stored in the database
          if (op.field?.type === 'VIRTUAL') break

          if (op.field) {
            const colDef = this.buildMigrationColumnInline(op.field)
            upLines.push(`    await queryInterface.addColumn('${op.table}', '${op.column}', ${colDef});`)
            downLines.unshift(`    await queryInterface.removeColumn('${op.table}', '${op.column}');`)
          } else if (op.reference) {
            // FK column from association
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
          // Skip VIRTUAL fields - they are not stored in the database
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

    return `'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
${upLines.join('\n\n')}
  },

  async down(queryInterface, Sequelize) {
${downLines.join('\n\n')}
  },
};
`
  }

  private buildMigrationColumnFromField(field: SchemaField): string {
    // VIRTUAL fields must not appear in migrations
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

    if (field.properties.defaultValue) {
      lines.push(`${I}defaultValue: ${this.formatDefault(field)}`)
    }

    return `      ${col}: {\n${lines.join(',\n')},\n      }`
  }

  private buildMigrationColumnInline(field: SchemaField): string {
    // VIRTUAL fields must not appear in migrations - return safe fallback
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

    if (field.properties.defaultValue) {
      lines.push(`      defaultValue: ${this.formatDefault(field)}`)
    }

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
    // Add index to avoid collisions for rapid changes
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
  //  Topological sort — create referenced tables first
  // ════════════════════════════════════════════════════════════

  private topologicalSort(models: SchemaModel[]): SchemaModel[] {
    const idToModel = new Map(models.map(m => [m.id, m]))
    const visited = new Set<string>()
    const sorted: SchemaModel[] = []

    const visit = (model: SchemaModel) => {
      if (visited.has(model.id)) return
      visited.add(model.id)
      // Visit dependencies first (models this one references via belongsTo)
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

  /** foreignKey column name: User → user_id */
  private fk(modelName: string): string {
    return this.toSnakeCase(modelName) + '_id'
  }

  private formatDefault(field: SchemaField): string {
    const val = field.properties.defaultValue
    if (!val) return "''"

    // Sequelize literal expressions
    if (val.startsWith('Sequelize.') || val === 'NOW()') {
      return val === 'NOW()' ? "Sequelize.literal('NOW()')" : val
    }

    const numericTypes = ['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY']
    if (numericTypes.includes(field.type)) {
      const num = Number(val)
      return isNaN(num) ? `'${val}'` : String(num)
    }

    if (field.type === 'BOOLEAN') return val === 'true' ? 'true' : 'false'
    if (field.type === 'UUID') return "DataTypes.UUIDV4"
    return `'${val}'`
  }
}
