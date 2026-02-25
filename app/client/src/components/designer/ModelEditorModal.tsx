import { useState, useEffect, useRef } from 'react'
import type { SchemaModel } from '@shared/types/schema'
import { nameToColor } from '@shared/types/schema'
import { FieldRow } from './FieldRow'
import { AssociationRow } from './AssociationRow'

interface Props {
  model: SchemaModel
  designer: any
  onClose: () => void
}

export function ModelEditorModal({ model, designer, onClose }: Props) {
  const models: SchemaModel[] = designer.$state.models
  const fresh = models.find(m => m.id === model.id) || model

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(fresh.name)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setNameValue(fresh.name) }, [fresh.name])

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSaveName = () => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== fresh.name) {
      designer.updateModelName({ modelId: fresh.id, name: trimmed })
    }
    setEditingName(false)
  }

  const handleAddField = () => {
    designer.addField({ modelId: fresh.id })
  }

  const handleAddAssociation = () => {
    const others = models.filter(m => m.id !== fresh.id)
    if (others.length === 0) return
    designer.addAssociation({
      modelId: fresh.id,
      type: '1:M',
      targetModelId: others[0].id
    })
  }

  const color = fresh.color || nameToColor(fresh.name)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onPointerDown={(e) => {
      if (e.target === backdropRef.current) onClose()
    }}>
      <div ref={backdropRef} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700" style={{ backgroundColor: color + '22' }}>
          <div className="w-4 h-4 rounded-full shrink-0 border-2 border-white/20" style={{ backgroundColor: color }} />

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
              className="px-2 py-1 text-base font-bold bg-slate-800 border border-indigo-500 rounded text-white outline-none flex-1 min-w-0"
            />
          ) : (
            <h2
              onClick={() => { setNameValue(fresh.name); setEditingName(true) }}
              className="text-base font-bold text-white cursor-pointer hover:text-indigo-300 transition-colors truncate flex-1"
            >
              {fresh.name}
            </h2>
          )}

          <span className="text-[11px] text-slate-500">
            {fresh.fields.length} field{fresh.fields.length !== 1 ? 's' : ''} · {fresh.associations.length} assoc
          </span>

          <button
            onClick={onClose}
            className="ml-2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Fields */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Fields ({fresh.fields.length})
              </h3>
              <button
                onClick={handleAddField}
                className="px-3 py-1.5 text-xs bg-purple-600/20 border border-purple-500/30 rounded text-purple-300 hover:bg-purple-600/30 transition-colors"
              >
                + Add Field
              </button>
            </div>

            <div className="space-y-2">
              {fresh.fields.map((field) => (
                <FieldRow key={field.id} field={field} modelId={fresh.id} designer={designer} />
              ))}

              {fresh.fields.length === 0 && (
                <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-700 rounded-lg">
                  No fields yet. Click + Add Field to start.
                </div>
              )}
            </div>
          </section>

          {/* Associations */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Associations ({fresh.associations.length})
              </h3>
              <button
                onClick={handleAddAssociation}
                className="px-3 py-1.5 text-xs bg-blue-600/20 border border-blue-500/30 rounded text-blue-300 hover:bg-blue-600/30 transition-colors"
              >
                + Add Association
              </button>
            </div>

            <div className="space-y-2">
              {fresh.associations.map((assoc) => (
                <AssociationRow
                  key={assoc.id}
                  association={assoc}
                  modelId={fresh.id}
                  models={models}
                  designer={designer}
                />
              ))}

              {fresh.associations.length === 0 && (
                <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-700 rounded-lg">
                  No associations. Drag from edge anchors on the canvas or click + Add Association.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-700 bg-slate-900/80 flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] text-slate-600">
            <kbd className="px-1 py-px bg-slate-800 border border-slate-700 rounded text-[9px]">Esc</kbd>
            <span>close</span>
          </div>
          <div className="ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
