// LiveSchemaDesigner - Collaborative database schema designer

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'
import { generatorRegistry } from '@server/generators'
import { validateSchema } from '@server/validators/schema-validator'
import { diffSchemas } from '@server/diff/schema-diff'
import type {
  SchemaModel, SchemaField, SchemaAssociation,
  GeneratorResult, ValidationError, GeneratedFile,
  DatabaseSchema, AssociationType, FieldType, MigrationEntry
} from '@shared/types/schema'
import { createDefaultModel, createDefaultField, nameToColor } from '@shared/types/schema'

// Client component reference (Ctrl+Click to navigate)
import type { DesignerPage as _Client } from '@client/src/pages/DesignerPage'

export class LiveSchemaDesigner extends LiveComponent<typeof LiveSchemaDesigner.defaultState> {
  static componentName = 'LiveSchemaDesigner'
  static publicActions = [
    'setSchemaName',
    'addModel', 'removeModel', 'updateModelName', 'updateModelPosition',
    'addField', 'removeField', 'updateField',
    'addAssociation', 'removeAssociation', 'updateAssociation',
    'createManyToMany',
    'generate', 'previewModel',
    'validate',
    'importSchema', 'exportSchema',
    'setActiveGenerator', 'setActiveModel',
    'updateCursor',
    'clearMigrations'
  ] as const

  static defaultState = {
    schemaName: 'My Database',
    models: [] as SchemaModel[],
    activeModelId: null as string | null,
    activeGeneratorId: 'sequelize' as string,
    generatedCode: null as GeneratorResult | null,
    previewFiles: [] as GeneratedFile[],
    validationErrors: [] as ValidationError[],
    availableGenerators: [] as { id: string; name: string; description: string; language: string; framework: string; category?: string; dialect?: string }[],
    migrations: [] as MigrationEntry[],
    connectedUsers: 0,
    lastEditedBy: null as string | null
  }

  protected roomType = 'schema'

  // In-memory room state persistence (like LiveChat.roomHistory)
  private static roomSchemas = new Map<string, { name: string; models: SchemaModel[]; migrations: MigrationEntry[] }>()

  constructor(
    initialState: Partial<typeof LiveSchemaDesigner.defaultState> = {},
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)

    // Populate available generators
    this.setState({
      availableGenerators: generatorRegistry.getAll().map(g => ({
        id: g.id, name: g.name, description: g.description,
        language: g.language, framework: g.framework,
        category: g.category, dialect: g.dialect,
      }))
    })

    // Restore room state if it exists
    if (this.room) {
      const saved = LiveSchemaDesigner.roomSchemas.get(this.room)
      if (saved) {
        this.setState({
          schemaName: saved.name,
          models: saved.models,
          migrations: saved.migrations || []
        })
      }
    }

    // Listen for schema updates from other users in the room
    this.onRoomEvent<{ models: SchemaModel[]; editedBy: string }>('SCHEMA_UPDATED', (data) => {
      this.setState({
        models: data.models,
        lastEditedBy: data.editedBy
      })
      this.autoValidate()
    })

    this.onRoomEvent<{ name: string }>('SCHEMA_NAME_CHANGED', (data) => {
      this.setState({ schemaName: data.name })
    })

    this.onRoomEvent<{ connectedUsers: number }>('USER_COUNT_CHANGED', (data) => {
      this.setState({ connectedUsers: data.connectedUsers })
    })

    // Cursor sync: relay other users' cursors to this client via BROADCAST (bypasses state)
    // NOTE: We send raw WS messages with componentId='room-relay' instead of using this.emit('BROADCAST'),
    // because the LiveComponentsProvider filters out broadcasts whose componentId matches
    // the local component (to avoid echoing back to sender). Since room events already
    // exclude the original sender, we need the message to bypass that filter.
    this.onRoomEvent<{ userId: string; x: number; y: number; color: string; name: string }>('CURSOR_MOVED', (data) => {
      this.ws.send(JSON.stringify({
        type: 'BROADCAST',
        componentId: 'room-relay',
        payload: { type: 'cursor:move', data },
        timestamp: Date.now()
      }))
    })

    this.onRoomEvent<{ userId: string }>('CURSOR_LEFT', (data) => {
      this.ws.send(JSON.stringify({
        type: 'BROADCAST',
        componentId: 'room-relay',
        payload: { type: 'cursor:leave', data },
        timestamp: Date.now()
      }))
    })

    // Notify room that a user joined
    const newCount = this.state.connectedUsers + 1
    this.emitRoomEventWithState('USER_COUNT_CHANGED', { connectedUsers: newCount }, { connectedUsers: newCount })
  }

  // === Schema name ===

  async setSchemaName(payload: { name: string }) {
    this.setState({ schemaName: payload.name })
    this.saveRoomState()
    this.emitRoomEvent('SCHEMA_NAME_CHANGED', { name: payload.name })
    return { success: true }
  }

  // === Model CRUD ===

  async addModel(payload?: { name?: string }) {
    const name = payload?.name || `Model${this.state.models.length + 1}`
    const model = createDefaultModel(name)
    model.position = {
      x: 50 + (this.state.models.length % 4) * 320,
      y: 50 + Math.floor(this.state.models.length / 4) * 260
    }
    const newModels = [...this.state.models, model]
    this.broadcastSchemaChange(newModels)
    return { success: true, modelId: model.id }
  }

  async removeModel(payload: { modelId: string }) {
    // Remove model and clean up associations that reference it
    const cleaned = this.state.models
      .filter(m => m.id !== payload.modelId)
      .map(m => ({
        ...m,
        associations: m.associations.filter(a => a.targetModelId !== payload.modelId)
      }))

    const activeModelId = this.state.activeModelId === payload.modelId
      ? null
      : this.state.activeModelId

    this.setState({ activeModelId })
    this.broadcastSchemaChange(cleaned)
    return { success: true }
  }

  async updateModelName(payload: { modelId: string; name: string }) {
    const newModels = this.state.models.map(m =>
      m.id === payload.modelId ? { ...m, name: payload.name } : m
    )
    this.broadcastSchemaChange(newModels)
    return { success: true }
  }

  async updateModelPosition(payload: { modelId: string; x: number; y: number }) {
    const newModels = this.state.models.map(m =>
      m.id === payload.modelId ? { ...m, position: { x: payload.x, y: payload.y } } : m
    )
    // Broadcast position without revalidation (performance)
    this.setState({ models: newModels })
    this.saveRoomState()
    this.emitRoomEventWithState('SCHEMA_UPDATED', {
      models: newModels,
      editedBy: this.userId || 'anonymous'
    }, { models: newModels })
    return { success: true }
  }

  // === Field CRUD ===

  async addField(payload: { modelId: string; name?: string; type?: FieldType }) {
    const field = createDefaultField(payload.name || '')
    if (payload.type) field.type = payload.type
    const newModels = this.state.models.map(m =>
      m.id === payload.modelId
        ? { ...m, fields: [...m.fields, field] }
        : m
    )
    this.broadcastSchemaChange(newModels)
    return { success: true, fieldId: field.id }
  }

  async removeField(payload: { modelId: string; fieldId: string }) {
    const newModels = this.state.models.map(m =>
      m.id === payload.modelId
        ? { ...m, fields: m.fields.filter(f => f.id !== payload.fieldId) }
        : m
    )
    this.broadcastSchemaChange(newModels)
    return { success: true }
  }

  async updateField(payload: { modelId: string; fieldId: string; updates: Partial<SchemaField> }) {
    const newModels = this.state.models.map(m =>
      m.id === payload.modelId
        ? {
            ...m,
            fields: m.fields.map(f =>
              f.id === payload.fieldId ? { ...f, ...payload.updates } : f
            )
          }
        : m
    )
    this.broadcastSchemaChange(newModels)
    this.autoPreview()
    return { success: true }
  }

  // === Association CRUD ===

  async addAssociation(payload: { modelId: string; type: AssociationType; targetModelId: string }) {
    const assoc: SchemaAssociation = {
      id: crypto.randomUUID(),
      type: payload.type,
      targetModelId: payload.targetModelId
    }
    const newModels = this.state.models.map(m =>
      m.id === payload.modelId
        ? { ...m, associations: [...m.associations, assoc] }
        : m
    )
    this.broadcastSchemaChange(newModels)
    return { success: true, associationId: assoc.id }
  }

  async removeAssociation(payload: { modelId: string; associationId: string }) {
    const newModels = this.state.models.map(m =>
      m.id === payload.modelId
        ? { ...m, associations: m.associations.filter(a => a.id !== payload.associationId) }
        : m
    )
    this.broadcastSchemaChange(newModels)
    return { success: true }
  }

  async updateAssociation(payload: { modelId: string; associationId: string; updates: Partial<SchemaAssociation> }) {
    const newModels = this.state.models.map(m =>
      m.id === payload.modelId
        ? {
            ...m,
            associations: m.associations.map(a =>
              a.id === payload.associationId ? { ...a, ...payload.updates } : a
            )
          }
        : m
    )
    this.broadcastSchemaChange(newModels)
    return { success: true }
  }

  // === Many-to-Many with junction table ===

  async createManyToMany(payload: { sourceModelId: string; targetModelId: string }) {
    const source = this.state.models.find(m => m.id === payload.sourceModelId)
    const target = this.state.models.find(m => m.id === payload.targetModelId)
    if (!source || !target) return { success: false, error: 'Model not found' }

    // Create junction model
    const junctionName = `${source.name}${target.name}`
    const junction = createDefaultModel(junctionName)

    // Position between source and target, offset down
    const srcPos = source.position || { x: 0, y: 0 }
    const tgtPos = target.position || { x: 0, y: 0 }
    junction.position = {
      x: Math.round((srcPos.x + tgtPos.x) / 2),
      y: Math.round((srcPos.y + tgtPos.y) / 2 + 140)
    }

    // Add FK fields to junction table
    const sourceFkName = source.name.charAt(0).toLowerCase() + source.name.slice(1) + 'Id'
    const targetFkName = target.name.charAt(0).toLowerCase() + target.name.slice(1) + 'Id'

    const sourceFK = createDefaultField(sourceFkName)
    sourceFK.type = 'INTEGER'
    sourceFK.properties.allowNull = false

    const targetFK = createDefaultField(targetFkName)
    targetFK.type = 'INTEGER'
    targetFK.properties.allowNull = false

    // junction keeps its default "id" PK + two FKs
    junction.fields = [...junction.fields, sourceFK, targetFK]

    // Create 1:M associations from source and target to junction
    const assocSourceToJunction: SchemaAssociation = {
      id: crypto.randomUUID(),
      type: '1:M',
      targetModelId: junction.id
    }
    const assocTargetToJunction: SchemaAssociation = {
      id: crypto.randomUUID(),
      type: '1:M',
      targetModelId: junction.id
    }

    const newModels = [
      ...this.state.models.map(m => {
        if (m.id === source.id) return { ...m, associations: [...m.associations, assocSourceToJunction] }
        if (m.id === target.id) return { ...m, associations: [...m.associations, assocTargetToJunction] }
        return m
      }),
      junction
    ]

    this.broadcastSchemaChange(newModels)
    return { success: true, junctionModelId: junction.id }
  }

  // === Generation ===

  async generate(payload?: { generatorId?: string }) {
    const genId = payload?.generatorId || this.state.activeGeneratorId
    const result = generatorRegistry.generate(genId, this.state.models, this.state.migrations)
    this.setState({ generatedCode: result })
    return { success: true, result }
  }

  async previewModel(payload: { modelId: string; generatorId?: string }) {
    const genId = payload.generatorId || this.state.activeGeneratorId
    const model = this.state.models.find(m => m.id === payload.modelId)
    if (!model) return { success: false, error: 'Model not found' }
    const files = generatorRegistry.previewModel(genId, model, this.state.models)
    this.setState({ previewFiles: files })
    return { success: true, files }
  }

  // === Validation ===

  async validate() {
    const errors = validateSchema(this.state.models)
    this.setState({ validationErrors: errors })
    return { success: true, errors }
  }

  // === UI State ===

  async setActiveGenerator(payload: { generatorId: string }) {
    this.setState({ activeGeneratorId: payload.generatorId })
    this.autoPreview()
    return { success: true }
  }

  async setActiveModel(payload: { modelId: string | null }) {
    this.setState({ activeModelId: payload.modelId })
    if (payload.modelId) this.autoPreview()
    return { success: true }
  }

  // === Cursor sync (lightweight, no state) ===

  async updateCursor(payload: { x: number; y: number }) {
    const uid = this.userId || this.id
    this.emitRoomEvent('CURSOR_MOVED', {
      userId: uid,
      x: payload.x,
      y: payload.y,
      color: nameToColor(uid),
      name: uid.slice(0, 6)
    })
    // No return needed — fire and forget
  }

  // === Migration history ===

  async clearMigrations() {
    this.setState({ migrations: [] })
    this.saveRoomState()
    return { success: true }
  }

  // === Import / Export ===

  async importSchema(payload: { schema: DatabaseSchema }) {
    // Import bypasses diff tracking — set models + migrations directly
    this.setState({
      schemaName: payload.schema.name,
      activeModelId: null,
      migrations: payload.schema.migrations || [],
      models: payload.schema.models
    })
    this.saveRoomState()
    this.autoValidate()
    this.emitRoomEvent('SCHEMA_NAME_CHANGED', { name: payload.schema.name })
    this.emitRoomEvent('SCHEMA_UPDATED', {
      models: payload.schema.models,
      editedBy: this.userId || 'anonymous'
    })
    return { success: true }
  }

  async exportSchema() {
    const schema: DatabaseSchema = {
      id: crypto.randomUUID(),
      name: this.state.schemaName,
      models: this.state.models,
      migrations: this.state.migrations,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    return { success: true, schema }
  }

  // === Private helpers ===

  private broadcastSchemaChange(models: SchemaModel[]) {
    // Diff between current and new state to track migration ops
    const before = this.state.models
    const { ops, description } = diffSchemas(before, models)

    if (ops.length > 0) {
      const entry: MigrationEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        description,
        ops,
        snapshotHash: this.hashModels(models)
      }
      this.setState({
        models,
        migrations: [...this.state.migrations, entry]
      })
    } else {
      this.setState({ models })
    }

    this.saveRoomState()
    this.autoValidate()
    this.emitRoomEvent('SCHEMA_UPDATED', {
      models,
      editedBy: this.userId || 'anonymous'
    })
  }

  private saveRoomState() {
    if (this.room) {
      LiveSchemaDesigner.roomSchemas.set(this.room, {
        name: this.state.schemaName,
        models: this.state.models,
        migrations: this.state.migrations
      })
    }
  }

  private hashModels(models: SchemaModel[]): string {
    // Simple hash for snapshot verification
    const str = JSON.stringify(models.map(m => ({
      id: m.id, name: m.name,
      fields: m.fields.map(f => ({ id: f.id, name: f.name, type: f.type, properties: f.properties })),
      associations: m.associations
    })))
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
    }
    return hash.toString(36)
  }

  private autoValidate() {
    const errors = validateSchema(this.state.models)
    this.setState({ validationErrors: errors })
  }

  private autoPreview() {
    if (this.state.activeModelId) {
      const model = this.state.models.find(m => m.id === this.state.activeModelId)
      if (model) {
        const files = generatorRegistry.previewModel(
          this.state.activeGeneratorId,
          model,
          this.state.models
        )
        this.setState({ previewFiles: files })
      }
    }
  }

  destroy() {
    const uid = this.userId || this.id
    this.emitRoomEvent('CURSOR_LEFT', { userId: uid })
    const newCount = Math.max(0, this.state.connectedUsers - 1)
    this.emitRoomEvent('USER_COUNT_CHANGED', { connectedUsers: newCount })
    super.destroy()
  }
}
