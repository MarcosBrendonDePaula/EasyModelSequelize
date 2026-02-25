// 🔥 FluxStack Live Components - Shared Types

import { roomEvents } from '@core/server/live/RoomEventBus'
import { liveRoomManager } from '@core/server/live/LiveRoomManager'
import { ANONYMOUS_CONTEXT } from '@core/server/live/auth/LiveAuthContext'
import { liveLog, liveWarn } from '@core/server/live/LiveLogger'

// ===== Debug Instrumentation (injectable to avoid client-side import) =====
// The real debugger is injected by ComponentRegistry at server startup.
// This avoids importing server-only LiveDebugger.ts from this shared types file.
interface LiveDebuggerInterface {
  trackStateChange(componentId: string, delta: Record<string, unknown>, fullState: Record<string, unknown>, source?: string): void
  trackActionCall(componentId: string, action: string, payload: unknown): void
  trackActionResult(componentId: string, action: string, result: unknown, duration: number): void
  trackActionError(componentId: string, action: string, error: string, duration: number): void
  trackRoomEmit(componentId: string, roomId: string, event: string, data: unknown): void
}

let _liveDebugger: LiveDebuggerInterface | null = null

/** @internal Called by ComponentRegistry to inject the debugger instance */
export function _setLiveDebugger(dbg: LiveDebuggerInterface): void {
  _liveDebugger = dbg
}
import type { LiveAuthContext, LiveComponentAuth, LiveActionAuthMap } from '@core/server/live/auth/types'
import type { ServerWebSocket } from 'bun'

// ============================================
// 🔌 WebSocket Types for Server-Side
// ============================================

/**
 * WebSocket data stored on each connection
 * This is attached to ws.data by the WebSocket plugin
 */
export interface FluxStackWSData {
  connectionId: string
  components: Map<string, LiveComponent>
  subscriptions: Set<string>
  connectedAt: Date
  userId?: string
  /** Contexto de autenticação da conexão WebSocket */
  authContext?: LiveAuthContext
}

/**
 * Type-safe WebSocket interface for FluxStack Live Components
 * Compatible with both Elysia's ElysiaWS and Bun's ServerWebSocket
 */
export interface FluxStackWebSocket {
  /** Send data to the client */
  send(data: string | BufferSource, compress?: boolean): number
  /** Close the connection */
  close(code?: number, reason?: string): void
  /** Connection data storage */
  data: FluxStackWSData
  /** Remote address of the client */
  readonly remoteAddress: string
  /** Current ready state */
  readonly readyState: 0 | 1 | 2 | 3
}

/**
 * Raw ServerWebSocket from Bun with FluxStack data
 * Use this when you need access to all Bun WebSocket methods
 */
export type FluxStackServerWebSocket = ServerWebSocket<FluxStackWSData>

export interface LiveMessage {
  type: 'COMPONENT_MOUNT' | 'COMPONENT_UNMOUNT' |
  'COMPONENT_REHYDRATE' | 'COMPONENT_ACTION' | 'CALL_ACTION' |
  'ACTION_RESPONSE' | 'PROPERTY_UPDATE' | 'STATE_UPDATE' | 'STATE_DELTA' | 'STATE_REHYDRATED' |
  'ERROR' | 'BROADCAST' | 'FILE_UPLOAD_START' | 'FILE_UPLOAD_CHUNK' | 'FILE_UPLOAD_COMPLETE' |
  'COMPONENT_PING' | 'COMPONENT_PONG' |
  // Auth system message
  'AUTH' |
  // Room system messages
  'ROOM_JOIN' | 'ROOM_LEAVE' | 'ROOM_EMIT' | 'ROOM_STATE_SET' | 'ROOM_STATE_GET'
  componentId: string
  action?: string
  property?: string
  payload?: any
  timestamp?: number
  userId?: string
  room?: string
  // Request-Response system
  requestId?: string
  responseId?: string
  expectResponse?: boolean
}

export interface ComponentState {
  [key: string]: any
}

export interface LiveComponentInstance<TState = ComponentState, TActions = Record<string, Function>> {
  id: string
  state: TState
  call: <T extends keyof TActions>(action: T, ...args: any[]) => Promise<any>
  set: <K extends keyof TState>(property: K, value: TState[K]) => void
  loading: boolean
  errors: Record<string, string>
  connected: boolean
  room?: string
}

/**
 * @deprecated Use FluxStackWSData instead
 */
export interface WebSocketData {
  components: Map<string, any>
  userId?: string
  subscriptions: Set<string>
}

export interface ComponentDefinition<TState = ComponentState> {
  name: string
  initialState: TState
  component: new (initialState: TState, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) => LiveComponent<TState>
}

export interface BroadcastMessage {
  type: string
  payload: any
  room?: string
  excludeUser?: string
}

// WebSocket Types for Client
export interface WebSocketMessage {
  type: string
  componentId?: string
  action?: string
  payload?: any
  timestamp?: number
  userId?: string
  room?: string
  // Request-Response system
  requestId?: string
  responseId?: string
  expectResponse?: boolean
}

export interface WebSocketResponse {
  type: 'MESSAGE_RESPONSE' | 'CONNECTION_ESTABLISHED' | 'ERROR' | 'BROADCAST' | 'ACTION_RESPONSE' | 'COMPONENT_MOUNTED' | 'COMPONENT_REHYDRATED' | 'STATE_UPDATE' | 'STATE_DELTA' | 'STATE_REHYDRATED' | 'FILE_UPLOAD_PROGRESS' | 'FILE_UPLOAD_COMPLETE' | 'FILE_UPLOAD_ERROR' | 'FILE_UPLOAD_START_RESPONSE' | 'COMPONENT_PONG' |
  // Auth system response
  'AUTH_RESPONSE' |
  // Room system responses
  'ROOM_EVENT' | 'ROOM_STATE' | 'ROOM_SYSTEM' | 'ROOM_JOINED' | 'ROOM_LEFT'
  originalType?: string
  componentId?: string
  success?: boolean
  result?: any
  // Request-Response system
  requestId?: string
  responseId?: string
  error?: string
  timestamp?: number
  connectionId?: string
  payload?: any
  // File upload specific fields
  uploadId?: string
  chunkIndex?: number
  totalChunks?: number
  bytesUploaded?: number
  totalBytes?: number
  progress?: number
  filename?: string
  fileUrl?: string
  // Re-hydration specific fields
  signedState?: any
  oldComponentId?: string
  newComponentId?: string
}

// Hybrid Live Component Types
export interface HybridState<T> {
  data: T
  validation: StateValidation
  conflicts: StateConflict[]
  status: 'synced' | 'conflict' | 'disconnected'
}

export interface StateValidation {
  checksum: string
  version: number
  source: 'client' | 'server' | 'mount'
  timestamp: number
}

export interface StateConflict {
  property: string
  clientValue: any
  serverValue: any
  timestamp: number
  resolved: boolean
}

export interface HybridComponentOptions {
  fallbackToLocal?: boolean
  room?: string
  userId?: string
  autoMount?: boolean
  debug?: boolean

  // Component lifecycle callbacks
  onConnect?: () => void      // Called when WebSocket connects (can happen multiple times on reconnect)
  onMount?: () => void        // Called after fresh mount (no prior state)
  onRehydrate?: () => void    // Called after successful rehydration (restoring prior state)
  onDisconnect?: () => void   // Called when WebSocket disconnects
  onError?: (error: string) => void
  onStateChange?: (newState: any, oldState: any) => void
}

// Interface para handle de sala no servidor
export interface ServerRoomHandle<TState = any, TEvents extends Record<string, any> = Record<string, any>> {
  readonly id: string
  readonly state: TState
  join: (initialState?: TState) => void
  leave: () => void
  emit: <K extends keyof TEvents>(event: K, data: TEvents[K]) => number
  on: <K extends keyof TEvents>(event: K, handler: (data: TEvents[K]) => void) => () => void
  setState: (updates: Partial<TState>) => void
}

// Proxy para $room no servidor
export interface ServerRoomProxy<TState = any, TEvents extends Record<string, any> = Record<string, any>> {
  (roomId: string): ServerRoomHandle<TState, TEvents>
  readonly id: string | undefined
  readonly state: TState
  join: (initialState?: TState) => void
  leave: () => void
  emit: <K extends keyof TEvents>(event: K, data: TEvents[K]) => number
  on: <K extends keyof TEvents>(event: K, handler: (data: TEvents[K]) => void) => () => void
  setState: (updates: Partial<TState>) => void
}

export abstract class LiveComponent<TState = ComponentState, TPrivate extends Record<string, any> = Record<string, any>> {
  /** Component name for registry lookup - must be defined in subclasses */
  static componentName: string
  /** Default state - must be defined in subclasses */
  static defaultState: any

  /**
   * Per-component logging control. Silent by default.
   *
   * @example
   * // Enable all log categories
   * static logging = true
   *
   * // Enable specific categories only
   * static logging = ['lifecycle', 'messages'] as const
   *
   * // Disabled (default — omit or set false)
   * static logging = false
   *
   * Categories: 'lifecycle' | 'messages' | 'state' | 'performance' | 'rooms' | 'websocket'
   */
  static logging?: boolean | readonly ('lifecycle' | 'messages' | 'state' | 'performance' | 'rooms' | 'websocket')[]

  /**
   * Configuração de autenticação do componente.
   * Define se auth é obrigatória e quais roles/permissions são necessárias.
   *
   * @example
   * static auth: LiveComponentAuth = {
   *   required: true,
   *   roles: ['admin', 'moderator'],
   *   permissions: ['chat.read'],
   * }
   */
  static auth?: LiveComponentAuth

  /**
   * Configuração de autenticação por action.
   * Permite controle granular de permissões por método.
   *
   * @example
   * static actionAuth: LiveActionAuthMap = {
   *   deleteMessage: { permissions: ['chat.admin'] },
   *   sendMessage: { permissions: ['chat.write'] },
   * }
   */
  static actionAuth?: LiveActionAuthMap

  public readonly id: string
  private _state: TState
  public state: TState // Proxy wrapper
  protected ws: FluxStackWebSocket
  public room?: string
  public userId?: string
  public broadcastToRoom: (message: BroadcastMessage) => void = () => {} // Will be injected by registry

  // 🔒 Server-only private state (NEVER sent to client)
  private _privateState: TPrivate = {} as TPrivate

  // Auth context (injected by registry during mount)
  private _authContext: LiveAuthContext = ANONYMOUS_CONTEXT

  // Room event subscriptions (cleaned up on destroy)
  private roomEventUnsubscribers: (() => void)[] = []
  private joinedRooms: Set<string> = new Set()

  // Room type for typed events (override in subclass)
  protected roomType: string = 'default'

  // Cached room handles
  private roomHandles: Map<string, ServerRoomHandle> = new Map()

  constructor(initialState: Partial<TState>, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) {
    this.id = this.generateId()
    // Merge defaultState with initialState - subclass defaultState takes precedence for missing fields
    const ctor = this.constructor as typeof LiveComponent
    this._state = { ...ctor.defaultState, ...initialState } as TState

    // Create reactive proxy that auto-syncs on mutation
    this.state = this.createStateProxy(this._state)

    this.ws = ws
    this.room = options?.room
    this.userId = options?.userId

    // Auto-join default room if specified
    if (this.room) {
      this.joinedRooms.add(this.room)
      liveRoomManager.joinRoom(this.id, this.room, this.ws)
    }

    // 🔥 Create direct property accessors (this.count instead of this.state.count)
    this.createDirectStateAccessors()
  }

  // Create getters/setters for each state property directly on `this`
  private createDirectStateAccessors() {
    // Properties that should NOT become state accessors
    const forbidden = new Set([
      // Instance properties
      ...Object.keys(this),
      // Prototype methods
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(this)),
      // Known internal properties
      'state', '_state', 'ws', 'id', 'room', 'userId', 'broadcastToRoom',
      '$private', '_privateState',
      '$room', '$rooms', 'roomType', 'roomHandles', 'joinedRooms', 'roomEventUnsubscribers'
    ])

    // Create accessor for each state key
    for (const key of Object.keys(this._state as object)) {
      if (!forbidden.has(key)) {
        Object.defineProperty(this, key, {
          get: () => (this._state as any)[key],
          set: (value) => { (this.state as any)[key] = value }, // Uses proxy for auto-sync
          enumerable: true,
          configurable: true
        })
      }
    }
  }

  // Create a Proxy that auto-emits STATE_DELTA on any mutation
  private createStateProxy(state: TState): TState {
    const self = this
    return new Proxy(state as object, {
      set(target, prop, value) {
        const oldValue = (target as any)[prop]
        if (oldValue !== value) {
          (target as any)[prop] = value
          // Delta sync - send only the changed property
          self.emit('STATE_DELTA', { delta: { [prop]: value } })
          // Debug: track proxy mutation
          _liveDebugger?.trackStateChange(
            self.id,
            { [prop]: value } as Record<string, unknown>,
            target as Record<string, unknown>,
            'proxy'
          )
        }
        return true
      },
      get(target, prop) {
        return (target as any)[prop]
      }
    }) as TState
  }

  // ========================================
  // 🔒 $private - Server-Only State
  // ========================================

  /**
   * Server-only state that is NEVER synchronized with the client.
   * Use this for sensitive data like tokens, API keys, internal IDs, etc.
   *
   * Unlike `this.state`, mutations to `$private` do NOT trigger
   * STATE_DELTA or STATE_UPDATE messages.
   *
   * ⚠️ Private state is lost on rehydration (since it's never sent to client).
   * Re-populate it in your action handlers as needed.
   *
   * @example
   * async connect(payload: { token: string }) {
   *   this.$private.token = payload.token
   *   this.$private.apiKey = await getKey()
   *
   *   // Only UI-relevant data goes to state (synced with client)
   *   this.state.messages = await fetchMessages(this.$private.token)
   * }
   */
  public get $private(): TPrivate {
    return this._privateState
  }

  // ========================================
  // 🔥 $room - Sistema de Salas Unificado
  // ========================================

  /**
   * Acessa uma sala específica ou a sala padrão
   * @example
   * // Sala padrão
   * this.$room.emit('typing', { user: 'João' })
   * this.$room.on('message:new', handler)
   *
   * // Outra sala
   * this.$room('sala-vip').join()
   * this.$room('sala-vip').emit('typing', { user: 'João' })
   */
  public get $room(): ServerRoomProxy {
    const self = this

    const createHandle = (roomId: string): ServerRoomHandle => {
      // Retornar handle cacheado
      if (this.roomHandles.has(roomId)) {
        return this.roomHandles.get(roomId)!
      }

      const handle: ServerRoomHandle = {
        get id() { return roomId },
        get state() { return liveRoomManager.getRoomState(roomId) },

        join: (initialState?: any) => {
          if (self.joinedRooms.has(roomId)) return
          self.joinedRooms.add(roomId)
          liveRoomManager.joinRoom(self.id, roomId, self.ws, initialState)
        },

        leave: () => {
          if (!self.joinedRooms.has(roomId)) return
          self.joinedRooms.delete(roomId)
          liveRoomManager.leaveRoom(self.id, roomId)
        },

        emit: (event: string, data: any): number => {
          return liveRoomManager.emitToRoom(roomId, event, data, self.id)
        },

        on: (event: string, handler: (data: any) => void): (() => void) => {
          // Usar 'room' como tipo genérico e roomId como identificador
          // Isso permite que emitToRoom encontre os handlers corretamente
          const unsubscribe = roomEvents.on(
            'room', // Tipo genérico para todas as salas
            roomId,
            event,
            self.id,
            handler
          )
          self.roomEventUnsubscribers.push(unsubscribe)
          return unsubscribe
        },

        setState: (updates: any) => {
          liveRoomManager.setRoomState(roomId, updates, self.id)
        }
      }

      this.roomHandles.set(roomId, handle)
      return handle
    }

    // Criar proxy que funciona como função e objeto
    const proxyFn = ((roomId: string) => createHandle(roomId)) as ServerRoomProxy

    const defaultHandle = this.room ? createHandle(this.room) : null

    Object.defineProperties(proxyFn, {
      id: { get: () => self.room },
      state: { get: () => defaultHandle?.state ?? {} },
      join: {
        value: (initialState?: any) => {
          if (!defaultHandle) throw new Error('No default room set')
          defaultHandle.join(initialState)
        }
      },
      leave: {
        value: () => {
          if (!defaultHandle) throw new Error('No default room set')
          defaultHandle.leave()
        }
      },
      emit: {
        value: (event: string, data: any) => {
          if (!defaultHandle) throw new Error('No default room set')
          return defaultHandle.emit(event, data)
        }
      },
      on: {
        value: (event: string, handler: (data: any) => void) => {
          if (!defaultHandle) throw new Error('No default room set')
          return defaultHandle.on(event, handler)
        }
      },
      setState: {
        value: (updates: any) => {
          if (!defaultHandle) throw new Error('No default room set')
          defaultHandle.setState(updates)
        }
      }
    })

    return proxyFn
  }

  /**
   * Lista de IDs das salas que este componente está participando
   */
  public get $rooms(): string[] {
    return Array.from(this.joinedRooms)
  }

  // ========================================
  // 🔒 $auth - Contexto de Autenticação
  // ========================================

  /**
   * Acessa o contexto de autenticação do usuário atual.
   * Disponível após o mount do componente.
   *
   * @example
   * async sendMessage(payload: { text: string }) {
   *   if (!this.$auth.authenticated) {
   *     throw new Error('Login required')
   *   }
   *
   *   const userId = this.$auth.user!.id
   *   const isAdmin = this.$auth.hasRole('admin')
   *   const canDelete = this.$auth.hasPermission('chat.admin')
   * }
   */
  public get $auth(): LiveAuthContext {
    return this._authContext
  }

  /**
   * Injeta o contexto de autenticação no componente.
   * Chamado internamente pelo ComponentRegistry durante o mount.
   * @internal
   */
  public setAuthContext(context: LiveAuthContext): void {
    this._authContext = context
    // Atualiza userId se disponível no auth context
    if (context.authenticated && context.user?.id && !this.userId) {
      this.userId = context.user.id
    }
  }

  // State management (batch update - single emit with delta)
  public setState(updates: Partial<TState> | ((prev: TState) => Partial<TState>)) {
    const newUpdates = typeof updates === 'function' ? updates(this._state) : updates
    Object.assign(this._state as object, newUpdates)
    // Delta sync - send only the changed properties
    this.emit('STATE_DELTA', { delta: newUpdates })
    // Debug: track state change
    _liveDebugger?.trackStateChange(
      this.id,
      newUpdates as Record<string, unknown>,
      this._state as Record<string, unknown>,
      'setState'
    )
  }

  // Generic setValue action - set any state key with type safety
  public async setValue<K extends keyof TState>(payload: { key: K; value: TState[K] }): Promise<{ success: true; key: K; value: TState[K] }> {
    const { key, value } = payload
    const update = { [key]: value } as unknown as Partial<TState>
    this.setState(update)
    return { success: true, key, value }
  }

  /**
   * 🔒 REQUIRED: List of methods that are explicitly callable from the client.
   * ONLY these methods can be called via CALL_ACTION.
   * Components without publicActions will deny ALL remote actions (secure by default).
   *
   * @example
   * static publicActions = ['sendMessage', 'deleteMessage', 'join'] as const
   */
  static publicActions?: readonly string[]

  // Internal methods that must NEVER be callable from the client
  private static readonly BLOCKED_ACTIONS: ReadonlySet<string> = new Set([
    // Lifecycle & internal
    'constructor', 'destroy', 'executeAction', 'getSerializableState',
    // State management internals
    'setState', 'emit', 'broadcast', 'broadcastToRoom',
    'createStateProxy', 'createDirectStateAccessors', 'generateId',
    // Auth internals
    'setAuthContext', '$auth',
    // Private state internals
    '$private', '_privateState',
    // Room internals
    '$room', '$rooms', 'subscribeToRoom', 'unsubscribeFromRoom',
    'emitRoomEvent', 'onRoomEvent', 'emitRoomEventWithState',
  ])

  // Execute action safely with security validation
  public async executeAction(action: string, payload: any): Promise<any> {
    const actionStart = Date.now()
    try {
      // 🔒 Security: Block internal/protected methods from being called remotely
      if ((LiveComponent.BLOCKED_ACTIONS as Set<string>).has(action)) {
        throw new Error(`Action '${action}' is not callable`)
      }

      // 🔒 Security: Block private methods (prefixed with _ or #)
      if (action.startsWith('_') || action.startsWith('#')) {
        throw new Error(`Action '${action}' is not callable`)
      }

      // 🔒 Security: publicActions whitelist is MANDATORY
      // Components without publicActions deny ALL remote actions (secure by default)
      const componentClass = this.constructor as typeof LiveComponent
      const publicActions = componentClass.publicActions
      if (!publicActions) {
        console.warn(`🔒 [SECURITY] Component '${componentClass.componentName || componentClass.name}' has no publicActions defined. All remote actions are blocked. Define static publicActions to allow specific actions.`)
        throw new Error(`Action '${action}' is not callable - component has no publicActions defined`)
      }
      if (!publicActions.includes(action)) {
        throw new Error(`Action '${action}' is not callable`)
      }

      // Check if method exists on the instance
      const method = (this as any)[action]
      if (typeof method !== 'function') {
        throw new Error(`Action '${action}' not found on component`)
      }

      // 🔒 Security: Block inherited Object.prototype methods
      if (Object.prototype.hasOwnProperty.call(Object.prototype, action)) {
        throw new Error(`Action '${action}' is not callable`)
      }

      // Debug: track action call
      _liveDebugger?.trackActionCall(this.id, action, payload)

      // Execute method
      const result = await method.call(this, payload)

      // Debug: track action result
      _liveDebugger?.trackActionResult(this.id, action, result, Date.now() - actionStart)

      return result
    } catch (error: any) {
      // Debug: track action error
      _liveDebugger?.trackActionError(this.id, action, error.message, Date.now() - actionStart)

      this.emit('ERROR', {
        action,
        error: error.message
      })
      throw error
    }
  }

  // Send message to client
  protected emit(type: string, payload: any) {
    const message: LiveMessage = {
      type: type as any,
      componentId: this.id,
      payload,
      timestamp: Date.now(),
      userId: this.userId,
      room: this.room
    }

    if (this.ws && this.ws.send) {
      this.ws.send(JSON.stringify(message))
    }
  }

  // Broadcast to all clients in room (via WebSocket)
  protected broadcast(type: string, payload: any, excludeCurrentUser = false) {
    if (!this.room) {
      liveWarn('rooms', this.id, `⚠️ [${this.id}] Cannot broadcast '${type}' - no room set`)
      return
    }

    const message: BroadcastMessage = {
      type,
      payload,
      room: this.room,
      excludeUser: excludeCurrentUser ? this.userId : undefined
    }

    liveLog('rooms', this.id, `📤 [${this.id}] Broadcasting '${type}' to room '${this.room}'`)

    // This will be handled by the registry
    this.broadcastToRoom(message)
  }

  // ========================================
  // 🔥 Room Events - Internal Server Events
  // ========================================

  /**
   * Emite um evento para todos os componentes da sala (server-side)
   * Cada componente inscrito pode reagir e atualizar seu próprio cliente
   *
   * @param event - Nome do evento
   * @param data - Dados do evento
   * @param notifySelf - Se true, este componente também recebe (default: false)
   */
  protected emitRoomEvent(event: string, data: any, notifySelf = false): number {
    if (!this.room) {
      liveWarn('rooms', this.id, `⚠️ [${this.id}] Cannot emit room event '${event}' - no room set`)
      return 0
    }

    const excludeId = notifySelf ? undefined : this.id
    const notified = roomEvents.emit(this.roomType, this.room, event, data, excludeId)

    liveLog('rooms', this.id, `📡 [${this.id}] Room event '${event}' → ${notified} components`)

    // Debug: track room emit
    _liveDebugger?.trackRoomEmit(this.id, this.room, event, data)

    return notified
  }

  /**
   * Inscreve este componente em um evento da sala
   * Handler é chamado quando outro componente emite o evento
   *
   * @param event - Nome do evento para escutar
   * @param handler - Função chamada quando evento é recebido
   */
  protected onRoomEvent<T = any>(event: string, handler: (data: T) => void): void {
    if (!this.room) {
      liveWarn('rooms', this.id, `⚠️ [${this.id}] Cannot subscribe to room event '${event}' - no room set`)
      return
    }

    const unsubscribe = roomEvents.on(
      this.roomType,
      this.room,
      event,
      this.id,
      handler
    )

    // Guardar para cleanup no destroy
    this.roomEventUnsubscribers.push(unsubscribe)

    liveLog('rooms', this.id, `👂 [${this.id}] Subscribed to room event '${event}'`)
  }

  /**
   * Helper: Emite evento E atualiza estado local + envia pro cliente
   * Útil para o componente que origina a ação
   *
   * @param event - Nome do evento
   * @param data - Dados do evento
   * @param stateUpdates - Atualizações de estado para aplicar localmente
   */
  protected emitRoomEventWithState(
    event: string,
    data: any,
    stateUpdates: Partial<TState>
  ): number {
    // 1. Atualiza estado local (envia pro cliente deste componente)
    this.setState(stateUpdates)

    // 2. Emite evento para outros componentes da sala
    return this.emitRoomEvent(event, data, false)
  }

  // Subscribe to room for multi-user features
  protected async subscribeToRoom(roomId: string) {
    this.room = roomId
    // Registry will handle the actual subscription
  }

  // Unsubscribe from room
  protected async unsubscribeFromRoom() {
    this.room = undefined
    // Registry will handle the actual unsubscription
  }

  // Generate unique ID using cryptographically secure randomness
  private generateId(): string {
    return `live-${crypto.randomUUID()}`
  }

  // Cleanup when component is destroyed
  public destroy() {
    // Limpa todas as inscrições de room events
    for (const unsubscribe of this.roomEventUnsubscribers) {
      unsubscribe()
    }
    this.roomEventUnsubscribers = []

    // Sai de todas as salas
    for (const roomId of this.joinedRooms) {
      liveRoomManager.leaveRoom(this.id, roomId)
    }
    this.joinedRooms.clear()
    this.roomHandles.clear()
    this._privateState = {} as TPrivate

    this.unsubscribeFromRoom()
    // Override in subclasses for custom cleanup
  }

  // Get serializable state for client
  public getSerializableState(): TState {
    return this.state
  }
}

// Utility types for better TypeScript experience
export type ComponentActions<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never
}

export type ComponentProps<T extends LiveComponent> = T extends LiveComponent<infer TState> ? TState : never

export type ActionParameters<T, K extends keyof T> = T[K] extends (...args: infer P) => any ? P : never

export type ActionReturnType<T, K extends keyof T> = T[K] extends (...args: any[]) => infer R ? R : never

// 🔥 Type Inference System for Live Components
// Similar to Eden Treaty - automatic type inference for actions

/**
 * Extract all public action methods from a LiveComponent class
 * Excludes constructor, destroy, lifecycle methods, and inherited methods
 */
export type ExtractActions<T extends LiveComponent<any>> = {
  [K in keyof T as K extends string
    ? T[K] extends (payload?: any) => Promise<any>
      ? K extends 'executeAction' | 'destroy' | 'getSerializableState' | 'setState'
        ? never
        : K
      : never
    : never]: T[K]
}

/**
 * Get all action names from a component
 */
export type ActionNames<T extends LiveComponent<any>> = keyof ExtractActions<T>

/**
 * Get the payload type for a specific action
 * Extracts the first parameter type from the action method
 */
export type ActionPayload<
  T extends LiveComponent<any>,
  K extends ActionNames<T>
> = ExtractActions<T>[K] extends (payload: infer P) => any
  ? P
  : ExtractActions<T>[K] extends () => any
    ? undefined
    : never

/**
 * Get the return type for a specific action (unwrapped from Promise)
 */
export type ActionReturn<
  T extends LiveComponent<any>,
  K extends ActionNames<T>
> = ExtractActions<T>[K] extends (...args: any[]) => Promise<infer R>
  ? R
  : ExtractActions<T>[K] extends (...args: any[]) => infer R
    ? R
    : never

/**
 * Get the state type from a LiveComponent class
 */
export type InferComponentState<T extends LiveComponent<any>> = T extends LiveComponent<infer S> ? S : never

/**
 * Get the private state type from a LiveComponent class
 */
export type InferPrivateState<T extends LiveComponent<any, any>> = T extends LiveComponent<any, infer P> ? P : never

/**
 * Type-safe call signature for a component
 * Provides autocomplete for action names and validates payload types
 */
export type TypedCall<T extends LiveComponent<any>> = <K extends ActionNames<T>>(
  action: K,
  ...args: ActionPayload<T, K> extends undefined
    ? []
    : [payload: ActionPayload<T, K>]
) => Promise<void>

/**
 * Type-safe callAndWait signature for a component
 * Provides autocomplete and returns the correct type
 */
export type TypedCallAndWait<T extends LiveComponent<any>> = <K extends ActionNames<T>>(
  action: K,
  ...args: ActionPayload<T, K> extends undefined
    ? [payload?: undefined, timeout?: number]
    : [payload: ActionPayload<T, K>, timeout?: number]
) => Promise<ActionReturn<T, K>>

/**
 * Type-safe setValue signature for a component
 * Convenience helper for setting individual state values
 */
export type TypedSetValue<T extends LiveComponent<any>> = <K extends keyof InferComponentState<T>>(
  key: K,
  value: InferComponentState<T>[K]
) => Promise<void>

/**
 * Return type for useTypedLiveComponent hook
 * Provides full type inference for state and actions
 */
export interface UseTypedLiveComponentReturn<T extends LiveComponent<any>> {
  // Server-driven state (read-only from frontend perspective)
  state: InferComponentState<T>

  // Status information
  loading: boolean
  error: string | null
  connected: boolean
  componentId: string | null

  // Connection status with all possible states
  status: 'synced' | 'disconnected' | 'connecting' | 'reconnecting' | 'loading' | 'mounting' | 'error'

  // Type-safe actions
  call: TypedCall<T>
  callAndWait: TypedCallAndWait<T>

  // Convenience helper for setting individual state values
  setValue: TypedSetValue<T>

  // Lifecycle
  mount: () => Promise<void>
  unmount: () => Promise<void>

  // Helper for temporary input state
  useControlledField: <K extends keyof InferComponentState<T>>(field: K, action?: string) => {
    value: InferComponentState<T>[K]
    setValue: (value: InferComponentState<T>[K]) => void
    commit: (value?: InferComponentState<T>[K]) => Promise<void>
    isDirty: boolean
  }
}

// File Upload Types for Chunked WebSocket Upload
export interface FileChunkData {
  uploadId: string
  filename: string
  fileType: string
  fileSize: number
  chunkIndex: number
  totalChunks: number
  chunkSize: number
  data: string // Base64 encoded chunk data
  hash?: string // Optional chunk hash for verification
}

export interface FileUploadStartMessage {
  type: 'FILE_UPLOAD_START'
  componentId: string
  uploadId: string
  filename: string
  fileType: string
  fileSize: number
  chunkSize?: number // Optional, defaults to 64KB
  requestId?: string
}

export interface FileUploadChunkMessage {
  type: 'FILE_UPLOAD_CHUNK'
  componentId: string
  uploadId: string
  chunkIndex: number
  totalChunks: number
  data: string | Buffer // Base64 string (JSON) or Buffer (binary protocol)
  hash?: string
  requestId?: string
}

// Binary protocol header for chunk uploads
export interface BinaryChunkHeader {
  type: 'FILE_UPLOAD_CHUNK'
  componentId: string
  uploadId: string
  chunkIndex: number
  totalChunks: number
  requestId?: string
}

export interface FileUploadCompleteMessage {
  type: 'FILE_UPLOAD_COMPLETE'
  componentId: string
  uploadId: string
  requestId?: string
}

export interface FileUploadProgressResponse {
  type: 'FILE_UPLOAD_PROGRESS'
  componentId: string
  uploadId: string
  chunkIndex: number
  totalChunks: number
  bytesUploaded: number
  totalBytes: number
  progress: number // 0-100
  requestId?: string
  timestamp: number
}

export interface FileUploadCompleteResponse {
  type: 'FILE_UPLOAD_COMPLETE'
  componentId: string
  uploadId: string
  success: boolean
  filename?: string
  fileUrl?: string
  error?: string
  requestId?: string
  timestamp: number
}

// File Upload Manager for handling uploads
export interface ActiveUpload {
  uploadId: string
  componentId: string
  filename: string
  fileType: string
  fileSize: number
  totalChunks: number
  receivedChunks: Map<number, string | Buffer> // Base64 string or raw Buffer (binary protocol)
  bytesReceived: number // Track actual bytes received for adaptive chunking
  startTime: number
  lastChunkTime: number
  tempFilePath?: string
}