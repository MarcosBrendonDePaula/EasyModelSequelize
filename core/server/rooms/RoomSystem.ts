// 🔥 FluxStack Room System - Pub/Sub tipado para comunicação entre componentes

type EventHandler<T = any> = (data: T) => void
type Unsubscribe = () => void

// Eventos do sistema (prefixo $)
export type SystemEvents<TState> = {
  '$room:created': { roomId: string; createdAt: number; initialState: TState }
  '$room:destroyed': { roomId: string; reason: 'manual' | 'empty' | 'ttl'; finalState: TState }
  '$sub:join': { subscriberId: string; event: string; count: number }
  '$sub:leave': { subscriberId: string; event: string; count: number }
  '$state:change': { path?: string; oldValue: any; newValue: any }
  '$state:reset': { oldState: TState; newState: TState }
  '$error': { error: Error; context: string }
}

// Combina eventos do usuário + sistema
type AllEvents<TState, TUserEvents> = TUserEvents & SystemEvents<TState>

// Subscription info
interface Subscription {
  id: string
  event: string
  handler: EventHandler
}

// Room instance
export class Room<TState, TEvents extends Record<string, any>> {
  public readonly id: string
  public readonly createdAt: number

  private _state: TState
  private subscriptions = new Map<string, Set<Subscription>>()
  private subscriberCounter = new Map<string, number>() // event -> count
  private nextSubId = 0
  private destroyed = false

  // Callback para notificar o sistema global
  private onSystemEvent?: (event: string, data: any) => void

  constructor(
    id: string,
    initialState: TState,
    onSystemEvent?: (event: string, data: any) => void
  ) {
    this.id = id
    this.createdAt = Date.now()
    this._state = structuredClone(initialState)
    this.onSystemEvent = onSystemEvent
  }

  // ============================================
  // Estado
  // ============================================

  get state(): Readonly<TState> {
    return this._state
  }

  setState(partial: Partial<TState>): void {
    this.checkDestroyed()
    const oldState = this._state
    this._state = { ...this._state, ...partial }

    // Emitir evento de mudança para cada campo alterado
    for (const key of Object.keys(partial) as (keyof TState)[]) {
      if (oldState[key] !== partial[key]) {
        this.emitSystem('$state:change', {
          path: key as string,
          oldValue: oldState[key],
          newValue: partial[key]
        })
      }
    }
  }

  updateState(updater: (prev: TState) => Partial<TState>): void {
    this.checkDestroyed()
    const updates = updater(this._state)
    this.setState(updates)
  }

  resetState(newState: TState): void {
    this.checkDestroyed()
    const oldState = this._state
    this._state = structuredClone(newState)

    this.emitSystem('$state:reset', { oldState, newState })
  }

  // ============================================
  // Eventos do usuário
  // ============================================

  on<K extends keyof AllEvents<TState, TEvents>>(
    event: K,
    handler: EventHandler<AllEvents<TState, TEvents>[K]>
  ): Unsubscribe {
    this.checkDestroyed()

    const eventKey = event as string

    if (!this.subscriptions.has(eventKey)) {
      this.subscriptions.set(eventKey, new Set())
      this.subscriberCounter.set(eventKey, 0)
    }

    const subId = `sub-${++this.nextSubId}`
    const subscription: Subscription = {
      id: subId,
      event: eventKey,
      handler
    }

    this.subscriptions.get(eventKey)!.add(subscription)
    const count = (this.subscriberCounter.get(eventKey) || 0) + 1
    this.subscriberCounter.set(eventKey, count)

    // Emitir evento de sistema (só para eventos não-sistema)
    if (!eventKey.startsWith('$')) {
      this.emitSystem('$sub:join', {
        subscriberId: subId,
        event: eventKey,
        count
      })
    }

    return () => {
      const subs = this.subscriptions.get(eventKey)
      if (subs) {
        subs.delete(subscription)
        const newCount = Math.max(0, (this.subscriberCounter.get(eventKey) || 1) - 1)
        this.subscriberCounter.set(eventKey, newCount)

        if (!eventKey.startsWith('$')) {
          this.emitSystem('$sub:leave', {
            subscriberId: subId,
            event: eventKey,
            count: newCount
          })
        }

        if (subs.size === 0) {
          this.subscriptions.delete(eventKey)
        }
      }
    }
  }

  emit<K extends keyof TEvents>(
    event: K,
    data: TEvents[K]
  ): number {
    this.checkDestroyed()
    return this.emitInternal(event as string, data)
  }

  // Emitir para evento do sistema
  private emitSystem<K extends keyof SystemEvents<TState>>(
    event: K,
    data: SystemEvents<TState>[K]
  ): void {
    // Emitir localmente
    this.emitInternal(event as string, data)

    // Notificar sistema global
    this.onSystemEvent?.(event as string, { roomId: this.id, ...data })
  }

  private emitInternal(event: string, data: any): number {
    const subs = this.subscriptions.get(event)
    if (!subs || subs.size === 0) return 0

    let notified = 0
    for (const sub of subs) {
      try {
        sub.handler(data)
        notified++
      } catch (error) {
        console.error(`[Room:${this.id}] Error in handler for '${event}':`, error)
        this.emitSystem('$error', {
          error: error as Error,
          context: `Handler for event '${event}'`
        })
      }
    }

    return notified
  }

  // ============================================
  // Utilitários
  // ============================================

  getSubscriberCount(event?: string): number {
    if (event) {
      return this.subscriberCounter.get(event) || 0
    }
    let total = 0
    for (const count of this.subscriberCounter.values()) {
      total += count
    }
    return total
  }

  getEvents(): string[] {
    return Array.from(this.subscriptions.keys()).filter(e => !e.startsWith('$'))
  }

  destroy(reason: 'manual' | 'empty' | 'ttl' = 'manual'): void {
    if (this.destroyed) return

    this.emitSystem('$room:destroyed', {
      roomId: this.id,
      reason,
      finalState: this._state
    })

    this.destroyed = true
    this.subscriptions.clear()
    this.subscriberCounter.clear()
  }

  isDestroyed(): boolean {
    return this.destroyed
  }

  private checkDestroyed(): void {
    if (this.destroyed) {
      throw new Error(`Room '${this.id}' has been destroyed`)
    }
  }
}

// ============================================
// Room System (gerenciador global)
// ============================================

export interface RoomSystemOptions {
  autoDestroy?: boolean        // Destruir sala quando vazia
  destroyDelay?: number        // Delay antes de destruir (ms)
  defaultTTL?: number          // TTL padrão para salas
}

export class RoomSystem<TState, TEvents extends Record<string, any>> {
  public readonly name: string
  private rooms = new Map<string, Room<TState, TEvents>>()
  private globalSubscriptions = new Map<string, Set<EventHandler>>()
  private destroyTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private options: Required<RoomSystemOptions>

  constructor(name: string, options: RoomSystemOptions = {}) {
    this.name = name
    this.options = {
      autoDestroy: options.autoDestroy ?? false,
      destroyDelay: options.destroyDelay ?? 5 * 60 * 1000, // 5 min
      defaultTTL: options.defaultTTL ?? 0 // 0 = sem TTL
    }
  }

  // ============================================
  // Gerenciamento de salas
  // ============================================

  room(roomId: string, initialState: TState): Room<TState, TEvents> {
    // Cancelar timer de destruição se existir
    const timer = this.destroyTimers.get(roomId)
    if (timer) {
      clearTimeout(timer)
      this.destroyTimers.delete(roomId)
    }

    // Retornar sala existente
    const existing = this.rooms.get(roomId)
    if (existing && !existing.isDestroyed()) {
      return existing
    }

    // Criar nova sala
    const room = new Room<TState, TEvents>(
      roomId,
      initialState,
      (event, data) => this.handleSystemEvent(event, data)
    )

    this.rooms.set(roomId, room)

    // Emitir evento global
    this.emitGlobal('$room:created', {
      roomId,
      createdAt: room.createdAt,
      initialState
    })

    // Configurar auto-destroy
    if (this.options.autoDestroy) {
      room.on('$sub:leave', ({ count }) => {
        if (count === 0 && room.getSubscriberCount() === 0) {
          this.scheduleDestroy(roomId)
        }
      })
    }

    // Configurar TTL
    if (this.options.defaultTTL > 0) {
      setTimeout(() => {
        if (!room.isDestroyed()) {
          this.destroyRoom(roomId, 'ttl')
        }
      }, this.options.defaultTTL)
    }

    return room
  }

  get(roomId: string): Room<TState, TEvents> | undefined {
    const room = this.rooms.get(roomId)
    return room && !room.isDestroyed() ? room : undefined
  }

  has(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    return room !== undefined && !room.isDestroyed()
  }

  getOrCreate(roomId: string, initialState: TState): Room<TState, TEvents> {
    return this.get(roomId) ?? this.room(roomId, initialState)
  }

  destroyRoom(roomId: string, reason: 'manual' | 'empty' | 'ttl' = 'manual'): boolean {
    const room = this.rooms.get(roomId)
    if (!room) return false

    room.destroy(reason)
    this.rooms.delete(roomId)

    // Cancelar timer se existir
    const timer = this.destroyTimers.get(roomId)
    if (timer) {
      clearTimeout(timer)
      this.destroyTimers.delete(roomId)
    }

    return true
  }

  private scheduleDestroy(roomId: string): void {
    // Cancelar timer anterior
    const existing = this.destroyTimers.get(roomId)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = setTimeout(() => {
      const room = this.rooms.get(roomId)
      if (room && room.getSubscriberCount() === 0) {
        this.destroyRoom(roomId, 'empty')
      }
      this.destroyTimers.delete(roomId)
    }, this.options.destroyDelay)

    this.destroyTimers.set(roomId, timer)
  }

  // ============================================
  // Eventos globais
  // ============================================

  on<K extends keyof SystemEvents<TState>>(
    event: K,
    handler: EventHandler<SystemEvents<TState>[K] & { roomId: string }>
  ): Unsubscribe {
    const eventKey = event as string

    if (!this.globalSubscriptions.has(eventKey)) {
      this.globalSubscriptions.set(eventKey, new Set())
    }

    this.globalSubscriptions.get(eventKey)!.add(handler)

    return () => {
      this.globalSubscriptions.get(eventKey)?.delete(handler)
    }
  }

  private handleSystemEvent(event: string, data: any): void {
    this.emitGlobal(event, data)
  }

  private emitGlobal(event: string, data: any): void {
    const handlers = this.globalSubscriptions.get(event)
    if (!handlers) return

    for (const handler of handlers) {
      try {
        handler(data)
      } catch (error) {
        console.error(`[RoomSystem:${this.name}] Error in global handler for '${event}':`, error)
      }
    }
  }

  // ============================================
  // Utilitários
  // ============================================

  getRooms(): string[] {
    return Array.from(this.rooms.keys()).filter(id => !this.rooms.get(id)?.isDestroyed())
  }

  getRoomCount(): number {
    return this.getRooms().length
  }

  getStats(): {
    name: string
    roomCount: number
    rooms: Record<string, { subscriberCount: number; events: string[]; createdAt: number }>
  } {
    const rooms: Record<string, { subscriberCount: number; events: string[]; createdAt: number }> = {}

    for (const [id, room] of this.rooms) {
      if (!room.isDestroyed()) {
        rooms[id] = {
          subscriberCount: room.getSubscriberCount(),
          events: room.getEvents(),
          createdAt: room.createdAt
        }
      }
    }

    return {
      name: this.name,
      roomCount: Object.keys(rooms).length,
      rooms
    }
  }

  destroyAll(): void {
    for (const roomId of this.rooms.keys()) {
      this.destroyRoom(roomId, 'manual')
    }
  }
}

// ============================================
// Factory function
// ============================================

export function createRoomSystem<
  TDef extends { state: any; events: Record<string, any> }
>(
  name: string,
  options?: RoomSystemOptions
): RoomSystem<TDef['state'], TDef['events']> {
  return new RoomSystem<TDef['state'], TDef['events']>(name, options)
}

// ============================================
// Exports
// ============================================

export type { EventHandler, Unsubscribe, Subscription }
