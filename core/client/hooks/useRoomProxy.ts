// 🔥 FluxStack Room Proxy - Sistema de salas integrado ao LiveComponent
//
// Uso no frontend:
//   const chat = Live.use(LiveChat, { room: 'sala-principal' })
//
//   // Sala padrão (definida no options.room)
//   chat.$room.emit('typing', { user: 'João' })
//   chat.$room.on('message:new', handler)
//   chat.$room.state
//
//   // Outras salas
//   chat.$room('sala-vip').join()
//   chat.$room('sala-vip').emit('evento', data)
//   chat.$room('sala-vip').on('evento', handler)
//   chat.$room('sala-vip').leave()
//
//   // Listar salas
//   chat.$rooms  // ['sala-principal', 'sala-vip']

type EventHandler<T = any> = (data: T) => void
type Unsubscribe = () => void

// Mensagem do cliente para o servidor
export interface RoomClientMessage {
  type: 'ROOM_JOIN' | 'ROOM_LEAVE' | 'ROOM_EMIT' | 'ROOM_STATE_GET' | 'ROOM_STATE_SET'
  componentId: string
  roomId: string
  event?: string
  data?: any
  timestamp: number
}

// Mensagem do servidor para o cliente
export interface RoomServerMessage {
  type: 'ROOM_EVENT' | 'ROOM_STATE' | 'ROOM_SYSTEM' | 'ROOM_JOINED' | 'ROOM_LEFT'
  componentId: string
  roomId: string
  event: string
  data: any
  timestamp: number
}

// Interface de uma sala individual
export interface RoomHandle<TState = any, TEvents extends Record<string, any> = Record<string, any>> {
  /** ID da sala */
  readonly id: string

  /** Se está participando desta sala */
  readonly joined: boolean

  /** Estado compartilhado da sala */
  readonly state: TState

  /** Entrar na sala */
  join: (initialState?: TState) => Promise<void>

  /** Sair da sala */
  leave: () => Promise<void>

  /** Emitir evento para a sala */
  emit: <K extends keyof TEvents>(event: K, data: TEvents[K]) => void

  /** Escutar evento da sala */
  on: <K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>) => Unsubscribe

  /** Escutar evento do sistema ($state:change, $sub:join, etc) */
  onSystem: (event: string, handler: EventHandler) => Unsubscribe

  /** Atualizar estado da sala */
  setState: (updates: Partial<TState>) => void
}

// Interface do proxy $room
export interface RoomProxy<TState = any, TEvents extends Record<string, any> = Record<string, any>> {
  // Quando chamado como função: $room('sala-id')
  (roomId: string): RoomHandle<TState, TEvents>

  // Quando acessado como objeto: $room.emit() (usa sala padrão)
  readonly id: string | null
  readonly joined: boolean
  readonly state: TState
  join: (initialState?: TState) => Promise<void>
  leave: () => Promise<void>
  emit: <K extends keyof TEvents>(event: K, data: TEvents[K]) => void
  on: <K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>) => Unsubscribe
  onSystem: (event: string, handler: EventHandler) => Unsubscribe
  setState: (updates: Partial<TState>) => void
}

// Opções para criar o RoomManager
export interface RoomManagerOptions {
  componentId: string | null
  defaultRoom?: string
  sendMessage: (msg: any) => void
  sendMessageAndWait: (msg: any, timeout?: number) => Promise<any>
  onMessage: (handler: (msg: RoomServerMessage) => void) => Unsubscribe
}

// Classe interna para gerenciar salas
export class RoomManager<TState = any, TEvents extends Record<string, any> = Record<string, any>> {
  private componentId: string | null
  private defaultRoom: string | null
  private rooms = new Map<string, {
    joined: boolean
    state: TState
    handlers: Map<string, Set<EventHandler>>
  }>()
  private handles = new Map<string, RoomHandle<TState, TEvents>>() // Cache de handles
  private sendMessage: (msg: any) => void
  private sendMessageAndWait: (msg: any, timeout?: number) => Promise<any>
  private globalUnsubscribe: Unsubscribe | null = null

  constructor(options: RoomManagerOptions) {
    this.componentId = options.componentId
    this.defaultRoom = options.defaultRoom || null
    this.sendMessage = options.sendMessage
    this.sendMessageAndWait = options.sendMessageAndWait

    // Escutar mensagens do servidor
    this.globalUnsubscribe = options.onMessage((msg) => this.handleServerMessage(msg))
  }

  private handleServerMessage(msg: RoomServerMessage): void {
    if (msg.componentId !== this.componentId) return

    const room = this.rooms.get(msg.roomId)
    if (!room) return

    switch (msg.type) {
      case 'ROOM_EVENT':
      case 'ROOM_SYSTEM':
        // Chamar handlers registrados
        const handlers = room.handlers.get(msg.event)
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(msg.data)
            } catch (error) {
              console.error(`[Room:${msg.roomId}] Handler error for '${msg.event}':`, error)
            }
          }
        }
        break

      case 'ROOM_STATE':
        // Atualizar estado local
        room.state = { ...room.state, ...msg.data }
        // Emitir evento de mudança
        const stateHandlers = room.handlers.get('$state:change')
        if (stateHandlers) {
          for (const handler of stateHandlers) {
            handler(msg.data)
          }
        }
        break

      case 'ROOM_JOINED':
        room.joined = true
        if (msg.data?.state) {
          room.state = msg.data.state
        }
        break

      case 'ROOM_LEFT':
        room.joined = false
        break
    }
  }

  private getOrCreateRoom(roomId: string): typeof this.rooms extends Map<string, infer V> ? V : never {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        joined: false,
        state: {} as TState,
        handlers: new Map()
      })
    }
    return this.rooms.get(roomId)!
  }

  // Criar handle para uma sala específica (com cache)
  createHandle(roomId: string): RoomHandle<TState, TEvents> {
    // Retornar handle cacheado se existir
    if (this.handles.has(roomId)) {
      return this.handles.get(roomId)!
    }

    const room = this.getOrCreateRoom(roomId)

    const handle: RoomHandle<TState, TEvents> = {
      get id() { return roomId },
      get joined() { return room.joined },
      get state() { return room.state },

      join: async (initialState?: TState) => {
        if (!this.componentId) throw new Error('Component not mounted')
        if (room.joined) return

        if (initialState) {
          room.state = initialState
        }

        const response = await this.sendMessageAndWait({
          type: 'ROOM_JOIN',
          componentId: this.componentId,
          roomId,
          data: { initialState: room.state },
          timestamp: Date.now()
        }, 5000)

        if (response?.success) {
          room.joined = true
          if (response.state) {
            room.state = response.state
          }
        }
      },

      leave: async () => {
        if (!this.componentId || !room.joined) return

        await this.sendMessageAndWait({
          type: 'ROOM_LEAVE',
          componentId: this.componentId,
          roomId,
          timestamp: Date.now()
        }, 5000)

        room.joined = false
        room.handlers.clear()
      },

      emit: <K extends keyof TEvents>(event: K, data: TEvents[K]) => {
        if (!this.componentId) return

        this.sendMessage({
          type: 'ROOM_EMIT',
          componentId: this.componentId,
          roomId,
          event: event as string,
          data,
          timestamp: Date.now()
        })
      },

      on: <K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe => {
        const eventKey = event as string

        if (!room.handlers.has(eventKey)) {
          room.handlers.set(eventKey, new Set())
        }
        room.handlers.get(eventKey)!.add(handler)

        return () => {
          room.handlers.get(eventKey)?.delete(handler)
        }
      },

      onSystem: (event: string, handler: EventHandler): Unsubscribe => {
        const eventKey = `$${event}`

        if (!room.handlers.has(eventKey)) {
          room.handlers.set(eventKey, new Set())
        }
        room.handlers.get(eventKey)!.add(handler)

        return () => {
          room.handlers.get(eventKey)?.delete(handler)
        }
      },

      setState: (updates: Partial<TState>) => {
        if (!this.componentId) return

        // Atualiza localmente (otimista)
        room.state = { ...room.state, ...updates }

        // Envia para o servidor
        this.sendMessage({
          type: 'ROOM_STATE_SET',
          componentId: this.componentId,
          roomId,
          data: updates,
          timestamp: Date.now()
        })
      }
    }

    // Cachear handle
    this.handles.set(roomId, handle)

    return handle
  }

  // Criar o proxy $room
  createProxy(): RoomProxy<TState, TEvents> {
    const self = this

    // Função que também tem propriedades
    const proxyFn = function(roomId: string): RoomHandle<TState, TEvents> {
      return self.createHandle(roomId)
    } as RoomProxy<TState, TEvents>

    // Se tem sala padrão, expor métodos diretamente
    const defaultHandle = this.defaultRoom ? this.createHandle(this.defaultRoom) : null

    Object.defineProperties(proxyFn, {
      id: {
        get: () => this.defaultRoom
      },
      joined: {
        get: () => defaultHandle?.joined ?? false
      },
      state: {
        get: () => defaultHandle?.state ?? ({} as TState)
      },
      join: {
        value: async (initialState?: TState) => {
          if (!defaultHandle) throw new Error('No default room set')
          return defaultHandle.join(initialState)
        }
      },
      leave: {
        value: async () => {
          if (!defaultHandle) throw new Error('No default room set')
          return defaultHandle.leave()
        }
      },
      emit: {
        value: <K extends keyof TEvents>(event: K, data: TEvents[K]) => {
          if (!defaultHandle) throw new Error('No default room set')
          return defaultHandle.emit(event, data)
        }
      },
      on: {
        value: <K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe => {
          if (!defaultHandle) throw new Error('No default room set')
          return defaultHandle.on(event, handler)
        }
      },
      onSystem: {
        value: (event: string, handler: EventHandler): Unsubscribe => {
          if (!defaultHandle) throw new Error('No default room set')
          return defaultHandle.onSystem(event, handler)
        }
      },
      setState: {
        value: (updates: Partial<TState>) => {
          if (!defaultHandle) throw new Error('No default room set')
          return defaultHandle.setState(updates)
        }
      }
    })

    return proxyFn
  }

  // Lista de salas que está participando
  getJoinedRooms(): string[] {
    const joined: string[] = []
    for (const [id, room] of this.rooms) {
      if (room.joined) joined.push(id)
    }
    return joined
  }

  // Atualizar componentId (quando monta)
  setComponentId(id: string | null): void {
    this.componentId = id
  }

  // Cleanup
  destroy(): void {
    this.globalUnsubscribe?.()
    for (const [, room] of this.rooms) {
      room.handlers.clear()
    }
    this.rooms.clear()
  }
}

export type { EventHandler, Unsubscribe }
