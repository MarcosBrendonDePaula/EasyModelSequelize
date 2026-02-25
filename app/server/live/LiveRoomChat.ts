// LiveRoomChat - Chat multi-salas simplificado

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { RoomChatDemo as _Client } from '@client/src/live/RoomChatDemo'

export interface ChatMessage {
  id: string
  user: string
  text: string
  timestamp: number
}

export class LiveRoomChat extends LiveComponent<typeof LiveRoomChat.defaultState> {
  static componentName = 'LiveRoomChat'
  static publicActions = ['joinRoom', 'leaveRoom', 'switchRoom', 'sendMessage', 'setUsername'] as const
  static defaultState = {
    username: '',
    activeRoom: null as string | null,
    rooms: [] as { id: string; name: string }[],
    messages: {} as Record<string, ChatMessage[]>
  }

  // Listeners por sala para evitar duplicação
  private roomListeners = new Map<string, (() => void)[]>()

  constructor(
    initialState: Partial<typeof LiveRoomChat.defaultState> = {},
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)
  }

  async joinRoom(payload: { roomId: string; roomName?: string }) {
    const { roomId, roomName } = payload

    // Já está na sala? Apenas ativar
    if (this.roomListeners.has(roomId)) {
      this.state.activeRoom = roomId
      return { success: true, roomId }
    }

    // Entrar e escutar mensagens
    this.$room(roomId).join()
    const unsub = this.$room(roomId).on('message:new', (msg: ChatMessage) => {
      const msgs = this.state.messages[roomId] || []
      this.setState({
        messages: { ...this.state.messages, [roomId]: [...msgs, msg].slice(-100) }
      })
    })
    this.roomListeners.set(roomId, [unsub])

    // Atualizar estado
    this.setState({
      activeRoom: roomId,
      rooms: [...this.state.rooms.filter(r => r.id !== roomId), { id: roomId, name: roomName || roomId }],
      messages: { ...this.state.messages, [roomId]: this.state.messages[roomId] || [] }
    })

    return { success: true, roomId }
  }

  async leaveRoom(payload: { roomId: string }) {
    const { roomId } = payload

    // Limpar listeners
    this.roomListeners.get(roomId)?.forEach(fn => fn())
    this.roomListeners.delete(roomId)
    this.$room(roomId).leave()

    // Atualizar estado
    const rooms = this.state.rooms.filter(r => r.id !== roomId)
    const { [roomId]: _, ...restMessages } = this.state.messages

    this.setState({
      rooms,
      activeRoom: this.state.activeRoom === roomId ? (rooms[0]?.id || null) : this.state.activeRoom,
      messages: restMessages
    })

    return { success: true }
  }

  async switchRoom(payload: { roomId: string }) {
    if (!this.$rooms.includes(payload.roomId)) throw new Error('Not in this room')
    this.state.activeRoom = payload.roomId
    return { success: true }
  }

  async sendMessage(payload: { text: string }) {
    const roomId = this.state.activeRoom
    if (!roomId) throw new Error('No active room')

    const text = payload.text?.trim()
    if (!text) throw new Error('Message cannot be empty')

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: this.state.username || 'Anônimo',
      text,
      timestamp: Date.now()
    }

    // Adicionar localmente e emitir para outros
    const msgs = this.state.messages[roomId] || []
    this.setState({
      messages: { ...this.state.messages, [roomId]: [...msgs, message].slice(-100) }
    })
    this.$room(roomId).emit('message:new', message)

    return { success: true, message }
  }

  async setUsername(payload: { username: string }) {
    const username = payload.username?.trim()
    if (!username || username.length > 30) throw new Error('Invalid username')
    this.state.username = username
    return { success: true }
  }

  destroy() {
    for (const fns of this.roomListeners.values()) fns.forEach(fn => fn())
    this.roomListeners.clear()
    super.destroy()
  }
}
