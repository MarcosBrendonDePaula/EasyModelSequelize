import type { ValidationError, MigrationEntry } from '@shared/types/schema'

interface Props {
  designer: any
}

export function StatusBar({ designer }: Props) {
  const errors: ValidationError[] = designer.$state.validationErrors || []
  const errorCount = errors.filter(e => e.severity === 'error').length
  const warningCount = errors.filter(e => e.severity === 'warning').length
  const connected = designer.$connected
  const connectedUsers = designer.$state.connectedUsers || 0
  const lastEditedBy = designer.$state.lastEditedBy
  const migrations: MigrationEntry[] = designer.$state.migrations || []

  return (
    <footer className="flex items-center gap-4 px-4 py-1 bg-slate-900 border-t border-slate-700 text-xs shrink-0">
      {/* Connection */}
      <div className={`flex items-center gap-1 ${connected ? 'text-green-400' : 'text-red-400'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        {connected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Users */}
      {connectedUsers > 0 && (
        <div className="text-slate-400">
          {connectedUsers} user{connectedUsers !== 1 ? 's' : ''}
        </div>
      )}

      {/* Validation */}
      <div className="flex items-center gap-2">
        {errorCount > 0 && (
          <span className="text-red-400">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
        )}
        {warningCount > 0 && (
          <span className="text-yellow-400">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <span className="text-slate-500">No issues</span>
        )}
      </div>

      {/* Migrations */}
      {migrations.length > 0 && (
        <div className="text-indigo-400">
          {migrations.length} migration{migrations.length !== 1 ? 's' : ''}
        </div>
      )}

      <div className="flex-1" />

      {/* Last edited */}
      {lastEditedBy && (
        <div className="text-slate-500">
          Last edit: {lastEditedBy}
        </div>
      )}
    </footer>
  )
}
