import type { SchemaModel, ValidationError } from '@shared/types/schema'

export function validateSchema(models: SchemaModel[]): ValidationError[] {
  const errors: ValidationError[] = []
  const modelNames = new Set<string>()

  for (const model of models) {
    // Empty model name
    if (!model.name.trim()) {
      errors.push({
        modelId: model.id,
        message: 'Model name cannot be empty',
        severity: 'error'
      })
    }

    // Duplicate model names
    const normalizedName = model.name.trim().toLowerCase()
    if (normalizedName && modelNames.has(normalizedName)) {
      errors.push({
        modelId: model.id,
        message: `Duplicate model name: "${model.name}"`,
        severity: 'error'
      })
    }
    modelNames.add(normalizedName)

    // Model without fields
    if (model.fields.length === 0) {
      errors.push({
        modelId: model.id,
        message: `Model "${model.name}" has no fields`,
        severity: 'warning'
      })
    }

    // Field validations
    const fieldNames = new Set<string>()
    for (const field of model.fields) {
      if (!field.name.trim()) {
        errors.push({
          modelId: model.id,
          fieldId: field.id,
          message: 'Field name cannot be empty',
          severity: 'error'
        })
      }

      const normalizedFieldName = field.name.trim().toLowerCase()
      if (normalizedFieldName && fieldNames.has(normalizedFieldName)) {
        errors.push({
          modelId: model.id,
          fieldId: field.id,
          message: `Duplicate field name: "${field.name}" in model "${model.name}"`,
          severity: 'error'
        })
      }
      fieldNames.add(normalizedFieldName)

      // AutoIncrement only on numeric types
      if (field.properties.autoIncrement && !isNumericType(field.type)) {
        errors.push({
          modelId: model.id,
          fieldId: field.id,
          message: `AutoIncrement is only valid on numeric types (field "${field.name}")`,
          severity: 'warning'
        })
      }

      // ENUM without values
      if (field.type === 'ENUM' && (!field.properties.enumValues || field.properties.enumValues.length === 0)) {
        errors.push({
          modelId: model.id,
          fieldId: field.id,
          message: `ENUM field "${field.name}" has no values defined`,
          severity: 'warning'
        })
      }

      // VIRTUAL field warnings
      if (field.type === 'VIRTUAL') {
        if (field.properties.primaryKey) {
          errors.push({
            modelId: model.id,
            fieldId: field.id,
            message: `VIRTUAL field "${field.name}" cannot be a primary key`,
            severity: 'error'
          })
        }
        if (field.properties.autoIncrement) {
          errors.push({
            modelId: model.id,
            fieldId: field.id,
            message: `VIRTUAL field "${field.name}" cannot have autoIncrement`,
            severity: 'error'
          })
        }
        if (field.properties.unique) {
          errors.push({
            modelId: model.id,
            fieldId: field.id,
            message: `VIRTUAL field "${field.name}" is not stored in DB — unique has no effect`,
            severity: 'warning'
          })
        }
      }
    }

    // Association validations
    for (const assoc of model.associations) {
      const target = models.find(m => m.id === assoc.targetModelId)
      if (!target) {
        errors.push({
          modelId: model.id,
          associationId: assoc.id,
          message: `Association references a non-existent model`,
          severity: 'error'
        })
      }

      // Self-referencing M:N warning
      if (assoc.targetModelId === model.id && assoc.type === 'M:N') {
        errors.push({
          modelId: model.id,
          associationId: assoc.id,
          message: `Self-referencing M:N association on "${model.name}" - ensure a through table is specified`,
          severity: 'warning'
        })
      }
    }
  }

  return errors
}

function isNumericType(type: string): boolean {
  return ['TINYINT', 'INTEGER', 'SMALLINT', 'BIGINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(type)
}
