import { useState } from 'react'
import type { SchemaModel, GeneratedFile, GeneratorResult, MigrationEntry } from '@shared/types/schema'
import { ModelEditor } from './ModelEditor'

interface Props {
  designer: any
  activeModel: SchemaModel | undefined
}

type Tab = 'editor' | 'code' | 'migrations'

export function RightPanel({ designer, activeModel }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('editor')
  const [codeTab, setCodeTab] = useState(0)

  const previewFiles: GeneratedFile[] = designer.$state.previewFiles || []
  const generatedCode: GeneratorResult | null = designer.$state.generatedCode
  const files = generatedCode?.files || previewFiles
  const errors = generatedCode?.errors || []
  const migrations: MigrationEntry[] = designer.$state.migrations || []

  // Auto-switch to editor tab when a model is selected, unless on migrations
  const effectiveTab = activeTab === 'migrations'
    ? 'migrations'
    : activeModel ? activeTab : 'code'

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-8 bg-slate-900 border-l border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors shrink-0"
        title="Show panel"
      >
        <span className="text-slate-400 text-xs [writing-mode:vertical-lr]">
          {activeModel ? 'Editor / Code' : 'Code Preview'}
        </span>
      </button>
    )
  }

  const handleClearMigrations = async () => {
    if (migrations.length === 0) return
    await designer.clearMigrations()
  }

  return (
    <aside className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col shrink-0">
      {/* Tab header */}
      <div className="flex items-center border-b border-slate-700 shrink-0">
        {activeModel && (
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              effectiveTab === 'editor'
                ? 'border-indigo-500 text-indigo-300 bg-slate-800/50'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Editor
          </button>
        )}
        <button
          onClick={() => setActiveTab('code')}
          className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
            effectiveTab === 'code'
              ? 'border-indigo-500 text-indigo-300 bg-slate-800/50'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Code
        </button>
        <button
          onClick={() => setActiveTab('migrations')}
          className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
            effectiveTab === 'migrations'
              ? 'border-indigo-500 text-indigo-300 bg-slate-800/50'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Migrations{migrations.length > 0 ? ` (${migrations.length})` : ''}
        </button>
        <button
          onClick={() => setCollapsed(true)}
          className="px-2 py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          title="Collapse panel"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.354 3.646a.5.5 0 0 1 0 .708L2.707 8l3.647 3.646a.5.5 0 0 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 0 1 .708 0zm6 0a.5.5 0 0 1 0 .708L8.707 8l3.647 3.646a.5.5 0 0 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 0 1 .708 0z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {effectiveTab === 'editor' && activeModel ? (
        <ModelEditor designer={designer} model={activeModel} />
      ) : effectiveTab === 'migrations' ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Migrations header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 shrink-0">
            <span className="text-xs text-slate-400">
              {migrations.length} migration{migrations.length !== 1 ? 's' : ''} tracked
            </span>
            {migrations.length > 0 && (
              <button
                onClick={handleClearMigrations}
                className="px-2 py-0.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Migrations list */}
          <div className="flex-1 overflow-auto">
            {migrations.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8 px-4">
                No migrations yet. Make changes to the schema to start tracking.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {[...migrations].reverse().map((entry, i) => (
                  <div key={entry.id} className="px-3 py-2 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-500">
                        #{migrations.length - i}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 leading-snug">
                      {entry.description}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {summarizeOps(entry.ops).map((badge, j) => (
                        <span
                          key={j}
                          className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* File tabs */}
          {files.length > 0 && (
            <div className="flex overflow-x-auto border-b border-slate-700 shrink-0">
              {files.map((file, i) => (
                <button
                  key={file.path}
                  onClick={() => setCodeTab(i)}
                  className={`px-3 py-1.5 text-xs whitespace-nowrap border-b-2 transition-colors ${
                    i === codeTab
                      ? 'border-indigo-500 text-indigo-300 bg-slate-800/50'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {file.path}
                </button>
              ))}
            </div>
          )}

          {/* Code content */}
          <div className="flex-1 overflow-auto p-3">
            {files.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                Select a model to preview generated code,
                or click Generate to see all files.
              </div>
            ) : (
              <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap leading-relaxed">
                {files[codeTab]?.content || ''}
              </pre>
            )}

            {errors.length > 0 && (
              <div className="mt-4 space-y-1">
                {errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
                    {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

function summarizeOps(ops: MigrationEntry['ops']) {
  const counts: Record<string, number> = {}
  for (const op of ops) {
    counts[op.type] = (counts[op.type] || 0) + 1
  }

  const colorMap: Record<string, string> = {
    createTable: 'bg-green-500/20 text-green-300',
    dropTable: 'bg-red-500/20 text-red-300',
    renameTable: 'bg-yellow-500/20 text-yellow-300',
    addColumn: 'bg-blue-500/20 text-blue-300',
    removeColumn: 'bg-orange-500/20 text-orange-300',
    changeColumn: 'bg-purple-500/20 text-purple-300',
  }

  const labelMap: Record<string, string> = {
    createTable: 'CREATE',
    dropTable: 'DROP',
    renameTable: 'RENAME',
    addColumn: 'ADD COL',
    removeColumn: 'RM COL',
    changeColumn: 'ALTER',
  }

  return Object.entries(counts).map(([type, count]) => ({
    label: `${labelMap[type] || type}${count > 1 ? ` x${count}` : ''}`,
    color: colorMap[type] || 'bg-slate-500/20 text-slate-300',
  }))
}
