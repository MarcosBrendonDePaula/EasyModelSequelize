// 🔒 LiveAdminPanel - Exemplo completo de Live Component com autenticação
//
// Demonstra todos os cenários de auth:
//  1. Componente público (sem auth)          → LiveCounter
//  2. Componente protegido (auth required)   → este componente
//  3. Componente com roles                   → este componente (role: admin)
//  4. Actions com permissões granulares      → deleteUser requer 'users.delete'
//  5. Acesso ao $auth dentro de actions      → getAuthInfo, audit trail
//
// Client: import { LiveAdminPanel } from '@server/live/LiveAdminPanel'
// Client link: import type { AdminPanelDemo as _Client } from '@client/src/live/AdminPanelDemo'

import { LiveComponent } from '@core/types/types'
import type { LiveComponentAuth, LiveActionAuthMap } from '@core/server/live/auth/types'

// ===== State =====

interface User {
  id: string
  name: string
  role: string
  createdAt: number
}

interface AuditEntry {
  action: string
  performedBy: string
  target?: string
  timestamp: number
}

interface AdminPanelState {
  users: User[]
  audit: AuditEntry[]
  currentUser: string | null
  currentRoles: string[]
  isAdmin: boolean
}

// ===== Component =====

export class LiveAdminPanel extends LiveComponent<AdminPanelState> {
  static componentName = 'LiveAdminPanel'
  static publicActions = ['getAuthInfo', 'init', 'listUsers', 'addUser', 'deleteUser', 'clearAudit'] as const

  static defaultState: AdminPanelState = {
    users: [
      { id: '1', name: 'Alice', role: 'admin', createdAt: Date.now() },
      { id: '2', name: 'Bob', role: 'user', createdAt: Date.now() },
      { id: '3', name: 'Carol', role: 'moderator', createdAt: Date.now() },
    ],
    audit: [],
    currentUser: null,
    currentRoles: [],
    isAdmin: false,
  }

  // ─────────────────────────────────────────
  // 🔒 Auth: requer autenticação + role admin
  // ─────────────────────────────────────────
  static auth: LiveComponentAuth = {
    required: true,
    roles: ['admin'],
  }

  // ─────────────────────────────────────────
  // 🔒 Auth por action: permissões granulares
  // ─────────────────────────────────────────
  static actionAuth: LiveActionAuthMap = {
    deleteUser: { permissions: ['users.delete'] },
    clearAudit: { roles: ['admin'] },
  }

  // ===== Actions =====

  /**
   * Retorna info do usuário autenticado.
   * Qualquer admin pode chamar (protegido pelo static auth do componente).
   */
  async getAuthInfo() {
    return {
      authenticated: this.$auth.authenticated,
      userId: this.$auth.user?.id,
      roles: this.$auth.user?.roles || [],
      permissions: this.$auth.user?.permissions || [],
      isAdmin: this.$auth.hasRole('admin'),
    }
  }

  /**
   * Popula o state com info do usuário autenticado.
   * Chamado pelo client após mount para exibir quem está logado.
   */
  async init() {
    this.setState({
      currentUser: this.$auth.user?.id || null,
      currentRoles: this.$auth.user?.roles || [],
      isAdmin: this.$auth.hasRole('admin'),
    })

    this.addAudit('LOGIN', this.$auth.user?.id || 'unknown')

    return { success: true }
  }

  /**
   * Lista usuários - qualquer admin pode.
   */
  async listUsers() {
    return { users: this.state.users }
  }

  /**
   * Adiciona um usuário - qualquer admin pode.
   */
  async addUser(payload: { name: string; role: string }) {
    const user: User = {
      id: String(Date.now()),
      name: payload.name,
      role: payload.role,
      createdAt: Date.now(),
    }

    this.setState({
      users: [...this.state.users, user],
    })

    this.addAudit('ADD_USER', this.$auth.user?.id || 'unknown', user.name)

    return { success: true, user }
  }

  /**
   * 🔒 Deleta um usuário.
   * Requer permissão 'users.delete' (via static actionAuth).
   * Se o usuário não tiver essa permissão, o framework bloqueia ANTES
   * de executar este método.
   */
  async deleteUser(payload: { userId: string }) {
    const user = this.state.users.find(u => u.id === payload.userId)
    if (!user) throw new Error('User not found')

    this.setState({
      users: this.state.users.filter(u => u.id !== payload.userId),
    })

    this.addAudit('DELETE_USER', this.$auth.user?.id || 'unknown', user.name)

    return { success: true }
  }

  /**
   * 🔒 Limpa o audit log.
   * Requer role 'admin' (via static actionAuth).
   */
  async clearAudit() {
    this.setState({ audit: [] })
    return { success: true }
  }

  // ===== Helpers (privados, não expostos como actions) =====

  private addAudit(action: string, performedBy: string, target?: string) {
    const entry: AuditEntry = {
      action,
      performedBy,
      target,
      timestamp: Date.now(),
    }
    this.setState({
      audit: [...this.state.audit, entry].slice(-20),
    })
  }
}
