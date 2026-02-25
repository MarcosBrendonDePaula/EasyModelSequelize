import { useState, useRef } from 'react'
import JSZip from 'jszip'
import type { DatabaseSchema, GeneratorResult } from '@shared/types/schema'
import { GeneratorModal } from './GeneratorModal'

interface Props {
  designer: any
  roomId: string
}

export function DesignerHeader({ designer, roomId }: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showGeneratorModal, setShowGeneratorModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleStartEdit = () => {
    setNameValue(designer.$state.schemaName)
    setEditingName(true)
  }

  const handleSaveName = () => {
    if (nameValue.trim()) {
      designer.setSchemaName({ name: nameValue.trim() })
    }
    setEditingName(false)
  }

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = async () => {
    try {
      const result = await designer.exportSchema() as { success: boolean; schema: DatabaseSchema }
      if (result?.schema) {
        const blob = new Blob([JSON.stringify(result.schema, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${designer.$state.schemaName.replace(/\s+/g, '_')}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      alert('Failed to export schema')
    }
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const schema = JSON.parse(text) as DatabaseSchema
      if (!schema.models || !Array.isArray(schema.models)) {
        alert('Invalid schema: missing "models" array')
        return
      }
      if (!schema.name || typeof schema.name !== 'string') {
        schema.name = file.name.replace(/\.json$/i, '')
      }
      await designer.importSchema({ schema })
    } catch {
      alert('Invalid JSON file')
    }
    e.target.value = ''
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await designer.generate() as { success: boolean; result: GeneratorResult }
      const genResult = res?.result
      if (!genResult?.files?.length) {
        alert(genResult?.errors?.join('\n') || 'No files generated')
        return
      }

      const zip = new JSZip()
      for (const file of genResult.files) {
        zip.file(file.path, file.content)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${designer.$state.schemaName.replace(/\s+/g, '_')}_${genResult.generatorId}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to generate files')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0">
      {/* Schema name */}
      <div className="flex items-center gap-2">
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
            className="px-2 py-1 bg-slate-800 border border-indigo-500 rounded text-white text-sm font-bold outline-none"
          />
        ) : (
          <button
            onClick={handleStartEdit}
            className="text-sm font-bold text-white hover:text-indigo-300 transition-colors"
          >
            {designer.$state.schemaName}
          </button>
        )}
      </div>

      {/* Room ID with copy feedback */}
      <button
        onClick={handleCopyRoomId}
        className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
          copied
            ? 'bg-green-900/30 border-green-500 text-green-300'
            : 'bg-slate-800 border-slate-600 hover:border-indigo-500'
        }`}
        title="Click to copy room ID"
      >
        <span className="text-slate-400">{copied ? 'Copied!' : 'Room:'}</span>
        {!copied && <span className="text-indigo-300 font-mono">{roomId}</span>}
      </button>

      {/* Generator selector — opens modal */}
      <button
        onClick={() => setShowGeneratorModal(true)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded hover:border-indigo-500 text-white transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-indigo-400">
          <path d="M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6h-1A1.5 1.5 0 0 1 6 4.5v-1zM1 3.5A1.5 1.5 0 0 1 2.5 2h1A1.5 1.5 0 0 1 5 3.5v1A1.5 1.5 0 0 1 3.5 6h-1A1.5 1.5 0 0 1 1 4.5v-1zM11 3.5A1.5 1.5 0 0 1 12.5 2h1A1.5 1.5 0 0 1 15 3.5v1A1.5 1.5 0 0 1 13.5 6h-1A1.5 1.5 0 0 1 11 4.5v-1zM6 10.5A1.5 1.5 0 0 1 7.5 9h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 6 11.5v-1zM1 10.5A1.5 1.5 0 0 1 2.5 9h1A1.5 1.5 0 0 1 5 10.5v1A1.5 1.5 0 0 1 3.5 13h-1A1.5 1.5 0 0 1 1 11.5v-1zM11 10.5A1.5 1.5 0 0 1 12.5 9h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 11 11.5v-1z"/>
        </svg>
        {designer.$state.availableGenerators.find((g: any) => g.id === designer.$state.activeGeneratorId)?.name || 'Generator'}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-slate-400">
          <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>

      <div className="flex-1" />

      {/* Actions */}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

      <button
        onClick={handleImport}
        className="px-3 py-1 text-xs bg-slate-800 border border-slate-600 rounded hover:border-blue-400 hover:text-blue-300 transition-colors"
      >
        Import
      </button>

      <button
        onClick={handleExport}
        className="px-3 py-1 text-xs bg-slate-800 border border-slate-600 rounded hover:border-green-400 hover:text-green-300 transition-colors"
      >
        Export
      </button>

      <button
        onClick={handleGenerate}
        disabled={!designer.$connected || generating}
        className="px-3 py-1 text-xs bg-indigo-600 rounded font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors min-w-[90px]"
      >
        {generating ? 'Generating...' : 'Generate ZIP'}
      </button>

      {/* Connection status */}
      <div className={`w-2 h-2 rounded-full ${designer.$connected ? 'bg-green-400' : 'bg-red-400'}`} />

      {/* Generator modal */}
      {showGeneratorModal && (
        <GeneratorModal
          generators={designer.$state.availableGenerators}
          activeId={designer.$state.activeGeneratorId}
          onSelect={(id: string) => designer.setActiveGenerator({ generatorId: id })}
          onClose={() => setShowGeneratorModal(false)}
        />
      )}
    </header>
  )
}
