import type { SchemaModel, SchemaField, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'

type SQLDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql'

interface SQLCfg { name: string; autoInc: string; now: string; blob: string; json: string }

const SQL_DIALECTS: Record<SQLDialect, SQLCfg> = {
  postgres: { name: 'PostgreSQL', autoInc: 'SERIAL', now: 'NOW()', blob: 'BYTEA', json: 'JSONB' },
  mysql:    { name: 'MySQL', autoInc: 'INT AUTO_INCREMENT', now: 'NOW()', blob: 'BLOB', json: 'JSON' },
  sqlite:   { name: 'SQLite', autoInc: 'INTEGER', now: "datetime('now')", blob: 'BLOB', json: 'TEXT' },
  mssql:    { name: 'SQL Server', autoInc: 'INT IDENTITY(1,1)', now: 'GETDATE()', blob: 'VARBINARY(MAX)', json: 'NVARCHAR(MAX)' },
}

export class SQLRawGenerator implements CodeGenerator {
  readonly metadata: GeneratorMetadata
  private readonly dialect: SQLDialect
  private readonly cfg: SQLCfg

  constructor(dialect: SQLDialect = 'postgres') {
    this.dialect = dialect
    this.cfg = SQL_DIALECTS[dialect]
    this.metadata = {
      id: dialect === 'postgres' ? 'sql-raw' : `sql-raw-${dialect}`,
      name: `SQL DDL (${this.cfg.name})`,
      description: `Raw CREATE TABLE statements for ${this.cfg.name}`,
      language: 'sql',
      framework: 'SQL',
      category: 'SQL Raw',
      dialect: this.cfg.name,
    }
  }

  generate(models: SchemaModel[], _migrations?: MigrationEntry[]): GeneratorResult {
    const files: GeneratedFile[] = []
    const errors: string[] = []

    const sorted = this.topologicalSort(models)

    // All tables in one file
    try {
      files.push({ path: 'schema.sql', content: this.genFullSchema(sorted, models), language: 'sql' })
    } catch (err: any) {
      errors.push(`Schema: ${err.message}`)
    }

    // Individual table files
    for (const model of sorted) {
      try {
        files.push({
          path: `tables/${this.snake(model.name)}.sql`,
          content: this.genTable(model, models),
          language: 'sql',
        })
      } catch (err: any) {
        errors.push(`Table "${model.name}": ${err.message}`)
      }
    }

    // Drop script
    files.push({ path: 'drop.sql', content: this.genDrop(sorted), language: 'sql' })
    files.push({ path: 'db.json', content: JSON.stringify(models, null, 2), language: 'json' })

    return { generatorId: this.metadata.id, generatorName: this.metadata.name, files, errors }
  }

  previewModel(model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[] {
    return [{ path: `${this.snake(model.name)}.sql`, content: this.genTable(model, allModels), language: 'sql' }]
  }

  // ── Full schema ─────────────────────────────────────────

  private genFullSchema(sorted: SchemaModel[], allModels: SchemaModel[]): string {
    const header = `-- ${this.cfg.name} Schema\n-- Auto-generated\n\n`
    const tables = sorted.map(m => this.genTable(m, allModels)).join('\n')

    // Junction tables for M:N
    const junctions: string[] = []
    const seen = new Set<string>()
    for (const m of allModels) {
      for (const assoc of m.associations) {
        if (assoc.type !== 'M:N') continue
        const t = allModels.find(x => x.id === assoc.targetModelId)
        if (!t) continue
        const key = [this.snake(m.name), this.snake(t.name)].sort().join('_')
        if (seen.has(key)) continue
        seen.add(key)
        junctions.push(this.genJunction(m, t))
      }
    }

    return header + tables + (junctions.length > 0 ? '\n-- Junction tables\n\n' + junctions.join('\n') : '') + '\n'
  }

  // ── Single table ────────────────────────────────────────

  private genTable(model: SchemaModel, allModels: SchemaModel[]): string {
    const table = this.snake(model.name)
    const cols: string[] = []

    for (const f of model.fields) {
      cols.push('  ' + this.genColumn(f))
    }

    // FK columns
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id || assoc.type === 'M:N') continue
        const fkCol = this.snake(other.name) + '_id'
        if (model.fields.some(f => this.snake(f.name) === fkCol)) continue
        const refTable = this.snake(other.name)
        const onDel = assoc.type === '1:1' ? 'SET NULL' : 'CASCADE'
        cols.push(`  ${fkCol} INTEGER REFERENCES ${refTable}(id) ON DELETE ${onDel} ON UPDATE CASCADE`)
      }
    }

    // Timestamps
    const tsType = this.dialect === 'mssql' ? 'DATETIME2' : this.dialect === 'sqlite' ? 'TEXT' : 'TIMESTAMP'
    if (!model.fields.some(f => f.name === 'createdAt' || f.name === 'created_at')) {
      cols.push(`  created_at ${tsType} NOT NULL DEFAULT ${this.cfg.now}`)
    }
    if (!model.fields.some(f => f.name === 'updatedAt' || f.name === 'updated_at')) {
      cols.push(`  updated_at ${tsType} NOT NULL DEFAULT ${this.cfg.now}`)
    }

    return `CREATE TABLE ${table} (\n${cols.join(',\n')}\n);\n`
  }

  private genColumn(f: SchemaField): string {
    // Skip VIRTUAL fields
    if (f.type === 'VIRTUAL') {
      return `-- ${f.name} is a virtual (computed) field`
    }

    const col = this.snake(f.name)
    const parts: string[] = [col]

    if (f.properties.primaryKey && f.properties.autoIncrement) {
      parts.push(this.cfg.autoInc)
      parts.push('PRIMARY KEY')
    } else {
      // String length
      if ((f.type === 'STRING' || f.type === 'CHAR') && f.properties.length > 0) {
        const sqlType = f.type === 'STRING' ? 'VARCHAR' : 'CHAR'
        parts.push(this.dialect === 'sqlite' ? 'TEXT' : `${sqlType}(${f.properties.length})`)
      }
      // Decimal precision/scale
      else if (f.type === 'DECIMAL' && (f.properties.precision > 0 || f.properties.scale > 0)) {
        const p = f.properties.precision || 10
        const s = f.properties.scale || 2
        parts.push(`DECIMAL(${p},${s})`)
      }
      // Money with custom precision
      else if (f.type === 'MONEY' && (f.properties.precision > 0 || f.properties.scale > 0)) {
        const p = f.properties.precision || 19
        const s = f.properties.scale || 4
        if (this.dialect === 'postgres' || this.dialect === 'mssql') parts.push('MONEY')
        else if (this.dialect === 'sqlite') parts.push('REAL')
        else parts.push(`DECIMAL(${p},${s})`)
      }
      else {
        parts.push(this.mapType(f.type))
      }
      if (f.properties.primaryKey) parts.push('PRIMARY KEY')
    }

    if (!f.properties.allowNull && !f.properties.primaryKey) parts.push('NOT NULL')
    if (f.properties.unique && !f.properties.primaryKey) parts.push('UNIQUE')
    if (f.properties.defaultValue && !f.properties.primaryKey) {
      parts.push(`DEFAULT ${this.formatDefault(f)}`)
    }

    if (f.type === 'ENUM' && f.properties.enumValues?.length) {
      const vals = f.properties.enumValues.map(v => `'${v}'`).join(', ')
      parts.push(`CHECK (${col} IN (${vals}))`)
    }

    return parts.join(' ')
  }

  private genJunction(a: SchemaModel, b: SchemaModel): string {
    const tableA = this.snake(a.name)
    const tableB = this.snake(b.name)
    const junction = `${tableA}_${tableB}`
    return `CREATE TABLE ${junction} (
  ${tableA}_id INTEGER NOT NULL REFERENCES ${tableA}(id) ON DELETE CASCADE,
  ${tableB}_id INTEGER NOT NULL REFERENCES ${tableB}(id) ON DELETE CASCADE,
  PRIMARY KEY (${tableA}_id, ${tableB}_id)
);\n`
  }

  private genDrop(sorted: SchemaModel[]): string {
    const header = `-- Drop all tables (reverse order)\n\n`
    const cascade = this.dialect === 'postgres' ? ' CASCADE' : ''
    const drops = [...sorted].reverse().map(m => `DROP TABLE IF EXISTS ${this.snake(m.name)}${cascade};`).join('\n')
    return header + drops + '\n'
  }

  // ── Helpers ─────────────────────────────────────────────

  private safe(n: string) { return n.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') }
  private snake(n: string) { return n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() }

  private mapType(t: string): string {
    switch (t) {
      case 'INTEGER': return 'INTEGER'
      case 'SMALLINT': return 'SMALLINT'
      case 'TINYINT': return this.dialect === 'postgres' ? 'SMALLINT' : this.dialect === 'sqlite' ? 'INTEGER' : 'TINYINT'
      case 'BIGINT': return 'BIGINT'
      case 'FLOAT': case 'REAL': return this.dialect === 'mssql' ? 'FLOAT' : 'REAL'
      case 'DOUBLE': return this.dialect === 'mssql' ? 'FLOAT' : 'DOUBLE PRECISION'
      case 'DECIMAL': return 'DECIMAL(10,2)'
      case 'MONEY': return this.dialect === 'postgres' || this.dialect === 'mssql' ? 'MONEY' : this.dialect === 'sqlite' ? 'REAL' : 'DECIMAL(19,4)'
      case 'STRING': return this.dialect === 'sqlite' ? 'TEXT' : 'VARCHAR(255)'
      case 'TEXT': return this.dialect === 'mssql' ? 'NVARCHAR(MAX)' : 'TEXT'
      case 'CHAR': return this.dialect === 'sqlite' ? 'TEXT' : 'CHAR(255)'
      case 'BOOLEAN': return this.dialect === 'sqlite' || this.dialect === 'mssql' ? 'INTEGER' : 'BOOLEAN'
      case 'DATEONLY': return this.dialect === 'sqlite' ? 'TEXT' : 'DATE'
      case 'DATE': return this.dialect === 'sqlite' ? 'TEXT' : this.dialect === 'mssql' ? 'DATETIME2' : 'TIMESTAMP'
      case 'TIME': return this.dialect === 'sqlite' ? 'TEXT' : this.dialect === 'mssql' ? 'TIME' : 'TIME'
      case 'UUID': return this.dialect === 'postgres' ? 'UUID' : 'VARCHAR(36)'
      case 'JSON': case 'JSONB': return this.cfg.json
      case 'BLOB': return this.cfg.blob
      case 'ENUM': return 'VARCHAR(255)' // values enforced via CHECK
      case 'ARRAY': return this.dialect === 'postgres' ? 'TEXT[]' : 'TEXT'
      case 'RANGE': return this.dialect === 'postgres' ? 'INT4RANGE' : this.dialect === 'mysql' ? 'JSON' : this.dialect === 'mssql' ? 'NVARCHAR(MAX)' : 'TEXT'
      default: return 'VARCHAR(255)'
    }
  }

  private formatDefault(f: SchemaField): string {
    const v = f.properties.defaultValue!
    if (v === 'NOW()' || v === 'now()') return this.cfg.now
    if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(f.type)) {
      const n = Number(v); return isNaN(n) ? `'${v}'` : String(n)
    }
    if (f.type === 'BOOLEAN') {
      if (this.dialect === 'sqlite' || this.dialect === 'mssql') return v === 'true' ? '1' : '0'
      return v === 'true' ? 'TRUE' : 'FALSE'
    }
    return `'${v}'`
  }

  private topologicalSort(models: SchemaModel[]): SchemaModel[] {
    const idMap = new Map(models.map(m => [m.id, m]))
    const visited = new Set<string>()
    const sorted: SchemaModel[] = []
    const visit = (m: SchemaModel) => {
      if (visited.has(m.id)) return
      visited.add(m.id)
      for (const o of models) {
        for (const a of o.associations) {
          if (a.targetModelId === m.id && a.type !== 'M:N') {
            const dep = idMap.get(o.id)
            if (dep) visit(dep)
          }
        }
      }
      sorted.push(m)
    }
    for (const m of models) visit(m)
    return sorted
  }
}
