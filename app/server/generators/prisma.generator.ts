import type { SchemaModel, SchemaField, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'

type PrismaDialect = 'postgresql' | 'mysql' | 'sqlite' | 'sqlserver' | 'mongodb'

interface PrismaDialectCfg {
  name: string
  provider: string
  url: string
  deps: Record<string, string>
}

const PRISMA_DIALECTS: Record<PrismaDialect, PrismaDialectCfg> = {
  postgresql: { name: 'PostgreSQL', provider: 'postgresql', url: 'postgresql://postgres:postgres@localhost:5432/app_dev', deps: {} },
  mysql:      { name: 'MySQL', provider: 'mysql', url: 'mysql://root:root@localhost:3306/app_dev', deps: {} },
  sqlite:     { name: 'SQLite', provider: 'sqlite', url: 'file:./dev.db', deps: {} },
  sqlserver:  { name: 'SQL Server', provider: 'sqlserver', url: 'sqlserver://localhost:1433;database=app_dev;user=sa;password=YourStrong!Passw0rd;encrypt=true;trustServerCertificate=true', deps: {} },
  mongodb:    { name: 'MongoDB', provider: 'mongodb', url: 'mongodb://localhost:27017/app_dev', deps: {} },
}

export class PrismaGenerator implements CodeGenerator {
  readonly metadata: GeneratorMetadata
  private readonly dialect: PrismaDialect
  private readonly cfg: PrismaDialectCfg

  constructor(dialect: PrismaDialect = 'postgresql') {
    this.dialect = dialect
    this.cfg = PRISMA_DIALECTS[dialect]
    this.metadata = {
      id: dialect === 'postgresql' ? 'prisma' : `prisma-${dialect}`,
      name: `Prisma (${this.cfg.name})`,
      description: `Prisma ORM schema with ${this.cfg.name} datasource`,
      language: 'typescript',
      framework: 'Prisma',
      category: 'Prisma',
      dialect: this.cfg.name,
    }
  }

  generate(models: SchemaModel[], _migrations?: MigrationEntry[]): GeneratorResult {
    const files: GeneratedFile[] = []
    const errors: string[] = []

    try {
      files.push({ path: 'prisma/schema.prisma', content: this.genSchema(models), language: 'prisma' })
    } catch (err: any) {
      errors.push(`Schema: ${err.message}`)
    }

    files.push({ path: '.env', content: this.genEnv(), language: 'text' })
    files.push({ path: 'package.json', content: this.genPackageJson(), language: 'json' })
    files.push({ path: 'tsconfig.json', content: this.genTsConfig(), language: 'json' })
    files.push({ path: 'src/client.ts', content: this.genClient(), language: 'typescript' })
    files.push({ path: 'db.json', content: JSON.stringify(models, null, 2), language: 'json' })

    return { generatorId: this.metadata.id, generatorName: this.metadata.name, files, errors }
  }

  previewModel(model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[] {
    return [{ path: 'prisma/schema.prisma', content: this.genModelBlock(model, allModels), language: 'prisma' }]
  }

  // ── Schema ──────────────────────────────────────────────

  private genSchema(models: SchemaModel[]): string {
    const header = `// Prisma Schema — auto-generated
// https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${this.cfg.provider}"
  url      = env("DATABASE_URL")
}
`
    const modelBlocks = models.map(m => this.genModelBlock(m, models)).join('\n')

    // Collect enum blocks
    const enumBlocks = this.genEnumBlocks(models)

    return header + '\n' + modelBlocks + (enumBlocks ? '\n' + enumBlocks : '')
  }

  private genModelBlock(model: SchemaModel, allModels: SchemaModel[]): string {
    const name = this.safe(model.name)
    const table = this.snake(name)
    const lines: string[] = []

    // Fields
    for (const f of model.fields) {
      if (f.type === 'VIRTUAL') {
        lines.push(`  // ${f.name} — virtual (computed) field, not stored in DB`)
      } else {
        lines.push('  ' + this.genField(f, model.name))
      }
    }

    // Timestamps (if not already in fields)
    if (!model.fields.some(f => f.name === 'createdAt')) {
      lines.push('  createdAt DateTime @default(now()) @map("created_at")')
    }
    if (!model.fields.some(f => f.name === 'updatedAt')) {
      lines.push('  updatedAt DateTime @updatedAt @map("updated_at")')
    }

    // Relations — outgoing (this model has associations → hasOne / hasMany side)
    for (const assoc of model.associations) {
      const target = allModels.find(m => m.id === assoc.targetModelId)
      if (!target) continue
      const tgt = this.safe(target.name)

      if (assoc.type === '1:1') {
        // Owner side: FK + @relation
        const fkField = this.lcFirst(tgt) + 'Id'
        const fkCol = this.snake(tgt) + '_id'
        if (!model.fields.some(f => f.name === fkField)) {
          lines.push(`  ${fkField} Int? @unique @map("${fkCol}")`)
        }
        lines.push(`  ${this.lcFirst(tgt)} ${tgt}? @relation(fields: [${fkField}], references: [id])`)
      } else if (assoc.type === '1:M') {
        lines.push(`  ${this.lcFirst(tgt)}s ${tgt}[]`)
      } else if (assoc.type === 'M:N') {
        lines.push(`  ${this.lcFirst(tgt)}s ${tgt}[]`)
      }
    }

    // Relations — incoming (belongsTo side)
    for (const other of allModels) {
      if (other.id === model.id) continue
      for (const assoc of other.associations) {
        if (assoc.targetModelId !== model.id) continue
        const otherName = this.safe(other.name)

        if (assoc.type === '1:1') {
          // Inverse side of 1:1 — no FK here, just the relation field
          lines.push(`  ${this.lcFirst(otherName)} ${otherName}?`)
        } else if (assoc.type === '1:M') {
          // belongsTo side: FK + @relation
          const fkField = this.lcFirst(otherName) + 'Id'
          const fkCol = this.snake(otherName) + '_id'
          if (!model.fields.some(f => f.name === fkField)) {
            lines.push(`  ${fkField} Int? @map("${fkCol}")`)
          }
          lines.push(`  ${this.lcFirst(otherName)} ${otherName}? @relation(fields: [${fkField}], references: [id])`)
        } else if (assoc.type === 'M:N') {
          lines.push(`  ${this.lcFirst(otherName)}s ${otherName}[]`)
        }
      }
    }

    const mapLine = table !== name ? `\n  @@map("${table}")` : ''

    return `model ${name} {\n${lines.join('\n')}${mapLine}\n}\n`
  }

  private genField(f: SchemaField, modelName?: string): string {
    const parts: string[] = [f.name]

    // Type
    let prismaType: string
    if (f.type === 'ENUM' && f.properties.enumValues?.length && modelName) {
      prismaType = this.enumName(modelName, f.name)
    } else {
      prismaType = this.mapType(f.type)
    }
    if (f.properties.allowNull && !f.properties.primaryKey) prismaType += '?'
    parts.push(prismaType)

    // Attributes
    if (f.properties.primaryKey) {
      parts.push('@id')
      if (f.properties.autoIncrement) parts.push('@default(autoincrement())')
    }
    if (f.properties.unique && !f.properties.primaryKey) parts.push('@unique')
    if (f.properties.defaultValue && !f.properties.primaryKey) {
      parts.push(`@default(${this.formatDefault(f)})`)
    }
    if (f.type === 'UUID' && !f.properties.defaultValue) {
      parts.push('@default(uuid())')
    }

    // Column mapping
    const col = this.snake(f.name)
    if (col !== f.name) parts.push(`@map("${col}")`)

    // DB-specific type annotations
    if (f.type === 'STRING' && f.properties.length > 0) {
      parts.push(`@db.VarChar(${f.properties.length})`)
    } else if (f.type === 'CHAR' && f.properties.length > 0) {
      parts.push(`@db.Char(${f.properties.length})`)
    } else if (f.type === 'DECIMAL' && (f.properties.precision > 0 || f.properties.scale > 0)) {
      const p = f.properties.precision || 10
      const s = f.properties.scale || 2
      parts.push(`@db.Decimal(${p}, ${s})`)
    } else if (f.type === 'MONEY' && (f.properties.precision > 0 || f.properties.scale > 0)) {
      const p = f.properties.precision || 19
      const s = f.properties.scale || 4
      parts.push(`@db.Decimal(${p}, ${s})`)
    }

    return parts.join(' ')
  }

  // ── Scaffolding ─────────────────────────────────────────

  private genEnv(): string {
    return `DATABASE_URL="${this.cfg.url}"\n`
  }

  private genClient(): string {
    return `import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default prisma
`
  }

  private genPackageJson(): string {
    const pkg = {
      name: 'prisma-models',
      version: '1.0.0',
      private: true,
      scripts: {
        'db:push': 'npx prisma db push',
        'db:pull': 'npx prisma db pull',
        'db:migrate': 'npx prisma migrate dev',
        'db:migrate:prod': 'npx prisma migrate deploy',
        'db:generate': 'npx prisma generate',
        'db:studio': 'npx prisma studio',
        'db:seed': 'npx tsx prisma/seed.ts',
        build: 'tsc',
      },
      dependencies: {
        '@prisma/client': '^6.0.0',
        ...this.cfg.deps,
      },
      devDependencies: {
        prisma: '^6.0.0',
        typescript: '^5.3.0',
        tsx: '^4.7.0',
        '@types/node': '^20.11.0',
      },
    }
    return JSON.stringify(pkg, null, 2) + '\n'
  }

  private genTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020', module: 'commonjs', lib: ['ES2020'],
        outDir: './dist', rootDir: './src', strict: true,
        esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true,
        resolveJsonModule: true, declaration: true, sourceMap: true,
      },
      include: ['src/**/*'], exclude: ['node_modules', 'dist'],
    }, null, 2) + '\n'
  }

  // ── Enum blocks ────────────────────────────────────────

  private enumName(modelName: string, fieldName: string): string {
    return this.safe(modelName) + this.safe(fieldName).charAt(0).toUpperCase() + this.safe(fieldName).slice(1)
  }

  private genEnumBlocks(models: SchemaModel[]): string {
    const blocks: string[] = []
    for (const m of models) {
      for (const f of m.fields) {
        if (f.type === 'ENUM' && f.properties.enumValues?.length) {
          const name = this.enumName(m.name, f.name)
          const values = f.properties.enumValues.map(v => `  ${v}`).join('\n')
          blocks.push(`enum ${name} {\n${values}\n}\n`)
        }
      }
    }
    return blocks.join('\n')
  }

  // ── Helpers ─────────────────────────────────────────────

  private safe(n: string) { return n.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') }
  private snake(n: string) { return n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/\s+/g, '_').toLowerCase() }
  private lcFirst(n: string) { const s = this.safe(n); return s.charAt(0).toLowerCase() + s.slice(1) }

  private mapType(t: string): string {
    switch (t) {
      case 'INTEGER': case 'SMALLINT': case 'TINYINT': return 'Int'
      case 'BIGINT': return 'BigInt'
      case 'FLOAT': case 'REAL': case 'DOUBLE': return 'Float'
      case 'DECIMAL': case 'MONEY': return 'Decimal'
      case 'STRING': case 'TEXT': case 'CHAR': case 'TIME': return 'String'
      case 'BOOLEAN': return 'Boolean'
      case 'DATE': case 'DATEONLY': return 'DateTime'
      case 'UUID': return 'String'
      case 'JSON': case 'JSONB': case 'RANGE': return 'Json'
      case 'BLOB': return 'Bytes'
      case 'ARRAY': return this.dialect === 'postgresql' ? 'String[]' : 'Json'
      default: return 'String'
    }
  }

  private formatDefault(f: SchemaField): string {
    const v = f.properties.defaultValue!
    if (v === 'NOW()' || v === 'now()') return 'now()'
    if (f.type === 'BOOLEAN') return v === 'true' ? 'true' : 'false'
    if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(f.type)) {
      const n = Number(v); return isNaN(n) ? `"${v}"` : String(n)
    }
    return `"${v}"`
  }
}
