import { useState, useRef, useCallback, useEffect } from 'react'
import type { SchemaModel, FieldType } from '@shared/types/schema'
import { nameToColor } from '@shared/types/schema'
import { DRAG_TYPE_FIELD } from './Toolbox'

interface Props {
  model: SchemaModel
  allModels: SchemaModel[]
  designer: any
  isActive: boolean
  hasActiveSelection: boolean
  isLinking: boolean
  isLinkSource: boolean
  isLinkTarget: boolean
  onLinkStart: (modelId: string, clientX: number, clientY: number) => void
  onLinkHover: (modelId: string | null) => void
  onLinkEnd: (targetModelId: string, clientX: number, clientY: number) => void
  onOpenEditor: (modelId: string) => void
}

const MAX_VISIBLE_FIELDS = 8

function IconKey() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-yellow-400 shrink-0">
      <path d="M11 0a5 5 0 0 0-4.916 5.916L0 12v3a1 1 0 0 0 1 1h2v-2h2v-2h2l1.298-1.298A5 5 0 1 0 11 0zm1.498 5.002a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
    </svg>
  )
}

function IconHash() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-blue-400 shrink-0">
      <line x1="4" y1="1" x2="2" y2="15" /><line x1="10" y1="1" x2="8" y2="15" />
      <line x1="1" y1="5" x2="13" y2="5" /><line x1="3" y1="11" x2="15" y2="11" />
    </svg>
  )
}

function IconNotNull() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-red-400 shrink-0">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.5 3.5h1v5h-1v-5zm0 6h1v1h-1v-1z" />
    </svg>
  )
}

function IconUnique() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-emerald-400 shrink-0">
      <path d="M8 0l2.5 5.5L16 6.5l-4 4 1 5.5L8 13l-5 3 1-5.5-4-4 5.5-1z" />
    </svg>
  )
}

function IconFK() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-indigo-400 shrink-0">
      <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" />
      <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z" />
    </svg>
  )
}

// Edge anchor dot positioned on the card border
function EdgeAnchor({ side, onPointerDown }: {
  side: 'top' | 'right' | 'bottom' | 'left'
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const posClass = {
    top:    'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    right:  'top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    left:   'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
  }[side]

  return (
    <div
      data-no-drag
      className={`absolute ${posClass} w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-900 cursor-crosshair opacity-0 group-hover/card:opacity-100 hover:!opacity-100 hover:scale-150 hover:bg-indigo-400 transition-all z-20`}
      onPointerDown={onPointerDown}
    />
  )
}

export function ModelCard({
  model, allModels, designer, isActive, hasActiveSelection,
  isLinking, isLinkSource, isLinkTarget,
  onLinkStart, onLinkHover, onLinkEnd, onOpenEditor
}: Props) {
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const posStart = useRef({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestPos = useRef({ x: model.position?.x || 0, y: model.position?.y || 0 })

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(model.name)

  useEffect(() => {
    if (!dragging.current && cardRef.current) {
      latestPos.current = { x: model.position?.x || 0, y: model.position?.y || 0 }
      cardRef.current.style.left = `${latestPos.current.x}px`
      cardRef.current.style.top = `${latestPos.current.y}px`
    }
  }, [model.position?.x, model.position?.y])

  const flushPosition = useCallback(() => {
    designer.updateModelPosition({
      modelId: model.id,
      x: Math.round(latestPos.current.x),
      y: Math.round(latestPos.current.y)
    })
  }, [model.id, designer])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    if (e.button !== 0) return
    if (isLinking && !isLinkSource) return

    e.preventDefault()
    e.stopPropagation()
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    posStart.current = { ...latestPos.current }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [isLinking, isLinkSource])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const parent = cardRef.current?.parentElement
    let zoom = 1
    if (parent) {
      const transform = parent.style.transform
      const match = transform.match(/scale\(([^)]+)\)/)
      if (match) zoom = parseFloat(match[1])
    }

    const dx = (e.clientX - dragStart.current.x) / zoom
    const dy = (e.clientY - dragStart.current.y) / zoom
    const x = posStart.current.x + dx
    const y = posStart.current.y + dy

    latestPos.current = { x, y }

    if (cardRef.current) {
      cardRef.current.style.left = `${x}px`
      cardRef.current.style.top = `${y}px`
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(flushPosition, 200)
  }, [flushPosition])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) {
      // Not dragging this card — check if it's a link drop target
      if (isLinking && !isLinkSource) {
        e.stopPropagation()
        e.preventDefault()
        onLinkEnd(model.id, e.clientX, e.clientY)
      }
      return
    }
    dragging.current = false
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    flushPosition()
  }, [flushPosition, isLinking, isLinkSource, model.id, onLinkEnd])

  const handlePointerEnter = useCallback(() => {
    if (isLinking && !isLinkSource) {
      onLinkHover(model.id)
    }
  }, [isLinking, isLinkSource, model.id, onLinkHover])

  const handlePointerLeave = useCallback(() => {
    if (isLinking) {
      onLinkHover(null)
    }
  }, [isLinking, onLinkHover])

  const handleSelect = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    if (isLinking) return
    designer.setActiveModel({ modelId: isActive ? null : model.id })
  }, [model.id, isActive, designer, isLinking])

  // Edge anchor: start linking from any side
  const handleAnchorDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onLinkStart(model.id, e.clientX, e.clientY)
  }, [model.id, onLinkStart])

  // Inline rename
  const handleDoubleClickHeader = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isLinking) return
    setNameValue(model.name)
    setEditingName(true)
  }, [model.name, isLinking])

  const handleSaveName = useCallback(() => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== model.name) {
      designer.updateModelName({ modelId: model.id, name: trimmed })
    }
    setEditingName(false)
  }, [nameValue, model.name, model.id, designer])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    designer.removeModel({ modelId: model.id })
  }, [model.id, designer])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenEditor(model.id)
  }, [model.id, onOpenEditor])

  const handleDoubleClickBody = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isLinking) return
    onOpenEditor(model.id)
  }, [model.id, isLinking, onOpenEditor])

  // Drop field type onto card
  const [dropHighlight, setDropHighlight] = useState(false)

  const handleFieldDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_TYPE_FIELD)) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      setDropHighlight(true)
    }
  }, [])

  const handleFieldDragLeave = useCallback((e: React.DragEvent) => {
    if (!cardRef.current?.contains(e.relatedTarget as Node)) {
      setDropHighlight(false)
    }
  }, [])

  const handleFieldDrop = useCallback((e: React.DragEvent) => {
    const fieldType = e.dataTransfer.getData(DRAG_TYPE_FIELD)
    if (fieldType) {
      e.preventDefault()
      e.stopPropagation()
      setDropHighlight(false)
      designer.addField({ modelId: model.id, type: fieldType as FieldType })
    }
  }, [model.id, designer])

  const color = model.color || nameToColor(model.name)
  const pos = model.position || { x: 0, y: 0 }
  const dimmed = hasActiveSelection && !isActive && !isLinking

  const visibleFields = model.fields.slice(0, MAX_VISIBLE_FIELDS)
  const hiddenCount = model.fields.length - MAX_VISIBLE_FIELDS

  let borderClass = 'border-slate-600 hover:border-slate-400'
  if (dropHighlight) {
    borderClass = 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.3)] z-10'
  } else if (isLinkTarget) {
    borderClass = 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)] z-10'
  } else if (isLinkSource) {
    borderClass = 'border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.3)] z-10'
  } else if (isActive) {
    borderClass = 'border-indigo-400 shadow-[0_0_20px_rgba(129,140,248,0.3)] z-10'
  } else if (dimmed) {
    borderClass = 'border-slate-700 opacity-40'
  }

  return (
    <div
      ref={cardRef}
      className={`group/card absolute w-56 rounded-lg border-2 shadow-lg select-none transition-[box-shadow,opacity,border-color] duration-200 ${
        isLinking && !isLinkSource ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      } ${borderClass}`}
      style={{
        left: pos.x,
        top: pos.y,
        backgroundColor: '#0f172a'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleSelect}
      onDragOver={handleFieldDragOver}
      onDragLeave={handleFieldDragLeave}
      onDrop={handleFieldDrop}
    >
      {/* Edge anchor points — visible on hover, drag to link */}
      {!isLinking && (
        <>
          <EdgeAnchor side="top" onPointerDown={handleAnchorDown} />
          <EdgeAnchor side="right" onPointerDown={handleAnchorDown} />
          <EdgeAnchor side="bottom" onPointerDown={handleAnchorDown} />
          <EdgeAnchor side="left" onPointerDown={handleAnchorDown} />
        </>
      )}

      {/* Header with model color */}
      <div
        className="group flex items-center justify-between px-3 py-2 rounded-t-[6px]"
        style={{ backgroundColor: color }}
        onDoubleClick={handleDoubleClickHeader}
      >
        {editingName ? (
          <input
            data-no-drag
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName()
              if (e.key === 'Escape') setEditingName(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 px-1 py-0 text-sm font-bold bg-black/30 text-white rounded outline-none border border-white/30 min-w-0"
          />
        ) : (
          <span className="text-sm font-bold text-white truncate flex-1">{model.name}</span>
        )}

        {!isLinking && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1" data-no-drag>
            <button
              onClick={handleEdit}
              className="w-5 h-5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors"
              title="Edit model"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.146.854a.5.5 0 0 1 .708 0l2.292 2.292a.5.5 0 0 1 0 .708L5.854 13.146a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.611-.611l1-4a.5.5 0 0 1 .131-.233L12.146.854z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="w-5 h-5 flex items-center justify-center text-white/70 hover:text-red-300 hover:bg-white/20 rounded transition-colors"
              title="Delete model"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Fields */}
      <div className="px-2 py-1" onDoubleClick={handleDoubleClickBody}>
        {visibleFields.map((field) => (
          <div key={field.id} className="flex items-center gap-1 py-[3px] text-xs">
            <div className="flex gap-0.5 w-7 shrink-0 justify-end">
              {field.properties.primaryKey && <IconKey />}
              {field.properties.autoIncrement && <IconHash />}
              {!field.properties.allowNull && !field.properties.primaryKey && <IconNotNull />}
              {field.properties.unique && !field.properties.primaryKey && <IconUnique />}
            </div>
            <span className="text-slate-300 truncate flex-1 ml-1">{field.name || '(unnamed)'}</span>
            <span className="text-slate-500 text-[10px] font-mono">{field.type}</span>
          </div>
        ))}

        {hiddenCount > 0 && (
          <div className="text-[10px] text-slate-500 py-0.5 text-center">
            +{hiddenCount} more field{hiddenCount > 1 ? 's' : ''}
          </div>
        )}

        {model.fields.length === 0 && (
          <div className="text-[10px] text-slate-600 py-1 text-center">No fields</div>
        )}
      </div>

      {/* Associations */}
      {model.associations.length > 0 && (
        <div className="px-2 py-1 border-t border-slate-800">
          {model.associations.map((assoc) => {
            const target = allModels.find(m => m.id === assoc.targetModelId)
            const targetName = target?.name || '???'
            const typeLabel = assoc.type === '1:1' ? '1:1' : assoc.type === '1:M' ? '1:*' : '*:*'
            const typeColor = assoc.type === 'M:N'
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
            return (
              <div key={assoc.id} className="flex items-center gap-1 py-[3px] text-xs">
                <div className="w-7 shrink-0 flex justify-end">
                  <IconFK />
                </div>
                <span className="text-indigo-300 truncate flex-1 ml-1">{targetName}</span>
                <span className={`text-[9px] font-mono px-1 py-0 rounded border ${typeColor}`}>
                  {typeLabel}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
