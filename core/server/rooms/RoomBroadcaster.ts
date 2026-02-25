// 🔥 FluxStack Room Broadcaster - WebSocket integration for rooms

import type { ServerWebSocket } from 'bun'
import type { Room, RoomSystem, SystemEvents } from './RoomSystem'

type WebSocketLike = {
  send: (data: string) => void
  readyState?: number
}

interface RoomConnection {
  id: string
  ws: WebSocketLike
  rooms: Set<string>
  userId?: string
}

interface BroadcastMessage {
  type: 'room:event' | 'room:state' | 'room:system'
  roomId: string
  event: string
  data: any
  timestamp: number
  senderId?: string
}

export class RoomBroadcaster<TState, TEvents extends Record<string, any>> {
  private connections = new Map<string, RoomConnection>()
  private roomConnections = new Map<string, Set<string>>() // roomId -> connectionIds
  private roomSystem: RoomSystem<TState, TEvents>
  private systemListeners: (() => void)[] = []

  constructor(roomSystem: RoomSystem<TState, TEvents>) {
    this.roomSystem = roomSystem
    this.setupSystemListeners()
  }

  private setupSystemListeners(): void {
    // Escutar eventos globais do sistema
    const unsub1 = this.roomSystem.on('$room:destroyed', ({ roomId }) => {
      // Limpar conexões quando sala é destruída
      this.roomConnections.delete(roomId)
    })

    this.systemListeners.push(unsub1)
  }

  // ============================================
  // Gerenciamento de conexões
  // ============================================

  /**
   * Registra uma nova conexão WebSocket
   */
  connect(ws: WebSocketLike, userId?: string): string {
    const connectionId = this.generateId()

    this.connections.set(connectionId, {
      id: connectionId,
      ws,
      rooms: new Set(),
      userId
    })

    return connectionId
  }

  /**
   * Remove uma conexão
   */
  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    // Sair de todas as salas
    for (const roomId of connection.rooms) {
      this.leave(connectionId, roomId)
    }

    this.connections.delete(connectionId)
  }

  /**
   * Entra em uma sala
   */
  join(connectionId: string, roomId: string, initialState: TState): Room<TState, TEvents> | null {
    const connection = this.connections.get(connectionId)
    if (!connection) return null

    // Adicionar à sala
    connection.rooms.add(roomId)

    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set())
    }
    this.roomConnections.get(roomId)!.add(connectionId)

    // Obter ou criar sala
    const room = this.roomSystem.getOrCreate(roomId, initialState)

    // Enviar estado atual para o cliente
    this.sendTo(connectionId, {
      type: 'room:state',
      roomId,
      event: '$state:sync',
      data: { state: room.state },
      timestamp: Date.now()
    })

    return room
  }

  /**
   * Sai de uma sala
   */
  leave(connectionId: string, roomId: string): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection) return false

    connection.rooms.delete(roomId)

    const roomConns = this.roomConnections.get(roomId)
    if (roomConns) {
      roomConns.delete(connectionId)
      if (roomConns.size === 0) {
        this.roomConnections.delete(roomId)
      }
    }

    return true
  }

  /**
   * Retorna as salas de uma conexão
   */
  getRooms(connectionId: string): string[] {
    const connection = this.connections.get(connectionId)
    return connection ? Array.from(connection.rooms) : []
  }

  /**
   * Verifica se conexão está em uma sala
   */
  isInRoom(connectionId: string, roomId: string): boolean {
    const connection = this.connections.get(connectionId)
    return connection?.rooms.has(roomId) ?? false
  }

  // ============================================
  // Broadcast
  // ============================================

  /**
   * Envia evento para todos na sala
   */
  broadcast(
    roomId: string,
    event: string,
    data: any,
    options?: { exclude?: string | string[] }
  ): number {
    const roomConns = this.roomConnections.get(roomId)
    if (!roomConns || roomConns.size === 0) return 0

    const excludeSet = new Set(
      Array.isArray(options?.exclude)
        ? options.exclude
        : options?.exclude
          ? [options.exclude]
          : []
    )

    const message: BroadcastMessage = {
      type: 'room:event',
      roomId,
      event,
      data,
      timestamp: Date.now()
    }

    let sent = 0
    for (const connId of roomConns) {
      if (excludeSet.has(connId)) continue

      if (this.sendTo(connId, message)) {
        sent++
      }
    }

    return sent
  }

  /**
   * Broadcast de mudança de estado
   */
  broadcastState(roomId: string, state: Partial<TState>, exclude?: string): number {
    return this.broadcast(roomId, '$state:update', { state }, { exclude })
  }

  /**
   * Envia evento do sistema para todos na sala
   */
  broadcastSystem(roomId: string, event: string, data: any): number {
    const roomConns = this.roomConnections.get(roomId)
    if (!roomConns || roomConns.size === 0) return 0

    const message: BroadcastMessage = {
      type: 'room:system',
      roomId,
      event,
      data,
      timestamp: Date.now()
    }

    let sent = 0
    for (const connId of roomConns) {
      if (this.sendTo(connId, message)) {
        sent++
      }
    }

    return sent
  }

  /**
   * Envia para uma conexão específica
   */
  sendTo(connectionId: string, message: BroadcastMessage): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection) return false

    try {
      // Verificar se WebSocket está aberto (readyState 1 = OPEN)
      if (connection.ws.readyState !== undefined && connection.ws.readyState !== 1) {
        return false
      }

      connection.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error(`[RoomBroadcaster] Error sending to ${connectionId}:`, error)
      return false
    }
  }

  /**
   * Envia para um usuário específico (todas as conexões do usuário)
   */
  sendToUser(userId: string, roomId: string, event: string, data: any): number {
    let sent = 0

    for (const [connId, conn] of this.connections) {
      if (conn.userId === userId && conn.rooms.has(roomId)) {
        if (this.sendTo(connId, {
          type: 'room:event',
          roomId,
          event,
          data,
          timestamp: Date.now()
        })) {
          sent++
        }
      }
    }

    return sent
  }

  // ============================================
  // Helpers para uso com Room
  // ============================================

  /**
   * Cria um wrapper que faz broadcast automático ao emitir eventos
   */
  createBroadcastingRoom(
    roomId: string,
    initialState: TState,
    connectionId?: string
  ): Room<TState, TEvents> & { broadcastEmit: (event: keyof TEvents, data: any) => void } {
    const room = this.roomSystem.getOrCreate(roomId, initialState)

    // Adicionar método de broadcast
    const enhanced = room as Room<TState, TEvents> & {
      broadcastEmit: (event: keyof TEvents, data: any) => void
    }

    enhanced.broadcastEmit = (event: keyof TEvents, data: any) => {
      // Emitir localmente
      room.emit(event, data)
      // Broadcast via WebSocket
      this.broadcast(roomId, event as string, data, { exclude: connectionId })
    }

    // Auto-broadcast mudanças de estado
    room.on('$state:change', ({ path, newValue }) => {
      this.broadcast(roomId, '$state:change', { path, newValue }, { exclude: connectionId })
    })

    return enhanced
  }

  // ============================================
  // Estatísticas
  // ============================================

  getStats(): {
    totalConnections: number
    totalRoomMemberships: number
    rooms: Record<string, { connections: number }>
  } {
    const rooms: Record<string, { connections: number }> = {}

    for (const [roomId, conns] of this.roomConnections) {
      rooms[roomId] = { connections: conns.size }
    }

    let totalMemberships = 0
    for (const conn of this.connections.values()) {
      totalMemberships += conn.rooms.size
    }

    return {
      totalConnections: this.connections.size,
      totalRoomMemberships: totalMemberships,
      rooms
    }
  }

  // ============================================
  // Cleanup
  // ============================================

  destroy(): void {
    for (const unsub of this.systemListeners) {
      unsub()
    }
    this.systemListeners = []
    this.connections.clear()
    this.roomConnections.clear()
  }

  private generateId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}

// Factory
export function createRoomBroadcaster<
  TDef extends { state: any; events: Record<string, any> }
>(
  roomSystem: RoomSystem<TDef['state'], TDef['events']>
): RoomBroadcaster<TDef['state'], TDef['events']> {
  return new RoomBroadcaster(roomSystem)
}

export type { BroadcastMessage, RoomConnection }
