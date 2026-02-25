import { useState, useCallback } from 'react'
import type { SchemaModel } from '@shared/types/schema'
import { Toolbox } from './Toolbox'

interface Props {
  designer: any
}

export function DesignerSidebar({ designer }: Props) {
  const models: SchemaModel[] = designer.$state.models
  const activeModelId: string | null = designer.$state.activeModelId
  const [search, setSearch] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const handleAddModel = useCallback(() => {
    const existing = models.map(m => m.name)
    let i = models.length + 1
    let name = `Model${i}`
    while (existing.includes(name)) {
      i++
      name = `Model${i}`
    }
    designer.addModel({ name })
  }, [models, designer])

  const handleSelectModel = useCallback((modelId: string) => {
    designer.setActiveModel({
      modelId: activeModelId === modelId ? null : modelId
    })
  }, [activeModelId, designer])

  const handleDeleteModel = useCallback((e: React.MouseEvent, modelId: string) => {
    e.stopPropagation()
    designer.removeModel({ modelId })
  }, [designer])

  // Inline rename
  const handleStartRename = useCallback((e: React.MouseEvent, model: SchemaModel) => {
    e.stopPropagation()
    setRenamingId(model.id)
    setRenameValue(model.name)
  }, [])

  const handleSaveRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      const model = models.find(m => m.id === renamingId)
      if (model && renameValue.trim() !== model.name) {
        designer.updateModelName({ modelId: renamingId, name: renameValue.trim() })
      }
    }
    setRenamingId(null)
  }, [renamingId, renameValue, models, designer])

  const filteredModels = search
    ? models.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : models

  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0 overflow-hidden">
      {/* Toolbox - drag to canvas/cards */}
      <Toolbox />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Models ({models.length})
        </span>
        <button
          onClick={handleAddModel}
          disabled={!designer.$connected}
          className="w-6 h-6 flex items-center justify-center text-lg bg-indigo-600 rounded hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          title="Add model"
        >
          +
        </button>
      </div>

      {/* Search filter (5+ models) */}
      {models.length >= 5 && (
        <div className="px-2 py-1.5 border-b border-slate-700/50">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter models..."
            className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      )}

      {/* Model list */}
      <div className="flex-1 overflow-y-auto">
        {models.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-slate-500">
            No models yet. Click + to add one,
            or double-click the canvas.
          </div>
        )}

        {filteredModels.map((model) => (
          <div
            key={model.id}
            onClick={() => handleSelectModel(model.id)}
            className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 transition-colors ${
              activeModelId === model.id
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-200'
                : 'border-transparent hover:bg-slate-800 text-slate-300'
            }`}
          >
            {/* Color dot */}
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: model.color || '#8b5cf6' }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              {renamingId === model.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleSaveRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-1 py-0 text-sm font-medium bg-slate-800 border border-indigo-500 rounded text-white outline-none"
                />
              ) : (
                <div
                  className="text-sm font-medium truncate"
                  onDoubleClick={(e) => handleStartRename(e, model)}
                  title="Double-click to rename"
                >
                  {model.name}
                </div>
              )}
              <div className="text-xs text-slate-500">
                {model.fields.length} field{model.fields.length !== 1 ? 's' : ''}
                {model.associations.length > 0 && ` / ${model.associations.length} assoc`}
              </div>
            </div>

            {/* Delete */}
            <button
              onClick={(e) => handleDeleteModel(e, model.id)}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs px-1 transition-opacity shrink-0"
              title="Delete model"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </div>
        ))}

        {search && filteredModels.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-slate-500">
            No models matching "{search}"
          </div>
        )}
      </div>
    </aside>
  )
}
