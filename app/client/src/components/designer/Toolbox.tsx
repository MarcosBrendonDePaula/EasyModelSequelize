import { useCallback } from 'react'
import { FIELD_TYPES, type FieldType } from '@shared/types/schema'

// Drag data format key
export const DRAG_TYPE_TABLE = 'application/x-schema-table'
export const DRAG_TYPE_FIELD = 'application/x-schema-field'

// Group field types for better UX
const FIELD_GROUPS: { label: string; types: FieldType[] }[] = [
  { label: 'Text', types: ['STRING', 'TEXT', 'CHAR'] },
  { label: 'Numbers', types: ['TINYINT', 'INTEGER', 'SMALLINT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'MONEY'] },
  { label: 'Date/Time', types: ['DATE', 'DATEONLY', 'TIME'] },
  { label: 'Other', types: ['BOOLEAN', 'JSON', 'JSONB', 'UUID', 'ENUM', 'BLOB', 'ARRAY', 'RANGE'] },
  { label: 'Special', types: ['VIRTUAL'] },
]

// Color mapping per type category
function typeColor(type: FieldType): string {
  if (['STRING', 'TEXT', 'CHAR'].includes(type)) return 'text-green-400 border-green-500/30 bg-green-500/5'
  if (['TINYINT', 'INTEGER', 'SMALLINT', 'BIGINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(type)) return 'text-blue-400 border-blue-500/30 bg-blue-500/5'
  if (['DATE', 'DATEONLY', 'TIME'].includes(type)) return 'text-amber-400 border-amber-500/30 bg-amber-500/5'
  if (['BOOLEAN'].includes(type)) return 'text-purple-400 border-purple-500/30 bg-purple-500/5'
  if (['JSON', 'JSONB'].includes(type)) return 'text-orange-400 border-orange-500/30 bg-orange-500/5'
  if (['VIRTUAL'].includes(type)) return 'text-pink-400 border-pink-500/30 bg-pink-500/5'
  return 'text-slate-400 border-slate-500/30 bg-slate-500/5'
}

function DraggableTable() {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE_TABLE, 'new-table')
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg cursor-grab active:cursor-grabbing hover:bg-indigo-500/20 transition-colors select-none"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-indigo-400 shrink-0">
        <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H0V2zm0 3h16v9a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V5zm3 2v1h4V7H3zm0 3v1h4v-1H3zm6-3v1h4V7H9zm0 3v1h4v-1H9z" />
      </svg>
      <span className="text-xs font-medium text-indigo-300">New Table</span>
      <span className="text-[10px] text-indigo-500 ml-auto">drag</span>
    </div>
  )
}

function DraggableField({ type }: { type: FieldType }) {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE_FIELD, type)
    e.dataTransfer.effectAllowed = 'copy'
  }, [type])

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`px-2 py-1 border rounded cursor-grab active:cursor-grabbing hover:brightness-125 transition-all select-none text-[11px] font-mono ${typeColor(type)}`}
    >
      {type}
    </div>
  )
}

export function Toolbox() {
  return (
    <div className="px-2 py-2 border-b border-slate-700 space-y-2">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">
        Toolbox
      </div>

      {/* Draggable table */}
      <DraggableTable />

      {/* Draggable field types */}
      <div className="space-y-1.5">
        {FIELD_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-[9px] text-slate-600 uppercase tracking-wider px-1 mb-1">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1">
              {group.types.map((type) => (
                <DraggableField key={type} type={type} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
