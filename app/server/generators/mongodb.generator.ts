import type { SchemaModel, SchemaField, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'

export class MongoDBGenerator implements CodeGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'mongodb',
    name: 'MongoDB JS (Mongoose)',
    description: 'Generates Mongoose schema definitions with type mapping, validation, and indexes',
    language: 'javascript',
    framework: 'Mongoose',
    category: 'MongoDB',
  }

  generate(models: SchemaModel[], _migrations?: MigrationEntry[]): GeneratorResult {
    const files: GeneratedFile[] = []
    const errors: string[] = []

    for (const model of models) {
      try {
        const content = this.generateModelFile(model, models)
        files.push({
          path: `models/${this.safeName(model.name)}.js`,
          content,
          language: 'javascript'
        })
      } catch (err: any) {
        errors.push(`Error generating model "${model.name}": ${err.message}`)
      }
    }

    files.push({
      path: 'index.js',
      content: this.generateIndexFile(models),
      language: 'javascript'
    })

    // Config & scaffolding
    files.push({ path: 'config/database.js', content: this.genDatabaseConfig(), language: 'javascript' })
    files.push({ path: 'package.json', content: this.genPackageJson(), language: 'json' })
    files.push({ path: '.env.example', content: this.genEnvExample(), language: 'text' })

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
      path: `models/${this.safeName(model.name)}.js`,
      content: this.generateModelFile(model, allModels),
      language: 'javascript'
    }]
  }

  // ── Model file ────────────────────────────────────────────

  private generateModelFile(model: SchemaModel, allModels: SchemaModel[]): string {
    const name = this.safeName(model.name)

    // Build schema fields (skip auto-increment integer PKs — Mongo uses _id)
    const userFields = model.fields.filter(f => {
      if (f.properties.primaryKey && f.properties.autoIncrement) return false
      if (f.name === '_id') return false
      if (f.type === 'VIRTUAL') return false
      return true
    })

    const fieldLines = userFields.map(f => this.buildField(f))

    // Build reference fields from associations
    for (const assoc of model.associations) {
      const target = allModels.find(m => m.id === assoc.targetModelId)
      if (!target) continue
      const tgt = this.safeName(target.name)

      if (assoc.type === '1:1') {
        fieldLines.push(`    ${tgt.charAt(0).toLowerCase() + tgt.slice(1)}: {\n      type: Schema.Types.ObjectId,\n      ref: '${tgt}',\n    }`)
      } else if (assoc.type === '1:M' || assoc.type === 'M:N') {
        fieldLines.push(`    ${tgt.charAt(0).toLowerCase() + tgt.slice(1)}s: [{\n      type: Schema.Types.ObjectId,\n      ref: '${tgt}',\n    }]`)
      }
    }

    const fieldsStr = fieldLines.join(',\n')

    // Build indexes for unique fields
    const indexLines: string[] = []
    for (const f of userFields) {
      if (f.properties.unique) {
        indexLines.push(`${name}Schema.index({ ${f.name}: 1 }, { unique: true });`)
      }
    }
    const indexBlock = indexLines.length > 0
      ? '\n' + indexLines.join('\n') + '\n'
      : ''

    // Build virtual fields
    const virtualFields = model.fields.filter(f => f.type === 'VIRTUAL')
    const virtualBlock = virtualFields.length > 0
      ? '\n' + virtualFields.map(f => `${name}Schema.virtual('${f.name}');`).join('\n') + '\n'
      : ''

    return `'use strict';

const { Schema, model } = require('mongoose');

const ${name}Schema = new Schema({
${fieldsStr}
}, {
  timestamps: true,
  collection: '${this.toSnakeCase(name)}',
});
${indexBlock}${virtualBlock}
module.exports = model('${name}', ${name}Schema);
`
  }

  private buildField(field: SchemaField): string {
    if (field.type === 'VIRTUAL') return ''
    const lines: string[] = []
    lines.push(`      type: ${this.mapType(field.type)}`)

    if (!field.properties.allowNull) {
      lines.push('      required: true')
    }

    // unique: true is handled via schema index (more reliable), not inline
    // but we can add it inline too for simple cases
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

  // ── Index / connection file ───────────────────────────────

  private generateIndexFile(models: SchemaModel[]): string {
    const imports = models
      .map(m => {
        const name = this.safeName(m.name)
        return `const ${name} = require('./models/${name}');`
      })
      .join('\n')

    const exports = models
      .map(m => `  ${this.safeName(m.name)}`)
      .join(',\n')

    return `'use strict';

const mongoose = require('mongoose');
${imports}

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/database';

async function connect(options = {}) {
  await mongoose.connect(uri, {
    ...options,
  });
  console.log('MongoDB connected successfully');
}

module.exports = {
  connect,
  mongoose,
${exports},
};
`
  }

  // ── Helpers ───────────────────────────────────────────────

  private genDatabaseConfig(): string {
    return `'use strict';

const mongoose = require('mongoose');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/app_development';

async function connect(options = {}) {
  const conn = await mongoose.connect(uri, options);
  console.log('MongoDB connected:', conn.connection.host);
  return conn;
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
`
  }

  private genPackageJson(): string {
    const pkg = {
      name: 'mongoose-models',
      version: '1.0.0',
      private: true,
      scripts: {
        start: 'node index.js',
        dev: 'nodemon index.js',
      },
      dependencies: {
        dotenv: '^16.4.0',
        mongoose: '^8.9.0',
      },
      devDependencies: {
        nodemon: '^3.1.0',
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

  private safeName(name: string): string {
    return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  }

  private toSnakeCase(name: string): string {
    return name
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/\s+/g, '_')
      .toLowerCase()
  }

  private mapType(type: string): string {
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

  private formatDefault(field: SchemaField): string {
    const val = field.properties.defaultValue
    if (!val) return "''"

    if (field.type === 'DATE' && (val === 'NOW()' || val === 'now()')) {
      return 'Date.now'
    }

    const numericTypes = ['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY']
    if (numericTypes.includes(field.type)) {
      const num = Number(val)
      return isNaN(num) ? `'${val}'` : String(num)
    }

    if (field.type === 'BOOLEAN') {
      return val === 'true' ? 'true' : 'false'
    }

    return `'${val}'`
  }
}
