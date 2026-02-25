// 🔒 LiveProtectedChat - Exemplo de Live Component com autenticação
//
// Demonstra como usar o sistema de auth em Live Components:
// - static auth: define que o componente requer autenticação
// - static actionAuth: define permissões por action
// - this.$auth: acessa o contexto de auth dentro do componente
//
// Client usage:
//   import type { LiveProtectedChat as _Client } from '@client/src/live/ProtectedChat'

import { LiveComponent } from '@core/types/types'
import type { LiveComponentAuth, LiveActionAuthMap } from '@core/server/live/auth/types'

interface ChatMessage {
  id: number
  userId: string
  text: string
  timestamp: number
  isAdmin: boolean
}

interface ProtectedChatState {
  messages: ChatMessage[]
  userCount: number
  currentUser: string | null
  isAdmin: boolean
}

export class LiveProtectedChat extends LiveComponent<ProtectedChatState> {
  static componentName = 'LiveProtectedChat'
  static publicActions = ['join', 'sendMessage', 'deleteMessage', 'clearMessages', 'getAuthInfo'] as const

  static defaultState: ProtectedChatState = {
    messages: [],
    userCount: 0,
    currentUser: null,
    isAdmin: false,
  }

  // 🔒 Auth: componente requer autenticação
  static auth: LiveComponentAuth = {
    required: true,
  }

  // 🔒 Auth por action: deleteMessage requer permissão 'chat.admin'
  static actionAuth: LiveActionAuthMap = {
    deleteMessage: { permissions: ['chat.admin'] },
    clearMessages: { roles: ['admin'] },
  }

  protected roomType = 'protected-chat'

  constructor(
    initialState: Partial<ProtectedChatState>,
    ws: any,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)

    // Escutar mensagens de outros usuários na sala
    this.onRoomEvent<ChatMessage>('NEW_MESSAGE', (msg) => {
      const messages = [...this.state.messages, msg].slice(-50)
      this.setState({ messages })
    })

    this.onRoomEvent<{ count: number }>('USER_COUNT', (data) => {
      this.setState({ userCount: data.count })
    })
  }

  /**
   * Entra na sala e configura info do usuário autenticado
   */
  async join(payload: { room: string }) {
    this.$room(payload.room).join()

    // 🔒 Usar $auth para identificar o usuário
    const userId = this.$auth.user?.id || this.userId || 'anonymous'
    const isAdmin = this.$auth.hasRole('admin')

    this.setState({
      currentUser: userId,
      isAdmin,
    })

    return { success: true, userId, isAdmin }
  }

  /**
   * Envia mensagem - qualquer usuário autenticado pode enviar
   */
  async sendMessage(payload: { text: string }) {
    if (!payload.text?.trim()) {
      throw new Error('Message cannot be empty')
    }

    const message: ChatMessage = {
      id: Date.now(),
      userId: this.$auth.user?.id || this.userId || 'unknown',
      text: payload.text.trim(),
      timestamp: Date.now(),
      isAdmin: this.$auth.hasRole('admin'),
    }

    // Atualiza estado local + notifica outros na sala
    this.emitRoomEventWithState(
      'NEW_MESSAGE',
      message,
      { messages: [...this.state.messages, message].slice(-50) }
    )

    return { success: true, messageId: message.id }
  }

  /**
   * Deleta uma mensagem - requer permissão 'chat.admin'
   * (protegido via static actionAuth)
   */
  async deleteMessage(payload: { messageId: number }) {
    const messages = this.state.messages.filter(m => m.id !== payload.messageId)
    this.setState({ messages })

    // Notificar outros na sala
    this.emitRoomEvent('MESSAGE_DELETED', { messageId: payload.messageId })

    return { success: true }
  }

  /**
   * Limpa todas as mensagens - requer role 'admin'
   * (protegido via static actionAuth)
   */
  async clearMessages() {
    this.setState({ messages: [] })
    this.emitRoomEvent('MESSAGES_CLEARED', {})
    return { success: true }
  }

  /**
   * Retorna info do usuário autenticado (sem restrição extra)
   */
  async getAuthInfo() {
    return {
      authenticated: this.$auth.authenticated,
      userId: this.$auth.user?.id,
      roles: this.$auth.user?.roles,
      permissions: this.$auth.user?.permissions,
      isAdmin: this.$auth.hasRole('admin'),
    }
  }
}
