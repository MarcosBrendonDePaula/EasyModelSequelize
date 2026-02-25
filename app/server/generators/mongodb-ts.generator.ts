import type { SchemaModel, SchemaField, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'

export class MongoDBTSGenerator implements CodeGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'mongodb-ts',
    name: 'MongoDB TS (Mongoose)',
    description: 'Generates Mongoose schemas with TypeScript interfaces, typed models, virtuals, and full TS project scaffolding',
    language: 'typescript',
    framework: 'Mongoose',
    category: 'MongoDB',
  }

  // ════════════════════════════════════════════════════════════
  //  Public API
  // ════════════════════════════════════════════════════════════

  generate(models: SchemaModel[], _migrations?: MigrationEntry[]): GeneratorResult {
    const files: GeneratedFile[] = []
    const errors: string[] = []

    // ── Model files ─────────────────────────────────────────
    for (const model of models) {
      try {
        files.push({
          path: `src/models/${this.safeName(model.name)}.ts`,
          content: this.genModelFile(model, models),
          language: 'typescript'
        })
      } catch (err: any) {
        errors.push(`Model "${model.name}": ${err.message}`)
      }
    }

    // src/models/index.ts — re-exports + connection
    files.push({
      path: 'src/models/index.ts',
      content: this.genModelsIndex(models),
      language: 'typescript'
    })

    // ── Config & scaffolding ────────────────────────────────
    files.push({ path: 'src/config/database.ts', content: this.genDatabaseConfig(), language: 'typescript' })
    files.push({ path: 'tsconfig.json', content: this.genTsConfig(), language: 'json' })
    files.push({ path: 'package.json', content: this.genPackageJson(), language: 'json' })
    files.push({ path: '.env.example', content: this.genEnvExample(), language: 'text' })

    // ── Schema backup ───────────────────────────────────────
    files.push({
      path: 'db.json',
      content: JSON.stringify(models, null, 2),
      language: 'json'
    })

    return {
      generatorId: this.metadata.id,
      generatorName: this.metadata.name,
      files,
      errors
    }
  }

  previewModel(model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[] {
    return [{
      path: `src/models/${this.safeName(model.name)}.ts`,
      content: this.genModelFile(model, allModels),
      language: 'typescript'
    }]
  }

  // ════════════════════════════════════════════════════════════
  //  Model file — interface + schema + typed model export
  // ════════════════════════════════════════════════════════════

  private genModelFile(model: SchemaModel, allModels: SchemaModel[]): string {
    const name = this.safeName(model.name)

    // Filter fields (skip auto-increment PKs — Mongo uses _id)
    const userFields = model.fields.filter(f => {
      if (f.properties.primaryKey && f.properties.autoIncrement) return false
      if (f.name === '_id') return false
      if (f.type === 'VIRTUAL') return false
      return true
    })

    // ── TypeScript interface ──────────────────────────────
    // Include all fields including VIRTUAL for interface
    const allFieldsForInterface = model.fields.filter(f => {
      if (f.properties.primaryKey && f.properties.autoIncrement) return false
      if (f.name === '_id') return false
      return true
    })
    const interfaceLines = allFieldsForInterface.map(f => {
      const optional = f.properties.allowNull || !!f.properties.defaultValue
      return `  ${f.name}${optional ? '?' : ''}: ${this.mapTsType(f)};`
    })

    // Add reference fields to interface
    const refInterfaceLines: string[] = []
    for (const assoc of model.associations) {
      const target = allModels.find(m => m.id === assoc.targetModelId)
      if (!target) continue
      const tgt = this.safeName(target.name)
      const fieldName = tgt.charAt(0).toLowerCase() + tgt.slice(1)

      if (assoc.type === '1:1') {
        refInterfaceLines.push(`  ${fieldName}?: Types.ObjectId;`)
      } else if (assoc.type === '1:M' || assoc.type === 'M:N') {
        refInterfaceLines.push(`  ${fieldName}s?: Types.ObjectId[];`)
      }
    }

    // ── Schema definition lines ───────────────────────────
    const fieldLines = userFields.map(f => this.buildSchemaField(f))

    // Reference fields in schema
    const refSchemaLines: string[] = []
    for (const assoc of model.associations) {
      const target = allModels.find(m => m.id === assoc.targetModelId)
      if (!target) continue
      const tgt = this.safeName(target.name)
      const fieldName = tgt.charAt(0).toLowerCase() + tgt.slice(1)

      if (assoc.type === '1:1') {
        refSchemaLines.push(`    ${fieldName}: {\n      type: Schema.Types.ObjectId,\n      ref: '${tgt}',\n    }`)
      } else if (assoc.type === '1:M' || assoc.type === 'M:N') {
        refSchemaLines.push(`    ${fieldName}s: [{\n      type: Schema.Types.ObjectId,\n      ref: '${tgt}',\n    }]`)
      }
    }

    const allFieldLines = [...fieldLines, ...refSchemaLines].join(',\n')

    // ── Indexes ───────────────────────────────────────────
    const indexLines: string[] = []
    for (const f of userFields) {
      if (f.properties.unique) {
        indexLines.push(`${name}Schema.index({ ${f.name}: 1 }, { unique: true });`)
      }
    }
    const indexBlock = indexLines.length > 0
      ? '\n' + indexLines.join('\n') + '\n'
      : ''

    // ── Virtual fields ────────────────────────────────────
    const virtualFields = model.fields.filter(f => f.type === 'VIRTUAL')
    const virtualBlock = virtualFields.length > 0
      ? '\n' + virtualFields.map(f => `${name}Schema.virtual('${f.name}');`).join('\n') + '\n'
      : ''

    // ── Methods type (virtuals, instance methods) ─────────
    const hasRefs = model.associations.length > 0

    // Build full interface lines
    const allInterfaceLines = [...interfaceLines, ...refInterfaceLines].join('\n')

    return `import { Schema, model, Types, type Document } from 'mongoose';

// ── Interface ────────────────────────────────────────────

export interface I${name} {
${allInterfaceLines}
}

export interface I${name}Document extends I${name}, Document {}

// ── Schema ───────────────────────────────────────────────

const ${name}Schema = new Schema<I${name}Document>(
  {
${allFieldLines}
  },
  {
    timestamps: true,
    collection: '${this.toSnakeCase(name)}',
  },
);
${indexBlock}${virtualBlock}
// ── Model ────────────────────────────────────────────────

const ${name}Model = model<I${name}Document>('${name}', ${name}Schema);

export { ${name}Schema };
export default ${name}Model;
`
  }

  private buildSchemaField(field: SchemaField): string {
    if (field.type === 'VIRTUAL') return ''
    const lines: string[] = []
    lines.push(`      type: ${this.mapMongoType(field.type)}`)

    if (!field.properties.allowNull) {
      lines.push('      required: true')
    }

    if (field.properties.unique && !field.properties.primaryKey) {
      lines.push('      unique: true')
    }

    if (field.properties.defaultValue) {
      lines.push(`      default: ${this.formatDefault(field)}`)
    }

    // Add trim for strings
    if (['STRING', 'TEXT', 'CHAR'].includes(field.type)) {
      lines.push('      trim: true')
    }

    if (field.type === 'ENUM' && field.properties.enumValues?.length) {
      lines.push(`      enum: [${field.properties.enumValues.map(v => `'${v}'`).join(', ')}]`)
    }

    return `    ${field.name}: {\n${lines.join(',\n')},\n    }`
  }

  // ════════════════════════════════════════════════════════════
  //  models/index.ts — connection + re-exports
  // ════════════════════════════════════════════════════════════

  private genModelsIndex(models: SchemaModel[]): string {
    const imports = models
      .map(m => {
        const name = this.safeName(m.name)
        return `import ${name}Model, { type I${name}, type I${name}Document } from './${name}';`
      })
      .join('\n')

    const modelEntries = models
      .map(m => `  ${this.safeName(m.name)}: ${this.safeName(m.name)}Model`)
      .join(',\n')

    const reExports = models
      .map(m => {
        const name = this.safeName(m.name)
        return `export { default as ${name}Model, type I${name}, type I${name}Document } from './${name}';`
      })
      .join('\n')

    return `import { connect } from '../config/database';
${imports}

// ── All models ───────────────────────────────────────────

const models = {
${modelEntries},
};

export type Models = typeof models;

// ── Connect & export ─────────────────────────────────────

export { connect, models };
${reExports}
`
  }

  // ════════════════════════════════════════════════════════════
  //  Config / scaffolding
  // ════════════════════════════════════════════════════════════

  private genDatabaseConfig(): string {
    return `import mongoose from 'mongoose';

interface DbConfig {
  uri: string;
  options?: mongoose.ConnectOptions;
}

const config: Record<string, DbConfig> = {
  development: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/app_development',
    options: {},
  },
  test: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/app_test',
    options: {},
  },
  production: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/app_production',
    options: {},
  },
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

export async function connect(): Promise<typeof mongoose> {
  const conn = await mongoose.connect(dbConfig.uri, dbConfig.options);
  console.log(\`MongoDB connected: \${conn.connection.host}\`);
  return conn;
}

export async function disconnect(): Promise<void> {
  await mongoose.disconnect();
}

export { mongoose, dbConfig };
export default config;
`
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
      name: 'mongoose-models-ts',
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'tsc',
        start: 'node dist/models/index.js',
        dev: 'ts-node src/models/index.ts',
      },
      dependencies: {
        dotenv: '^16.4.0',
        mongoose: '^8.9.0',
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        'ts-node': '^10.9.0',
        typescript: '^5.3.0',
      },
    }
    return JSON.stringify(pkg, null, 2) + '\n'
  }

  private genEnvExample(): string {
    return `# MongoDB
MONGO_URI=mongodb://localhost:27017/app_development

# Environment
NODE_ENV=development
`
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
      .toLowerCase()
  }

  private mapMongoType(type: string): string {
    switch (type) {
      case 'INTEGER':
      case 'SMALLINT':
      case 'BIGINT':
      case 'TINYINT':
      case 'FLOAT':
      case 'REAL':
      case 'DOUBLE':
      case 'DECIMAL':
      case 'MONEY':
        return 'Number'
      case 'STRING':
      case 'TEXT':
      case 'CHAR':
      case 'UUID':
      case 'ENUM':
      case 'TIME':
        return 'String'
      case 'BOOLEAN':
        return 'Boolean'
      case 'DATE':
      case 'DATEONLY':
        return 'Date'
      case 'JSON':
      case 'JSONB':
      case 'RANGE':
        return 'Schema.Types.Mixed'
      case 'BLOB':
        return 'Buffer'
      case 'ARRAY':
        return '[Schema.Types.Mixed]'
      default:
        return 'String'
    }
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
      case 'RANGE':
        return 'Record<string, unknown>'
      case 'BLOB':
        return 'Buffer'
      case 'ARRAY':
        return 'unknown[]'
      case 'VIRTUAL':
        return 'unknown'
      default:
        return 'unknown'
    }
  }

  private formatDefault(field: SchemaField): string {
    const val = field.properties.defaultValue
    if (!val) return "''"

    const numericTypes = ['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY']
    if (numericTypes.includes(field.type)) {
      const num = Number(val)
      return isNaN(num) ? `'${val}'` : String(num)
    }

    if (field.type === 'BOOLEAN') {
      return val === 'true' ? 'true' : 'false'
    }

    if (field.type === 'DATE' && val === 'NOW()') {
      return 'Date.now'
    }

    return `'${val}'`
  }
}
