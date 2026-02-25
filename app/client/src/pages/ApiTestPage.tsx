import type { ReactNode } from 'react'
import { BackButton } from '../components/BackButton'

export function ApiTestPage({
  apiResponse,
  isLoading,
  onHealth,
  onGetUsers,
  onCreateUser
}: {
  apiResponse: string
  isLoading: boolean
  onHealth: () => void
  onGetUsers: () => void
  onCreateUser: () => void
}) {
  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-4xl">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <BackButton />
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Eden Treaty API Test
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <ActionCard
          icon="🏥"
          title="GET /api/health"
          subtitle="Health Check"
          onClick={onHealth}
          disabled={isLoading}
          className="bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
        />
        <ActionCard
          icon="👥"
          title="GET /api/users"
          subtitle="List Users"
          onClick={onGetUsers}
          disabled={isLoading}
          className="bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30"
        />
        <ActionCard
          icon="➕"
          title="POST /api/users"
          subtitle="Create User"
          onClick={onCreateUser}
          disabled={isLoading}
          className="bg-purple-500/20 border-purple-500/30 text-purple-300 hover:bg-purple-500/30"
        />
      </div>

      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Response</h2>
          {isLoading && (
            <div className="flex items-center gap-2 text-yellow-400">
              <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
              Loading...
            </div>
          )}
        </div>
        <pre className="bg-black/60 rounded-xl p-4 overflow-auto max-h-96 text-sm font-mono">
          <code className="text-green-400">
            {apiResponse || '// Click a button above to test the API\\n// Type inference works automatically!'}
          </code>
        </pre>
      </div>

      <div className="mt-6 sm:mt-8 bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-white mb-3">How it works</h3>
        <div className="text-gray-400 text-sm space-y-2">
          <p>OK <code className="text-purple-400">api.health.get()</code> - Full type inference from server</p>
          <p>OK <code className="text-purple-400">api.users.post({'{ name, email }'})</code> - Request body is typed</p>
          <p>OK <code className="text-purple-400">{'{ data, error }'}</code> - Response is typed automatically</p>
        </div>
      </div>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
  className
}: {
  icon: ReactNode
  title: string
  subtitle: string
  onClick: () => void
  disabled: boolean
  className: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 sm:px-6 py-3 sm:py-4 border rounded-xl font-medium transition-all disabled:opacity-50 text-sm sm:text-base ${className}`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div>{title}</div>
      <div className="text-xs opacity-70 mt-1">{subtitle}</div>
    </button>
  )
}
