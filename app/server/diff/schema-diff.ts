import type { SchemaModel, SchemaField, MigrationOp } from '@shared/types/schema'

/**
 * Compare two schema states and produce a list of migration operations.
 * Models are matched by id; fields within a model are matched by id.
 */
export function diffSchemas(
  before: SchemaModel[],
  after: SchemaModel[]
): { ops: MigrationOp[]; description: string } {
  const ops: MigrationOp[] = []
  const descriptions: string[] = []

  const beforeMap = new Map(before.map(m => [m.id, m]))
  const afterMap = new Map(after.map(m => [m.id, m]))

  // ── Added models ──────────────────────────────────────────
  for (const model of after) {
    if (!beforeMap.has(model.id)) {
      ops.push({
        type: 'createTable',
        table: toSnakeCase(model.name),
        field: undefined,
      })
      // Add each field as an addColumn within the createTable context
      for (const field of model.fields) {
        ops.push({
          type: 'addColumn',
          table: toSnakeCase(model.name),
          column: toSnakeCase(field.name),
          field: structuredClone(field),
        })
      }
      descriptions.push(`Create table ${model.name}`)
    }
  }

  // ── Removed models ────────────────────────────────────────
  for (const model of before) {
    if (!afterMap.has(model.id)) {
      ops.push({
        type: 'dropTable',
        table: toSnakeCase(model.name),
      })
      descriptions.push(`Drop table ${model.name}`)
    }
  }

  // ── Changed models (same id in both) ─────────────────────
  for (const afterModel of after) {
    const beforeModel = beforeMap.get(afterModel.id)
    if (!beforeModel) continue

    const tableName = toSnakeCase(afterModel.name)

    // Renamed?
    if (beforeModel.name !== afterModel.name) {
      ops.push({
        type: 'renameTable',
        table: tableName,
        previousName: toSnakeCase(beforeModel.name),
      })
      descriptions.push(`Rename table ${beforeModel.name} → ${afterModel.name}`)
    }

    // Diff fields
    const beforeFields = new Map(beforeModel.fields.map(f => [f.id, f]))
    const afterFields = new Map(afterModel.fields.map(f => [f.id, f]))

    // Added fields
    for (const field of afterModel.fields) {
      if (!beforeFields.has(field.id)) {
        ops.push({
          type: 'addColumn',
          table: tableName,
          column: toSnakeCase(field.name),
          field: structuredClone(field),
        })
        descriptions.push(`Add column ${field.name} to ${afterModel.name}`)
      }
    }

    // Removed fields
    for (const field of beforeModel.fields) {
      if (!afterFields.has(field.id)) {
        ops.push({
          type: 'removeColumn',
          table: tableName,
          column: toSnakeCase(field.name),
          previousField: structuredClone(field),
        })
        descriptions.push(`Remove column ${field.name} from ${afterModel.name}`)
      }
    }

    // Changed fields
    for (const afterField of afterModel.fields) {
      const beforeField = beforeFields.get(afterField.id)
      if (!beforeField) continue
      if (!fieldsEqual(beforeField, afterField)) {
        ops.push({
          type: 'changeColumn',
          table: tableName,
          column: toSnakeCase(afterField.name),
          field: structuredClone(afterField),
          previousField: structuredClone(beforeField),
        })
        descriptions.push(`Change column ${afterField.name} in ${afterModel.name}`)
      }
    }

    // Diff associations → FK column changes
    const beforeAssocs = new Map(beforeModel.associations.map(a => [a.id, a]))
    const afterAssocs = new Map(afterModel.associations.map(a => [a.id, a]))

    // Added associations (add FK column to the target table)
    for (const assoc of afterModel.associations) {
      if (beforeAssocs.has(assoc.id)) continue
      if (assoc.type === 'M:N') continue // junction tables handled separately

      const target = after.find(m => m.id === assoc.targetModelId)
      if (!target) continue
      const fkCol = toSnakeCase(afterModel.name) + '_id'
      const targetTable = toSnakeCase(target.name)

      ops.push({
        type: 'addColumn',
        table: targetTable,
        column: fkCol,
        reference: {
          model: tableName,
          key: 'id',
          onUpdate: 'CASCADE',
          onDelete: assoc.type === '1:1' ? 'SET NULL' : 'CASCADE',
        },
      })
      descriptions.push(`Add FK ${fkCol} to ${target.name}`)
    }

    // Removed associations (remove FK column from the target table)
    for (const assoc of beforeModel.associations) {
      if (afterAssocs.has(assoc.id)) continue
      if (assoc.type === 'M:N') continue

      const target = before.find(m => m.id === assoc.targetModelId)
      if (!target) continue
      const fkCol = toSnakeCase(beforeModel.name) + '_id'
      const targetTable = toSnakeCase(target.name)

      // Only if the target table still exists
      if (afterMap.has(target.id)) {
        ops.push({
          type: 'removeColumn',
          table: targetTable,
          column: fkCol,
        })
        descriptions.push(`Remove FK ${fkCol} from ${target.name}`)
      }
    }
  }

  const description = descriptions.length > 0
    ? descriptions.slice(0, 3).join(', ') + (descriptions.length > 3 ? ` (+${descriptions.length - 3} more)` : '')
    : ''

  return { ops, description }
}

// ── Helpers ──────────────────────────────────────────────────

function fieldsEqual(a: SchemaField, b: SchemaField): boolean {
  if (a.name !== b.name) return false
  if (a.type !== b.type) return false
  const ap = a.properties
  const bp = b.properties
  return (
    ap.primaryKey === bp.primaryKey &&
    ap.allowNull === bp.allowNull &&
    ap.autoIncrement === bp.autoIncrement &&
    ap.unique === bp.unique &&
    ap.defaultValue === bp.defaultValue &&
    (ap.length ?? 0) === (bp.length ?? 0) &&
    (ap.precision ?? 0) === (bp.precision ?? 0) &&
    (ap.scale ?? 0) === (bp.scale ?? 0) &&
    arraysEqual(ap.enumValues, bp.enumValues)
  )
}

function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const aa = a ?? []
  const bb = b ?? []
  if (aa.length !== bb.length) return false
  return aa.every((v, i) => v === bb[i])
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
}
