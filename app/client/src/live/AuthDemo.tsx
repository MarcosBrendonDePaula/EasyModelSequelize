// 🔒 AuthDemo - Exemplo completo de autenticação em Live Components
//
// Demonstra:
//  1. Conexão autenticada via LiveComponentsProvider
//  2. Auth dinâmico via useLiveComponents().authenticate()
//  3. Componente público (sem auth)
//  4. Componente protegido (requer auth + role)
//  5. Actions protegidas por permissão
//  6. Leitura de $authenticated no proxy

import { useState } from 'react'
import { Live, useLiveComponents } from '@/core/client'
import type { LiveAuthOptions } from '@/core/client'
import { LiveCounter } from '@server/live/LiveCounter'
import { LiveAdminPanel } from '@server/live/LiveAdminPanel'

// ───────────────────────────────────────
// 1. Componente público (sem auth)
//    Funciona para qualquer visitante
// ───────────────────────────────────────

function PublicSection() {
  const counter = Live.use(LiveCounter, {
    room: 'public-counter',
    initialState: LiveCounter.defaultState,
    persistState: false,
  })

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-white mb-1">Contador Público</h3>
      <p className="text-gray-400 text-xs mb-4">Sem autenticação necessária</p>

      <div className="flex items-center gap-4">
        <button
          onClick={() => counter.decrement()}
          className="px-3 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
        >
          −
        </button>
        <span className="text-3xl font-bold text-white">{counter.$state.count}</span>
        <button
          onClick={() => counter.increment()}
          className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
        >
          +
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        $authenticated: <code className="text-yellow-300">{String(counter.$authenticated)}</code>
      </div>
    </div>
  )
}

// ───────────────────────────────────────
// 2. Painel admin (requer auth + role)
//    Demonstra $auth no servidor
// ───────────────────────────────────────

function AdminSection() {
  const [newUserName, setNewUserName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const panel = Live.use(LiveAdminPanel, { persistState: false })

  // Se não autenticado ou sem permissão, o mount falha com AUTH_DENIED
  if (panel.$error?.includes('AUTH_DENIED')) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-red-300 mb-2">Painel Admin</h3>
        <p className="text-red-400 text-sm">
          Acesso negado: {panel.$error}
        </p>
        <p className="text-gray-400 text-xs mt-2">
          Autentique-se com role &quot;admin&quot; para acessar.
        </p>
      </div>
    )
  }

  if (panel.$status === 'mounting' || panel.$loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          Montando painel admin...
        </div>
      </div>
    )
  }

  const handleAddUser = async () => {
    if (!newUserName.trim()) return
    try {
      await panel.addUser({ name: newUserName.trim(), role: 'user' })
      setNewUserName('')
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await panel.deleteUser({ userId })
      setError(null)
    } catch (e: any) {
      // Se AUTH_DENIED, significa que faltou a permissão 'users.delete'
      setError(e.message)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Painel Admin</h3>
          <p className="text-gray-400 text-xs">
            Requer: <code className="text-purple-300">auth.required + roles: [&apos;admin&apos;]</code>
          </p>
        </div>
        <div className="text-xs text-right">
          <div className="text-gray-400">
            User: <span className="text-emerald-300">{panel.$state.currentUser || '...'}</span>
          </div>
          <div className="text-gray-400">
            Roles: <span className="text-yellow-300">{panel.$state.currentRoles.join(', ') || '...'}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* User list */}
      <div className="space-y-2 mb-4">
        {panel.$state.users.map(user => (
          <div key={user.id} className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-2">
            <div>
              <span className="text-white font-medium">{user.name}</span>
              <span className="text-gray-500 text-xs ml-2">({user.role})</span>
            </div>
            <button
              onClick={() => handleDeleteUser(user.id)}
              className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
              title="Requer permissão 'users.delete'"
            >
              Deletar
            </button>
          </div>
        ))}
      </div>

      {/* Add user */}
      <div className="flex gap-2">
        <input
          value={newUserName}
          onChange={e => setNewUserName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddUser()}
          placeholder="Nome do usuário..."
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <button
          onClick={handleAddUser}
          className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-200 text-sm hover:bg-purple-500/30"
        >
          Adicionar
        </button>
      </div>

      {/* Audit log */}
      {panel.$state.audit.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-300">Audit Log</h4>
            <button
              onClick={() => panel.clearAudit()}
              className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
              title="Requer role 'admin'"
            >
              Limpar
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-auto">
            {panel.$state.audit.map((entry, i) => (
              <div key={i} className="text-xs text-gray-500">
                <span className="text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                {' '}<span className="text-blue-300">{entry.action}</span>
                {' '}by <span className="text-emerald-300">{entry.performedBy}</span>
                {entry.target && <> on <span className="text-yellow-300">{entry.target}</span></>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────
// 3. Controle de autenticação
//    Simula login/logout via authenticate()
// ───────────────────────────────────────

function AuthControls() {
  const { authenticated, authenticate, reconnect } = useLiveComponents()
  const [token, setToken] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleLogin = async () => {
    if (!token.trim()) return
    setIsLoggingIn(true)
    await authenticate({ token: token.trim() })
    setIsLoggingIn(false)
    // Componentes detectam automaticamente a mudança de auth e remontam
  }

  const handleLogout = () => {
    setToken('')
    // Reconectar sem token = nova conexão anônima
    reconnect()
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-2">Autenticação</h3>

      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${authenticated ? 'bg-emerald-400' : 'bg-gray-500'}`} />
        <span className={`text-sm ${authenticated ? 'text-emerald-300' : 'text-gray-400'}`}>
          {authenticated ? 'Autenticado' : 'Não autenticado'}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="Token (JWT, API key, etc.)"
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <div className="flex gap-2">
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-sm hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {isLoggingIn ? 'Autenticando...' : 'Login'}
          </button>
          {authenticated && (
            <button
              onClick={handleLogout}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm hover:bg-red-500/30"
            >
              Logout
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <p className="text-emerald-300 text-xs font-semibold mb-2">Tokens de teste (dev only):</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => { setToken('admin-token'); }}
            className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
          >
            admin-token
          </button>
          <button
            onClick={() => { setToken('user-token'); }}
            className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
          >
            user-token
          </button>
          <button
            onClick={() => { setToken('mod-token'); }}
            className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30"
          >
            mod-token
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-2">
          Clique para preencher o campo, depois clique em Login.
        </p>
      </div>

      <p className="text-gray-500 text-xs mt-3">
        Fluxo: <code>authenticate(&#123; token &#125;)</code> envia mensagem <code>AUTH</code> via WebSocket.
        O servidor valida via <code>LiveAuthProvider</code> registrado.
      </p>
    </div>
  )
}

// ───────────────────────────────────────
// 4. Demo principal
// ───────────────────────────────────────

export function AuthDemo() {
  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Live Components Auth</h2>
        <p className="text-gray-400">
          Sistema de autenticação declarativo para componentes real-time
        </p>
      </div>

      <AuthControls />

      <div className="grid gap-6">
        <PublicSection />
        <AdminSection />
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 text-xs text-gray-500 space-y-2 overflow-x-auto">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Como funciona</h4>
        <p><strong className="text-purple-300">Server:</strong> <code>static auth = &#123; required: true, roles: [&apos;admin&apos;] &#125;</code></p>
        <p><strong className="text-purple-300">Server:</strong> <code>static actionAuth = &#123; deleteUser: &#123; permissions: [&apos;users.delete&apos;] &#125; &#125;</code></p>
        <p><strong className="text-purple-300">Server:</strong> <code>this.$auth.hasRole(&apos;admin&apos;)</code> dentro das actions</p>
        <p><strong className="text-blue-300">Client:</strong> <code>component.$authenticated</code> no proxy</p>
        <p><strong className="text-blue-300">Client:</strong> <code>useLiveComponents().authenticate(&#123; token &#125;)</code> para login</p>
        <p><strong className="text-blue-300">Client:</strong> <code>&lt;LiveComponentsProvider auth=&#123;&#123; token &#125;&#125;&gt;</code> para auth na conexão</p>
      </div>
    </div>
  )
}
