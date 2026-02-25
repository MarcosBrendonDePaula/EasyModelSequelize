import type { SchemaModel, SchemaField, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'

type DrizzleDialect = 'postgres' | 'mysql' | 'sqlite'

interface DrizzleCfg {
  name: string
  importPkg: string
  tablePrefix: string
  driverPkg: Record<string, string>
  connUrl: string
}

const DRIZZLE_DIALECTS: Record<DrizzleDialect, DrizzleCfg> = {
  postgres: {
    name: 'PostgreSQL',
    importPkg: 'drizzle-orm/pg-core',
    tablePrefix: 'pg',
    driverPkg: { postgres: '^3.4.0' },
    connUrl: 'postgresql://postgres:postgres@localhost:5432/app_dev',
  },
  mysql: {
    name: 'MySQL',
    importPkg: 'drizzle-orm/mysql-core',
    tablePrefix: 'mysql',
    driverPkg: { mysql2: '^3.11.0' },
    connUrl: 'mysql://root:root@localhost:3306/app_dev',
  },
  sqlite: {
    name: 'SQLite',
    importPkg: 'drizzle-orm/sqlite-core',
    tablePrefix: 'sqlite',
    driverPkg: { 'better-sqlite3': '^11.0.0', '@types/better-sqlite3': '^7.6.0' },
    connUrl: 'file:./dev.db',
  },
}

export class DrizzleGenerator implements CodeGenerator {
  readonly metadata: GeneratorMetadata
  private readonly dialect: DrizzleDialect
  private readonly cfg: DrizzleCfg

  constructor(dialect: DrizzleDialect = 'postgres') {
    this.dialect = dialect
    this.cfg = DRIZZLE_DIALECTS[dialect]
    this.metadata = {
      id: dialect === 'postgres' ? 'drizzle' : `drizzle-${dialect}`,
      name: `Drizzle (${this.cfg.name})`,
      description: `Drizzle ORM schema with ${this.cfg.name} and typed queries`,
      language: 'typescript',
      framework: 'Drizzle',
      category: 'Drizzle',
      dialect: this.cfg.name,
    }
  }

  generate(models: SchemaModel[], _migrations?: MigrationEntry[]): GeneratorResult {
    const files: GeneratedFile[] = []
    const errors: string[] = []

    try {
      files.push({ path: 'src/schema.ts', content: this.genSchema(models), language: 'typescript' })
      files.push({ path: 'src/relations.ts', content: this.genRelations(models), language: 'typescript' })
    } catch (err: any) {
      errors.push(`Schema: ${err.message}`)
    }

    files.push({ path: 'src/db.ts', content: this.genDb(), language: 'typescript' })
    files.push({ path: 'drizzle.config.ts', content: this.genDrizzleConfig(), language: 'typescript' })
    files.push({ path: 'package.json', content: this.genPackageJson(), language: 'json' })
    files.push({ path: 'tsconfig.json', content: this.genTsConfig(), language: 'json' })
    files.push({ path: '.env', content: this.genEnv(), language: 'text' })
    files.push({ path: 'db.json', content: JSON.stringify(models, null, 2), language: 'json' })

    return { generatorId: this.metadata.id, generatorName: this.metadata.name, files, errors }
  }

  previewModel(model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[] {
    return [{ path: 'src/schema.ts', content: this.genTableBlock(model, allModels), language: 'typescript' }]
  }

  // ── Schema ──────────────────────────────────────────────

  private genSchema(models: SchemaModel[]): string {
    const helperImports = this.getHelperImports(models)

    // Collect enum declarations for PG
    const enumDecls = this.genEnumDeclarations(models)
    const enumImport = enumDecls && this.dialect === 'postgres' ? ', pgEnum' : ''

    const mysqlEnumImport = enumDecls && this.dialect === 'mysql' ? ', mysqlEnum' : ''
    const header = `import { ${helperImports.join(', ')}${enumImport}${mysqlEnumImport} } from '${this.cfg.importPkg}';\n`
    const enumBlock = enumDecls ? '\n' + enumDecls + '\n' : '\n'
    const blocks = models.map(m => this.genTableBlock(m, models)).join('\n')
    return header + enumBlock + blocks
  }

  private genEnumDeclarations(models: SchemaModel[]): string {
    const decls: string[] = []
    for (const m of models) {
      for (const f of m.fields) {
        if (f.type !== 'ENUM' || !f.properties.enumValues?.length) continue
        const enumName = this.lcFirst(this.safe(m.name)) + this.safe(f.name).charAt(0).toUpperCase() + this.safe(f.name).slice(1) + 'Enum'
        const values = f.properties.enumValues.map(v => `'${v}'`).join(', ')
        if (this.dialect === 'postgres') {
          decls.push(`export const ${enumName} = pgEnum('${this.snake(m.name)}_${this.snake(f.name)}', [${values}]);`)
        } else if (this.dialect === 'mysql') {
          // MySQL enums are inline, declare constant for reuse
          decls.push(`export const ${enumName}Values = [${values}] as const;`)
        } else {
          decls.push(`export const ${enumName}Values = [${values}] as const;`)
        }
      }
    }
    return decls.join('\n')
  }

  private genTableBlock(model: SchemaModel, allModels: SchemaModel[]): string {
    const name = this.safe(model.name)
    const table = this.snake(name)
    const varName = this.lcFirst(name) + 's'
    const fn = `${this.cfg.tablePrefix}Table`

    const cols: string[] = []

    for (const f of model.fields) {
      cols.push('  ' + this.genColumn(f, model.name))
    }

    // FK columns from incoming associations
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id || assoc.type === 'M:N') continue
        const fkCol = this.snake(other.name) + '_id'
        if (model.fields.some(f => this.snake(f.name) === fkCol)) continue
        const refTable = this.lcFirst(other.name) + 's'

        if (this.dialect === 'postgres') {
          cols.push(`  ${this.camel(fkCol)}: integer('${fkCol}').references(() => ${refTable}.id),`)
        } else if (this.dialect === 'mysql') {
          cols.push(`  ${this.camel(fkCol)}: int('${fkCol}'),`)
        } else {
          cols.push(`  ${this.camel(fkCol)}: integer('${fkCol}').references(() => ${refTable}.id),`)
        }
      }
    }

    // Timestamps
    if (!model.fields.some(f => f.name === 'createdAt')) {
      cols.push(this.genTimestampCol('createdAt', 'created_at'))
    }
    if (!model.fields.some(f => f.name === 'updatedAt')) {
      cols.push(this.genTimestampCol('updatedAt', 'updated_at'))
    }

    return `export const ${varName} = ${fn}('${table}', {\n${cols.join('\n')}\n});\n`
  }

  private genColumn(f: SchemaField, modelName?: string): string {
    // Skip VIRTUAL fields
    if (f.type === 'VIRTUAL') {
      return `// ${f.name} — virtual (computed), not stored`
    }

    const col = this.snake(f.name)
    const d = this.dialect

    let chain = ''

    // Type
    if (f.properties.primaryKey && f.properties.autoIncrement) {
      if (d === 'postgres') chain = `serial('${col}')`
      else if (d === 'mysql') chain = `int('${col}').autoincrement()`
      else chain = `integer('${col}', { mode: 'number' }).primaryKey({ autoIncrement: true })`
    } else if (f.type === 'ENUM' && f.properties.enumValues?.length && modelName) {
      const enumName = this.lcFirst(this.safe(modelName)) + this.safe(f.name).charAt(0).toUpperCase() + this.safe(f.name).slice(1) + 'Enum'
      if (d === 'postgres') {
        chain = `${enumName}('${col}')`
      } else if (d === 'mysql') {
        chain = `mysqlEnum('${col}', [${f.properties.enumValues.map(v => `'${v}'`).join(', ')}])`
      } else {
        chain = `text('${col}')`
      }
    } else {
      chain = this.mapDrizzleType(f, col)
    }

    // Constraints
    if (f.properties.primaryKey && !(d === 'sqlite' && f.properties.autoIncrement)) {
      chain += '.primaryKey()'
    }
    if (!f.properties.allowNull && !f.properties.primaryKey) chain += '.notNull()'
    if (f.properties.unique && !f.properties.primaryKey) chain += '.unique()'
    if (f.properties.defaultValue) {
      const dv = f.properties.defaultValue
      if (dv === 'NOW()' || dv === 'now()') chain += '.defaultNow()'
      else chain += `.default(${this.formatDefault(f)})`
    }

    return `${f.name}: ${chain},`
  }

  private genTimestampCol(name: string, col: string): string {
    if (this.dialect === 'postgres') return `  ${name}: timestamp('${col}').defaultNow().notNull(),`
    if (this.dialect === 'mysql') return `  ${name}: timestamp('${col}').defaultNow().notNull(),`
    return `  ${name}: integer('${col}', { mode: 'timestamp' }).notNull(),`
  }

  // ── Relations ───────────────────────────────────────────

  private genRelations(models: SchemaModel[]): string {
    const lines: string[] = [`import { relations } from 'drizzle-orm';`]

    // Import all tables
    const tableVars = models.map(m => this.lcFirst(m.name) + 's')
    lines.push(`import { ${tableVars.join(', ')} } from './schema';\n`)

    for (const model of models) {
      const relLines = this.genModelRelations(model, models)
      if (relLines) lines.push(relLines)
    }

    return lines.join('\n') + '\n'
  }

  private genModelRelations(model: SchemaModel, allModels: SchemaModel[]): string | null {
    const name = this.safe(model.name)
    const varName = this.lcFirst(name) + 's'
    const rels: string[] = []

    // Outgoing
    for (const assoc of model.associations) {
      const t = allModels.find(m => m.id === assoc.targetModelId)
      if (!t) continue
      const tgtVar = this.lcFirst(t.name) + 's'
      const tgtField = this.lcFirst(t.name)

      if (assoc.type === '1:1') {
        rels.push(`    ${tgtField}: one(${tgtVar}, { fields: [${varName}.id], references: [${tgtVar}.${this.camel(this.snake(name) + '_id')}] }),`)
      } else if (assoc.type === '1:M') {
        rels.push(`    ${tgtField}s: many(${tgtVar}),`)
      } else if (assoc.type === 'M:N') {
        rels.push(`    ${tgtField}s: many(${tgtVar}),`)
      }
    }

    // Incoming (belongsTo)
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        const otherVar = this.lcFirst(other.name) + 's'
        const otherField = this.lcFirst(other.name)
        const fkField = this.camel(this.snake(other.name) + '_id')

        if (assoc.type === '1:1' || assoc.type === '1:M') {
          rels.push(`    ${otherField}: one(${otherVar}, { fields: [${varName}.${fkField}], references: [${otherVar}.id] }),`)
        }
      }
    }

    if (rels.length === 0) return null

    return `export const ${varName}Relations = relations(${varName}, ({ one, many }) => ({\n${rels.join('\n')}\n}));\n`
  }

  // ── Scaffolding ─────────────────────────────────────────

  private genDb(): string {
    if (this.dialect === 'postgres') {
      return `import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as relations from './relations';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema: { ...schema, ...relations } });
`
    }
    if (this.dialect === 'mysql') {
      return `import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import * as relations from './relations';

const pool = mysql.createPool(process.env.DATABASE_URL!);
export const db = drizzle(pool, { schema: { ...schema, ...relations }, mode: 'default' });
`
    }
    return `import 'dotenv/config';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import * as relations from './relations';

const sqlite = new Database(process.env.DB_PATH || './dev.db');
export const db = drizzle(sqlite, { schema: { ...schema, ...relations } });
`
  }

  private genDrizzleConfig(): string {
    const outDir = './drizzle'
    if (this.dialect === 'sqlite') {
      return `import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: '${outDir}',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './dev.db',
  },
});
`
    }
    return `import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: '${outDir}',
  dialect: '${this.dialect}',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`
  }

  private genPackageJson(): string {
    return JSON.stringify({
      name: 'drizzle-models',
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'tsc',
        'db:generate': 'npx drizzle-kit generate',
        'db:migrate': 'npx drizzle-kit migrate',
        'db:push': 'npx drizzle-kit push',
        'db:studio': 'npx drizzle-kit studio',
      },
      dependencies: {
        dotenv: '^16.4.0',
        'drizzle-orm': '^0.36.0',
        ...this.cfg.driverPkg,
      },
      devDependencies: {
        'drizzle-kit': '^0.30.0',
        typescript: '^5.3.0',
        tsx: '^4.7.0',
        '@types/node': '^20.11.0',
      },
    }, null, 2) + '\n'
  }

  private genTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020', module: 'commonjs', lib: ['ES2020'],
        outDir: './dist', rootDir: './src', strict: true,
        esModuleInterop: true, skipLibCheck: true,
        resolveJsonModule: true, declaration: true, sourceMap: true,
      },
      include: ['src/**/*'], exclude: ['node_modules', 'dist'],
    }, null, 2) + '\n'
  }

  private genEnv(): string {
    if (this.dialect === 'sqlite') return `DB_PATH=./dev.db\n`
    return `DATABASE_URL="${this.cfg.connUrl}"\n`
  }

  // ── Helpers ─────────────────────────────────────────────

  private safe(n: string) { return n.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') }
  private snake(n: string) { return n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/\s+/g, '_').toLowerCase() }
  private lcFirst(n: string) { const s = this.safe(n); return s.charAt(0).toLowerCase() + s.slice(1) }
  private camel(s: string) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) }

  private getHelperImports(models: SchemaModel[]): string[] {
    const types = new Set<string>()
    const d = this.dialect

    types.add(d === 'postgres' ? 'pgTable' : d === 'mysql' ? 'mysqlTable' : 'sqliteTable')

    for (const m of models) {
      for (const f of m.fields) {
        if (f.properties.primaryKey && f.properties.autoIncrement) {
          if (d === 'postgres') types.add('serial')
          else types.add(d === 'mysql' ? 'int' : 'integer')
        } else {
          this.addTypeImport(f.type, types)
        }
      }
      // FK columns need integer
      if (m.associations.length > 0 || models.some(o => o.id !== m.id && o.associations.some(a => a.targetModelId === m.id))) {
        types.add(d === 'mysql' ? 'int' : 'integer')
      }
    }
    // Timestamps
    if (d === 'postgres' || d === 'mysql') types.add('timestamp')
    else types.add('integer')

    return [...types].sort()
  }

  private addTypeImport(type: string, set: Set<string>): void {
    const d = this.dialect
    switch (type) {
      case 'INTEGER': set.add(d === 'mysql' ? 'int' : 'integer'); break
      case 'SMALLINT': set.add(d === 'mysql' ? 'smallint' : d === 'postgres' ? 'smallint' : 'integer'); break
      case 'TINYINT': set.add(d === 'mysql' ? 'tinyint' : d === 'postgres' ? 'smallint' : 'integer'); break
      case 'BIGINT': set.add(d === 'sqlite' ? 'integer' : 'bigint'); break
      case 'FLOAT': case 'REAL': case 'DOUBLE': set.add(d === 'mysql' ? 'double' : d === 'postgres' ? 'doublePrecision' : 'real'); break
      case 'DECIMAL': set.add(d === 'mysql' ? 'decimal' : d === 'postgres' ? 'numeric' : 'real'); break
      case 'MONEY': set.add(d === 'mysql' ? 'decimal' : d === 'postgres' ? 'numeric' : 'real'); break
      case 'STRING': set.add(d === 'mysql' ? 'varchar' : 'text'); if (d === 'postgres') set.add('varchar'); break
      case 'TEXT': set.add('text'); break
      case 'CHAR': set.add(d === 'mysql' ? 'char' : d === 'postgres' ? 'char' : 'text'); break
      case 'BOOLEAN': set.add(d === 'sqlite' ? 'integer' : 'boolean'); break
      case 'DATE': case 'DATEONLY': set.add(d === 'sqlite' ? 'integer' : 'timestamp'); break
      case 'TIME': set.add(d === 'sqlite' ? 'text' : 'time'); break
      case 'UUID': set.add(d === 'postgres' ? 'uuid' : 'text'); break
      case 'JSON': case 'JSONB': set.add(d === 'postgres' ? 'jsonb' : d === 'mysql' ? 'json' : 'text'); break
      case 'BLOB': set.add(d === 'postgres' ? 'bytea' : 'blob'); break
      case 'ARRAY': set.add('text'); break
      case 'RANGE': set.add('text'); break
    }
  }

  private mapDrizzleType(field: SchemaField, col: string): string {
    const type = field.type
    const d = this.dialect
    switch (type) {
      case 'INTEGER': return d === 'mysql' ? `int('${col}')` : `integer('${col}')`
      case 'SMALLINT': return d === 'mysql' ? `smallint('${col}')` : d === 'postgres' ? `smallint('${col}')` : `integer('${col}')`
      case 'TINYINT': return d === 'mysql' ? `tinyint('${col}')` : d === 'postgres' ? `smallint('${col}')` : `integer('${col}')`
      case 'BIGINT': return d === 'mysql' ? `bigint('${col}', { mode: 'number' })` : d === 'postgres' ? `bigint('${col}', { mode: 'number' })` : `integer('${col}')`
      case 'FLOAT': case 'REAL': case 'DOUBLE':
        return d === 'mysql' ? `double('${col}')` : d === 'postgres' ? `doublePrecision('${col}')` : `real('${col}')`
      case 'DECIMAL': {
        const p = field.properties.precision || 10
        const s = field.properties.scale || 2
        if (d === 'mysql') return `decimal('${col}', { precision: ${p}, scale: ${s} })`
        if (d === 'postgres') return `numeric('${col}', { precision: ${p}, scale: ${s} })`
        return `real('${col}')`
      }
      case 'MONEY': {
        const p = field.properties.precision || 19
        const s = field.properties.scale || 4
        if (d === 'mysql') return `decimal('${col}', { precision: ${p}, scale: ${s} })`
        if (d === 'postgres') return `numeric('${col}', { precision: ${p}, scale: ${s} })`
        return `real('${col}')`
      }
      case 'STRING': {
        const len = field.properties.length || 255
        if (d === 'mysql') return `varchar('${col}', { length: ${len} })`
        if (d === 'postgres' && field.properties.length > 0) return `varchar('${col}', { length: ${len} })`
        return `text('${col}')`
      }
      case 'TEXT': return `text('${col}')`
      case 'CHAR': {
        const len = field.properties.length || 255
        if (d === 'mysql' || d === 'postgres') return `char('${col}', { length: ${len} })`
        return `text('${col}')`
      }
      case 'BOOLEAN': return d === 'sqlite' ? `integer('${col}', { mode: 'boolean' })` : `boolean('${col}')`
      case 'DATE': case 'DATEONLY':
        return d === 'sqlite' ? `integer('${col}', { mode: 'timestamp' })` : `timestamp('${col}')`
      case 'TIME': return d === 'sqlite' ? `text('${col}')` : `time('${col}')`
      case 'UUID': return d === 'postgres' ? `uuid('${col}')` : `text('${col}')`
      case 'JSON': case 'JSONB': return d === 'postgres' ? `jsonb('${col}')` : d === 'mysql' ? `json('${col}')` : `text('${col}')`
      case 'BLOB': return d === 'postgres' ? `bytea('${col}')` : `blob('${col}')`
      case 'ARRAY': return d === 'postgres' ? `text('${col}').array()` : `text('${col}')`
      case 'RANGE': return `text('${col}')`
      default: return `text('${col}')`
    }
  }

  private formatDefault(f: SchemaField): string {
    const v = f.properties.defaultValue!
    if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(f.type)) {
      const n = Number(v); return isNaN(n) ? `'${v}'` : String(n)
    }
    if (f.type === 'BOOLEAN') return v === 'true' ? 'true' : 'false'
    return `'${v}'`
  }
}
