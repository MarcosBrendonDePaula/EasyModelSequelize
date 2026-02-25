import type { SchemaModel, SchemaField, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'

type TypeORMDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql'

interface DialectCfg {
  name: string
  typeormType: string
  driverPkg: Record<string, string>
  connConfig: string
}

const DIALECTS: Record<TypeORMDialect, DialectCfg> = {
  postgres: {
    name: 'PostgreSQL', typeormType: 'postgres',
    driverPkg: { pg: '^8.13.0' },
    connConfig: `    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'app_development',`,
  },
  mysql: {
    name: 'MySQL', typeormType: 'mysql',
    driverPkg: { mysql2: '^3.11.0' },
    connConfig: `    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'app_development',`,
  },
  sqlite: {
    name: 'SQLite', typeormType: 'sqlite',
    driverPkg: { 'better-sqlite3': '^11.0.0' },
    connConfig: `    database: process.env.DB_STORAGE || './database.sqlite',`,
  },
  mssql: {
    name: 'SQL Server', typeormType: 'mssql',
    driverPkg: { tedious: '^18.6.0' },
    connConfig: `    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 1433,
    username: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
    database: process.env.DB_NAME || 'app_development',
    options: { encrypt: false, trustServerCertificate: true },`,
  },
}

export class TypeORMGenerator implements CodeGenerator {
  readonly metadata: GeneratorMetadata
  private readonly dialect: TypeORMDialect
  private readonly cfg: DialectCfg

  constructor(dialect: TypeORMDialect = 'postgres') {
    this.dialect = dialect
    this.cfg = DIALECTS[dialect]
    this.metadata = {
      id: dialect === 'postgres' ? 'typeorm' : `typeorm-${dialect}`,
      name: `TypeORM (${this.cfg.name})`,
      description: `TypeORM entities with decorators and ${this.cfg.name} DataSource`,
      language: 'typescript',
      framework: 'TypeORM',
      category: 'TypeORM',
      dialect: this.cfg.name,
    }
  }

  generate(models: SchemaModel[], _migrations?: MigrationEntry[]): GeneratorResult {
    const files: GeneratedFile[] = []
    const errors: string[] = []

    for (const model of models) {
      try {
        files.push({
          path: `src/entities/${this.safe(model.name)}.ts`,
          content: this.genEntity(model, models),
          language: 'typescript',
        })
      } catch (err: any) {
        errors.push(`Entity "${model.name}": ${err.message}`)
      }
    }

    files.push({ path: 'src/entities/index.ts', content: this.genEntitiesIndex(models), language: 'typescript' })
    files.push({ path: 'src/data-source.ts', content: this.genDataSource(models), language: 'typescript' })
    files.push({ path: 'package.json', content: this.genPackageJson(), language: 'json' })
    files.push({ path: 'tsconfig.json', content: this.genTsConfig(), language: 'json' })
    files.push({ path: '.env.example', content: this.genEnv(), language: 'text' })
    files.push({ path: 'db.json', content: JSON.stringify(models, null, 2), language: 'json' })

    return { generatorId: this.metadata.id, generatorName: this.metadata.name, files, errors }
  }

  previewModel(model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[] {
    return [{ path: `src/entities/${this.safe(model.name)}.ts`, content: this.genEntity(model, allModels), language: 'typescript' }]
  }

  // ── Entity ──────────────────────────────────────────────

  private genEntity(model: SchemaModel, allModels: SchemaModel[]): string {
    const name = this.safe(model.name)
    const table = this.snake(name)

    // Collect decorator imports
    const decorators = new Set<string>(['Entity', 'Column', 'CreateDateColumn', 'UpdateDateColumn'])
    const entityImports: string[] = []

    // Check what decorators we need
    for (const f of model.fields) {
      if (f.properties.primaryKey) {
        decorators.add(f.properties.autoIncrement ? 'PrimaryGeneratedColumn' : 'PrimaryColumn')
      }
      if (f.properties.unique && !f.properties.primaryKey) decorators.add('Column')
    }

    // Check associations
    for (const assoc of model.associations) {
      const t = allModels.find(m => m.id === assoc.targetModelId)
      if (!t) continue
      if (assoc.type === '1:1') { decorators.add('OneToOne'); decorators.add('JoinColumn') }
      if (assoc.type === '1:M') decorators.add('OneToMany')
      if (assoc.type === 'M:N') { decorators.add('ManyToMany'); decorators.add('JoinTable') }
      entityImports.push(this.safe(t.name))
    }

    // Incoming associations
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        if (assoc.type === '1:1' || assoc.type === '1:M') {
          decorators.add('ManyToOne'); decorators.add('JoinColumn')
          entityImports.push(this.safe(other.name))
        }
        if (assoc.type === 'M:N') {
          decorators.add('ManyToMany')
          entityImports.push(this.safe(other.name))
        }
      }
    }

    const uniqueImports = [...new Set(entityImports)]
    const importLines = uniqueImports.map(n => `import { ${n} } from './${n}';`).join('\n')
    const decImport = [...decorators].sort().join(', ')

    // Build fields
    const fieldLines: string[] = []

    for (const f of model.fields) {
      if (f.type === 'VIRTUAL') {
        fieldLines.push(`  // ${f.name} — virtual (computed) field, not stored in DB`)
      } else {
        fieldLines.push(this.genFieldDecorator(f))
      }
    }

    // Timestamps
    if (!model.fields.some(f => f.name === 'createdAt')) {
      fieldLines.push(`  @CreateDateColumn({ name: 'created_at' })\n  createdAt: Date;`)
    }
    if (!model.fields.some(f => f.name === 'updatedAt')) {
      fieldLines.push(`  @UpdateDateColumn({ name: 'updated_at' })\n  updatedAt: Date;`)
    }

    // Outgoing associations
    for (const assoc of model.associations) {
      const t = allModels.find(m => m.id === assoc.targetModelId)
      if (!t) continue
      const tgt = this.safe(t.name)
      const field = this.lcFirst(tgt)

      if (assoc.type === '1:1') {
        fieldLines.push(`  @OneToOne(() => ${tgt})\n  @JoinColumn()\n  ${field}: ${tgt};`)
      } else if (assoc.type === '1:M') {
        fieldLines.push(`  @OneToMany(() => ${tgt}, (${field}) => ${field}.${this.lcFirst(name)})\n  ${field}s: ${tgt}[];`)
      } else if (assoc.type === 'M:N') {
        fieldLines.push(`  @ManyToMany(() => ${tgt})\n  @JoinTable({ name: '${this.snake(name)}_${this.snake(tgt)}' })\n  ${field}s: ${tgt}[];`)
      }
    }

    // Incoming associations (belongsTo)
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        const otherName = this.safe(other.name)
        const field = this.lcFirst(otherName)

        if (assoc.type === '1:1' || assoc.type === '1:M') {
          fieldLines.push(`  @ManyToOne(() => ${otherName}, (${field}) => ${field}.${this.lcFirst(name)}s, { onDelete: 'CASCADE' })\n  @JoinColumn({ name: '${this.snake(otherName)}_id' })\n  ${field}: ${otherName};`)
          fieldLines.push(`  @Column({ name: '${this.snake(otherName)}_id', nullable: true })\n  ${field}Id: number;`)
        }
        if (assoc.type === 'M:N') {
          fieldLines.push(`  @ManyToMany(() => ${otherName}, (${field}) => ${field}.${this.lcFirst(name)}s)\n  ${field}s: ${otherName}[];`)
        }
      }
    }

    return `import { ${decImport} } from 'typeorm';
${importLines ? importLines + '\n' : ''}
@Entity('${table}')
export class ${name} {
${fieldLines.join('\n\n')}
}
`
  }

  private genFieldDecorator(f: SchemaField): string {
    const col = this.snake(f.name)
    const tsType = this.mapTsType(f)

    if (f.properties.primaryKey) {
      if (f.properties.autoIncrement) {
        return `  @PrimaryGeneratedColumn()\n  ${f.name}: ${tsType};`
      }
      if (f.type === 'UUID') {
        return `  @PrimaryGeneratedColumn('uuid')\n  ${f.name}: ${tsType};`
      }
      return `  @PrimaryColumn()\n  ${f.name}: ${tsType};`
    }

    const opts: string[] = []
    if (col !== f.name) opts.push(`name: '${col}'`)
    opts.push(`nullable: ${f.properties.allowNull}`)
    if (f.properties.unique) opts.push('unique: true')
    if (f.properties.defaultValue) opts.push(`default: ${this.formatDefault(f)}`)

    if ((f.type === 'STRING' || f.type === 'CHAR') && f.properties.length > 0) {
      opts.push(`length: ${f.properties.length}`)
    }

    if (f.type === 'DECIMAL' && (f.properties.precision > 0 || f.properties.scale > 0)) {
      opts.push(`precision: ${f.properties.precision || 10}`)
      opts.push(`scale: ${f.properties.scale || 2}`)
    }

    if (f.type === 'MONEY' && (f.properties.precision > 0 || f.properties.scale > 0)) {
      opts.push(`precision: ${f.properties.precision || 19}`)
      opts.push(`scale: ${f.properties.scale || 4}`)
    }

    if (f.type === 'ENUM' && f.properties.enumValues?.length) {
      opts.push(`type: 'enum'`)
      opts.push(`enum: [${f.properties.enumValues.map(v => `'${v}'`).join(', ')}]`)
    } else {
      const typeOpt = this.mapColumnType(f.type)
      if (typeOpt) opts.push(`type: '${typeOpt}'`)
    }

    const nullable = f.properties.allowNull ? '?' : ''

    return `  @Column({ ${opts.join(', ')} })\n  ${f.name}${nullable}: ${tsType};`
  }

  // ── Scaffolding ─────────────────────────────────────────

  private genEntitiesIndex(models: SchemaModel[]): string {
    return models.map(m => `export { ${this.safe(m.name)} } from './${this.safe(m.name)}';`).join('\n') + '\n'
  }

  private genDataSource(models: SchemaModel[]): string {
    const imports = models.map(m => this.safe(m.name)).join(', ')
    return `import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ${imports} } from './entities';

export const AppDataSource = new DataSource({
    type: '${this.cfg.typeormType}',
${this.cfg.connConfig}
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',
    entities: [${imports}],
    migrations: ['src/migrations/*.ts'],
});
`
  }

  private genPackageJson(): string {
    return JSON.stringify({
      name: 'typeorm-models',
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'tsc',
        'db:sync': 'npx tsx src/data-source.ts',
        'migration:generate': 'npx typeorm-ts-node-commonjs migration:generate src/migrations/migration -d src/data-source.ts',
        'migration:run': 'npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts',
        'migration:revert': 'npx typeorm-ts-node-commonjs migration:revert -d src/data-source.ts',
      },
      dependencies: {
        dotenv: '^16.4.0',
        typeorm: '^0.3.20',
        'reflect-metadata': '^0.2.0',
        ...this.cfg.driverPkg,
      },
      devDependencies: {
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
        emitDecoratorMetadata: true, experimentalDecorators: true,
        resolveJsonModule: true, declaration: true, sourceMap: true,
      },
      include: ['src/**/*'], exclude: ['node_modules', 'dist'],
    }, null, 2) + '\n'
  }

  private genEnv(): string {
    if (this.dialect === 'sqlite') return `DB_STORAGE=./database.sqlite\nNODE_ENV=development\n`
    const user = this.dialect === 'mssql' ? 'sa' : this.dialect === 'mysql' ? 'root' : 'postgres'
    const pass = this.dialect === 'mssql' ? 'YourStrong!Passw0rd' : this.dialect === 'mysql' ? 'root' : 'postgres'
    const port = this.dialect === 'mssql' ? 1433 : this.dialect === 'mysql' ? 3306 : 5432
    return `DB_HOST=127.0.0.1\nDB_PORT=${port}\nDB_NAME=app_development\nDB_USER=${user}\nDB_PASSWORD=${pass}\nNODE_ENV=development\n`
  }

  // ── Helpers ─────────────────────────────────────────────

  private safe(n: string) { return n.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') }
  private snake(n: string) { return n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/\s+/g, '_').toLowerCase() }
  private lcFirst(n: string) { const s = this.safe(n); return s.charAt(0).toLowerCase() + s.slice(1) }

  private mapTsType(f: SchemaField): string {
    switch (f.type) {
      case 'INTEGER': case 'SMALLINT': case 'BIGINT': case 'TINYINT': case 'FLOAT': case 'REAL': case 'DOUBLE': case 'DECIMAL': case 'MONEY': return 'number'
      case 'STRING': case 'TEXT': case 'CHAR': case 'UUID': case 'TIME': return 'string'
      case 'ENUM': return 'string' // typed via @Column enum option
      case 'BOOLEAN': return 'boolean'
      case 'DATE': case 'DATEONLY': return 'Date'
      case 'JSON': case 'JSONB': return 'Record<string, unknown>'
      case 'BLOB': return 'Buffer'
      case 'ARRAY': return 'string[]'
      case 'RANGE': return 'string'
      case 'VIRTUAL': return 'unknown'
      default: return 'string'
    }
  }

  private mapColumnType(t: string): string | null {
    switch (t) {
      case 'TEXT': return 'text'
      case 'SMALLINT': return 'smallint'
      case 'BIGINT': return 'bigint'
      case 'TINYINT': return this.dialect === 'postgres' ? 'smallint' : 'tinyint'
      case 'FLOAT': case 'REAL': return 'float'
      case 'DOUBLE': return 'double precision'
      case 'DECIMAL': return 'decimal'
      case 'MONEY': return this.dialect === 'postgres' || this.dialect === 'mssql' ? 'money' : 'decimal'
      case 'UUID': return 'uuid'
      case 'CHAR': return 'char'
      case 'TIME': return 'time'
      case 'JSON': case 'JSONB': return this.dialect === 'postgres' ? 'jsonb' : 'json'
      case 'BLOB': return this.dialect === 'postgres' ? 'bytea' : this.dialect === 'mssql' ? 'varbinary' : 'blob'
      case 'DATEONLY': return 'date'
      case 'ARRAY': return this.dialect === 'postgres' ? 'jsonb' : 'simple-json'
      case 'RANGE': return this.dialect === 'postgres' ? 'int4range' : 'simple-json'
      default: return null
    }
  }

  private formatDefault(f: SchemaField): string {
    const v = f.properties.defaultValue!
    if (v === 'NOW()' || v === 'now()') return `() => 'NOW()'`
    if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(f.type)) {
      const n = Number(v); return isNaN(n) ? `'${v}'` : String(n)
    }
    if (f.type === 'BOOLEAN') return v === 'true' ? 'true' : 'false'
    return `'${v}'`
  }
}
