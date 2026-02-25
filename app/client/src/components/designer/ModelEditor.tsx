import { useState } from 'react'
import type { SchemaModel } from '@shared/types/schema'
import { FieldRow } from './FieldRow'
import { AssociationRow } from './AssociationRow'

interface Props {
  designer: any
  model: SchemaModel
}

export function ModelEditor({ designer, model }: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(model.name)
  const models: SchemaModel[] = designer.$state.models

  const handleSaveName = () => {
    if (nameValue.trim() && nameValue.trim() !== model.name) {
      designer.updateModelName({ modelId: model.id, name: nameValue.trim() })
    }
    setEditingName(false)
  }

  const handleStartEdit = () => {
    setNameValue(model.name)
    setEditingName(true)
  }

  const handleAddField = () => {
    designer.addField({ modelId: model.id })
  }

  const handleAddAssociation = () => {
    const otherModels = models.filter(m => m.id !== model.id)
    if (otherModels.length === 0) {
      alert('Add at least one other model to create associations')
      return
    }
    designer.addAssociation({
      modelId: model.id,
      type: '1:M',
      targetModelId: otherModels[0].id
    })
  }

  const handleBack = () => {
    designer.setActiveModel({ modelId: null })
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: model.color || '#8b5cf6' }}
        />

        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName()
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="px-2 py-0.5 text-sm font-bold bg-slate-800 border border-indigo-500 rounded text-white outline-none flex-1 min-w-0"
          />
        ) : (
          <h2
            onClick={handleStartEdit}
            className="text-sm font-bold text-white cursor-pointer hover:text-indigo-300 transition-colors truncate flex-1"
          >
            {model.name}
          </h2>
        )}

        <button
          onClick={handleBack}
          className="text-slate-500 hover:text-slate-300 text-xs px-1 shrink-0 transition-colors"
          title="Deselect model"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
          </svg>
        </button>
      </div>

      {/* Fields section */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Fields ({model.fields.length})
          </h3>
          <button
            onClick={handleAddField}
            className="px-3 py-1 text-xs bg-purple-600/20 border border-purple-500/30 rounded text-purple-300 hover:bg-purple-600/30 transition-colors"
          >
            + Add Field
          </button>
        </div>

        <div className="space-y-2">
          {model.fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              modelId={model.id}
              designer={designer}
            />
          ))}

          {model.fields.length === 0 && (
            <div className="text-sm text-slate-500 py-4 text-center">
              No fields. Click + Add Field.
            </div>
          )}
        </div>
      </section>

      {/* Associations section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Associations ({model.associations.length})
          </h3>
          <button
            onClick={handleAddAssociation}
            className="px-3 py-1 text-xs bg-blue-600/20 border border-blue-500/30 rounded text-blue-300 hover:bg-blue-600/30 transition-colors"
          >
            + Add Association
          </button>
        </div>

        <div className="space-y-2">
          {model.associations.map((assoc) => (
            <AssociationRow
              key={assoc.id}
              association={assoc}
              modelId={model.id}
              models={models}
              designer={designer}
            />
          ))}

          {model.associations.length === 0 && (
            <div className="text-sm text-slate-500 py-4 text-center">
              No associations. Click + Add Association.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
