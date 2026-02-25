import { useState, useRef } from 'react'
import { FIELD_TYPES, type SchemaField } from '@shared/types/schema'

interface Props {
  field: SchemaField
  modelId: string
  designer: any
}

// ── Enum tag editor ─────────────────────────────────────

function EnumTagEditor({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addValue = (raw: string) => {
    const v = raw.trim()
    if (!v) return
    if (values.includes(v)) { setInput(''); return }
    onChange([...values, v])
    setInput('')
  }

  const removeValue = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx))
    if (editIdx === idx) setEditIdx(null)
  }

  const startEdit = (idx: number) => {
    setEditIdx(idx)
    setEditValue(values[idx])
  }

  const saveEdit = (idx: number) => {
    const v = editValue.trim()
    if (!v || (v !== values[idx] && values.includes(v))) {
      setEditIdx(null)
      return
    }
    const next = [...values]
    next[idx] = v
    onChange(next)
    setEditIdx(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addValue(input)
    } else if (e.key === 'Backspace' && !input && values.length > 0) {
      removeValue(values.length - 1)
    }
  }

  return (
    <div className="mt-1.5">
      <div
        className="flex flex-wrap gap-1 p-1.5 bg-slate-900 border border-amber-600/40 rounded-md min-h-[32px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v, i) => (
          <span key={`${v}-${i}`} className="group/tag flex items-center gap-0.5 shrink-0">
            {editIdx === i ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => saveEdit(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(i)
                  if (e.key === 'Escape') setEditIdx(null)
                }}
                className="w-16 px-1 py-px text-[11px] bg-amber-900/40 border border-amber-500 rounded text-amber-200 outline-none"
              />
            ) : (
              <span
                className="flex items-center gap-0.5 px-1.5 py-px text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded cursor-default hover:bg-amber-500/25 transition-colors"
                onDoubleClick={() => startEdit(i)}
                title="Double-click to edit"
              >
                {v}
                <button
                  onClick={(e) => { e.stopPropagation(); removeValue(i) }}
                  className="ml-0.5 text-amber-500/50 hover:text-red-400 transition-colors leading-none"
                  title="Remove"
                >
                  <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                  </svg>
                </button>
              </span>
            )}
          </span>
        ))}

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) addValue(input) }}
          placeholder={values.length === 0 ? 'Type value + Enter' : '+'}
          className="flex-1 min-w-[60px] px-1 py-px text-[11px] bg-transparent text-amber-200 placeholder-amber-700/60 outline-none"
        />
      </div>

      {values.length > 0 && (
        <div className="flex items-center justify-between mt-1 px-0.5">
          <span className="text-[9px] text-slate-600">{values.length} value{values.length !== 1 ? 's' : ''}</span>
          <span className="text-[9px] text-slate-600">dbl-click to edit · backspace to remove last</span>
        </div>
      )}
    </div>
  )
}

// ── FieldRow ────────────────────────────────────────────

export function FieldRow({ field, modelId, designer }: Props) {
  const [name, setName] = useState(field.name)

  const handleNameBlur = () => {
    if (name !== field.name) {
      designer.updateField({ modelId, fieldId: field.id, updates: { name } })
    }
  }

  const handleTypeChange = (type: string) => {
    designer.updateField({ modelId, fieldId: field.id, updates: { type } })
  }

  const toggleProperty = (prop: string) => {
    designer.updateField({
      modelId,
      fieldId: field.id,
      updates: {
        properties: {
          ...field.properties,
          [prop]: !field.properties[prop as keyof typeof field.properties]
        }
      }
    })
  }

  const handleDefaultValue = (defaultValue: string) => {
    designer.updateField({
      modelId,
      fieldId: field.id,
      updates: { properties: { ...field.properties, defaultValue } }
    })
  }

  const handleEnumChange = (enumValues: string[]) => {
    designer.updateField({
      modelId,
      fieldId: field.id,
      updates: { properties: { ...field.properties, enumValues } }
    })
  }

  const handleNumericProp = (prop: 'length' | 'precision' | 'scale', raw: string) => {
    const val = parseInt(raw, 10)
    designer.updateField({
      modelId,
      fieldId: field.id,
      updates: { properties: { ...field.properties, [prop]: isNaN(val) ? 0 : Math.max(0, val) } }
    })
  }

  const handleDelete = () => {
    designer.removeField({ modelId, fieldId: field.id })
  }

  const isNumeric = ['TINYINT', 'INTEGER', 'SMALLINT', 'BIGINT', 'FLOAT', 'REAL', 'DOUBLE', 'DECIMAL', 'MONEY'].includes(field.type)
  const hasLength = ['STRING', 'CHAR'].includes(field.type)
  const hasDecimal = ['DECIMAL', 'MONEY'].includes(field.type)
  const isEnum = field.type === 'ENUM'
  const isVirtual = field.type === 'VIRTUAL'

  return (
    <div className={`px-3 py-2 rounded border group ${isVirtual ? 'bg-pink-900/10 border-pink-500/20' : 'bg-slate-800/50 border-slate-700'}`}>
      <div className="flex items-center gap-2">
        {/* Field name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="field name"
          className="w-32 px-2 py-1 text-sm bg-slate-900 border border-slate-600 rounded text-white outline-none focus:border-purple-500"
        />

        {/* Type selector */}
        <select
          value={field.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-28 px-1 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-white outline-none focus:border-purple-500"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Property toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleProperty('primaryKey')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
              field.properties.primaryKey
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                : 'bg-slate-700 text-slate-500 border border-slate-600'
            }`}
            title="Primary Key"
          >
            PK
          </button>

          <button
            onClick={() => toggleProperty('allowNull')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
              !field.properties.allowNull
                ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                : 'bg-slate-700 text-slate-500 border border-slate-600'
            }`}
            title={field.properties.allowNull ? 'Nullable' : 'NOT NULL'}
          >
            NN
          </button>

          {isNumeric && (
            <button
              onClick={() => toggleProperty('autoIncrement')}
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                field.properties.autoIncrement
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'bg-slate-700 text-slate-500 border border-slate-600'
              }`}
              title="Auto Increment"
            >
              AI
            </button>
          )}

          <button
            onClick={() => toggleProperty('unique')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
              field.properties.unique
                ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                : 'bg-slate-700 text-slate-500 border border-slate-600'
            }`}
            title="Unique"
          >
            UQ
          </button>
        </div>

        {/* Default value */}
        <input
          value={field.properties.defaultValue}
          onChange={(e) => handleDefaultValue(e.target.value)}
          placeholder="default"
          className="w-20 px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded text-slate-300 outline-none focus:border-purple-500"
        />

        {/* Length — STRING / CHAR */}
        {hasLength && (
          <input
            value={field.properties.length || ''}
            onChange={(e) => handleNumericProp('length', e.target.value)}
            placeholder="len"
            title="VARCHAR length (0 = default 255)"
            className="w-12 px-1 py-1 text-xs bg-slate-900 border border-cyan-600/40 rounded text-cyan-300 outline-none focus:border-cyan-500 text-center"
          />
        )}

        {/* Precision / Scale — DECIMAL / MONEY */}
        {hasDecimal && (
          <>
            <input
              value={field.properties.precision || ''}
              onChange={(e) => handleNumericProp('precision', e.target.value)}
              placeholder="prec"
              title="Precision (total digits, 0 = default)"
              className="w-12 px-1 py-1 text-xs bg-slate-900 border border-orange-600/40 rounded text-orange-300 outline-none focus:border-orange-500 text-center"
            />
            <input
              value={field.properties.scale || ''}
              onChange={(e) => handleNumericProp('scale', e.target.value)}
              placeholder="scl"
              title="Scale (decimal digits, 0 = default)"
              className="w-12 px-1 py-1 text-xs bg-slate-900 border border-orange-600/40 rounded text-orange-300 outline-none focus:border-orange-500 text-center"
            />
          </>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-sm ml-auto transition-opacity"
          title="Delete field"
        >
          x
        </button>
      </div>

      {/* Enum values editor — expands below the row */}
      {isEnum && (
        <EnumTagEditor
          values={field.properties.enumValues || []}
          onChange={handleEnumChange}
        />
      )}
    </div>
  )
}
