import { ASSOCIATION_TYPES, type SchemaAssociation, type SchemaModel } from '@shared/types/schema'

interface Props {
  association: SchemaAssociation
  modelId: string
  models: SchemaModel[]
  designer: any
}

export function AssociationRow({ association, modelId, models, designer }: Props) {
  const targetModel = models.find(m => m.id === association.targetModelId)
  const otherModels = models.filter(m => m.id !== modelId)

  const handleTypeChange = (type: string) => {
    designer.updateAssociation({
      modelId,
      associationId: association.id,
      updates: { type }
    })
  }

  const handleTargetChange = (targetModelId: string) => {
    designer.updateAssociation({
      modelId,
      associationId: association.id,
      updates: { targetModelId }
    })
  }

  const handleDelete = () => {
    designer.removeAssociation({ modelId, associationId: association.id })
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded border border-blue-500/20 group">
      {/* Type */}
      <select
        value={association.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="w-20 px-1 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white outline-none focus:border-blue-500"
      >
        {ASSOCIATION_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <span className="text-xs text-slate-500">to</span>

      {/* Target model */}
      <select
        value={association.targetModelId}
        onChange={(e) => handleTargetChange(e.target.value)}
        className="flex-1 px-1 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white outline-none focus:border-blue-500"
      >
        {!targetModel && <option value="">-- select model --</option>}
        {otherModels.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-sm transition-opacity"
        title="Delete association"
      >
        x
      </button>
    </div>
  )
}
