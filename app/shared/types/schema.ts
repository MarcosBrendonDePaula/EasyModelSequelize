// Schema types shared between server generators, Live Component state, and client UI

export const FIELD_TYPES = [
  'STRING', 'TEXT', 'CHAR', 'BOOLEAN',
  'TINYINT', 'INTEGER', 'SMALLINT', 'BIGINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY',
  'DATE', 'DATEONLY', 'TIME',
  'JSON', 'JSONB', 'BLOB',
  'UUID', 'ENUM', 'ARRAY', 'RANGE',
  'VIRTUAL'
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export const ASSOCIATION_TYPES = ['1:1', '1:M', 'M:N'] as const
export type AssociationType = (typeof ASSOCIATION_TYPES)[number]

export interface FieldProperties {
  primaryKey: boolean
  allowNull: boolean
  autoIncrement: boolean
  unique: boolean
  defaultValue: string
  enumValues: string[]
  length: number        // VARCHAR(length) — 0 = use ORM default
  precision: number     // DECIMAL(precision, scale) — 0 = use ORM default
  scale: number         // DECIMAL(precision, scale) — 0 = use ORM default
}

export interface SchemaField {
  id: string
  name: string
  type: FieldType
  properties: FieldProperties
}

export interface SchemaAssociation {
  id: string
  type: AssociationType
  targetModelId: string
  alias?: string
  through?: string
}

export interface SchemaModel {
  id: string
  name: string
  fields: SchemaField[]
  associations: SchemaAssociation[]
  position?: { x: number; y: number }
  color?: string
}

// ── Migration tracking ─────────────────────────────────────

export type MigrationOpType =
  | 'createTable'
  | 'dropTable'
  | 'renameTable'
  | 'addColumn'
  | 'removeColumn'
  | 'changeColumn'

export interface MigrationOp {
  type: MigrationOpType
  table: string
  column?: string
  previousName?: string
  field?: SchemaField
  previousField?: SchemaField
  reference?: {
    model: string
    key: string
    onUpdate?: string
    onDelete?: string
  }
}

export interface MigrationEntry {
  id: string
  timestamp: number
  description: string
  ops: MigrationOp[]
  snapshotHash: string
}

// ── Database schema (export/import) ────────────────────────

export interface DatabaseSchema {
  id: string
  name: string
  models: SchemaModel[]
  migrations?: MigrationEntry[]
  createdAt: number
  updatedAt: number
}

export interface GeneratedFile {
  path: string
  content: string
  language: string
}

export interface GeneratorResult {
  generatorId: string
  generatorName: string
  files: GeneratedFile[]
  errors: string[]
}

export interface ValidationError {
  modelId?: string
  fieldId?: string
  associationId?: string
  message: string
  severity: 'error' | 'warning'
}

export function createDefaultField(name = ''): SchemaField {
  return {
    id: crypto.randomUUID(),
    name,
    type: 'STRING',
    properties: {
      primaryKey: false,
      allowNull: true,
      autoIncrement: false,
      unique: false,
      defaultValue: '',
      enumValues: [],
      length: 0,
      precision: 0,
      scale: 0
    }
  }
}

export function nameToColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 45%)`
}

export function createDefaultModel(name = 'NewModel'): SchemaModel {
  return {
    id: crypto.randomUUID(),
    name,
    color: nameToColor(name),
    fields: [
      {
        id: crypto.randomUUID(),
        name: 'id',
        type: 'INTEGER',
        properties: {
          primaryKey: true,
          allowNull: false,
          autoIncrement: true,
          unique: true,
          defaultValue: '',
          enumValues: [],
          length: 0,
          precision: 0,
          scale: 0
        }
      }
    ],
    associations: [],
    position: { x: 0, y: 0 }
  }
}
