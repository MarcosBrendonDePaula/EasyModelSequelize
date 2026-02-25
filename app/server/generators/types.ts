import type { SchemaModel, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'

export interface GeneratorMetadata {
  id: string
  name: string
  description: string
  language: string
  framework: string
  category?: string
  dialect?: string
}

export interface CodeGenerator {
  readonly metadata: GeneratorMetadata
  generate(models: SchemaModel[], migrations?: MigrationEntry[]): GeneratorResult
  previewModel(model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[]
}
