import type { SchemaModel, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'
import type { CodeGenerator, GeneratorMetadata } from './types'

class GeneratorRegistry {
  private generators = new Map<string, CodeGenerator>()

  register(generator: CodeGenerator): void {
    this.generators.set(generator.metadata.id, generator)
  }

  get(id: string): CodeGenerator | undefined {
    return this.generators.get(id)
  }

  getAll(): GeneratorMetadata[] {
    return Array.from(this.generators.values()).map(g => g.metadata)
  }

  generate(generatorId: string, models: SchemaModel[], migrations?: MigrationEntry[]): GeneratorResult {
    const generator = this.generators.get(generatorId)
    if (!generator) {
      return {
        generatorId,
        generatorName: 'Unknown',
        files: [],
        errors: [`Generator '${generatorId}' not found`]
      }
    }
    return generator.generate(models, migrations)
  }

  previewModel(generatorId: string, model: SchemaModel, allModels: SchemaModel[]): GeneratedFile[] {
    const generator = this.generators.get(generatorId)
    if (!generator) return []
    return generator.previewModel(model, allModels)
  }
}

export const generatorRegistry = new GeneratorRegistry()
