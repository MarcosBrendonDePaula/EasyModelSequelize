// LiveChat - Chat compartilhado por sala

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { ChatDemo as _Client } from '@client/src/live/ChatDemo'

export type ChatMessage = {
  id: string
  user: string
  text: string
  timestamp: number
}

export class LiveChat extends LiveComponent<typeof LiveChat.defaultState> {
  static componentName = 'LiveChat'
  static publicActions = ['sendMessage'] as const
  static defaultState = {
    messages: [] as ChatMessage[]
  }
  protected roomType = 'chat'
  private maxMessages = 50
  private static roomHistory = new Map<string, ChatMessage[]>()

  constructor(initialState: Partial<typeof LiveChat.defaultState> = {}, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) {
    super(initialState, ws, options)

    this.onRoomEvent<ChatMessage>('NEW_MESSAGE', (message) => {
      this.addMessage(message)
    })

    if (this.room) {
      const history = LiveChat.roomHistory.get(this.room) || []
      if (history.length > 0) {
        this.setState({ messages: history })
      }
    }
  }

  private addMessage(message: ChatMessage) {
    const next = [...this.state.messages, message].slice(-this.maxMessages)
    if (this.room) {
      LiveChat.roomHistory.set(this.room, next)
    }
    this.setState({ messages: next })
  }

  async sendMessage(payload: { user: string; text: string }) {
    const text = payload.text?.trim()
    const user = payload.user?.trim() || 'anonymous'

    if (!text) {
      throw new Error('Message cannot be empty')
    }

    if (text.length > 500) {
      throw new Error('Message too long')
    }

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user,
      text,
      timestamp: Date.now()
    }

    const next = [...this.state.messages, message].slice(-this.maxMessages)
    if (this.room) {
      LiveChat.roomHistory.set(this.room, next)
    }

    this.emitRoomEventWithState('NEW_MESSAGE', message, {
      messages: next
    })

    return { success: true }
  }
}
