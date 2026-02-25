// 🔥 FluxStack Live Components - Core Types

export interface LiveMessage {
  type: 'COMPONENT_MOUNT' | 'COMPONENT_UNMOUNT' | 'COMPONENT_ACTION' | 'CALL_ACTION' | 'ACTION_RESPONSE' | 'PROPERTY_UPDATE' | 'STATE_UPDATE' | 'ERROR' | 'BROADCAST'
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

export interface WebSocketData {
  components: Map<string, any>
  userId?: string
  subscriptions: Set<string>
}

export interface ComponentDefinition<TState = ComponentState> {
  name: string
  initialState: TState
  component: new (initialState: TState, ws: any) => LiveComponent<TState>
}

export interface BroadcastMessage {
  type: string
  payload: any
  room?: string
  excludeUser?: string
}

export abstract class LiveComponent<TState = ComponentState> {
  public readonly id: string
  public state: TState
  protected ws: any
  protected room?: string
  protected userId?: string
  public broadcastToRoom: (message: BroadcastMessage) => void = () => {} // Will be injected by registry

  constructor(initialState: TState, ws: any, options?: { room?: string; userId?: string }) {
    this.id = this.generateId()
    this.state = initialState
    this.ws = ws
    this.room = options?.room
    this.userId = options?.userId
  }

  // State management
  protected setState(updates: Partial<TState> | ((prev: TState) => Partial<TState>)) {
    const newUpdates = typeof updates === 'function' ? updates(this.state) : updates
    this.state = { ...this.state, ...newUpdates }
    this.emit('STATE_UPDATE', { state: this.state })
  }

  // Execute action safely
  public async executeAction(action: string, payload: any): Promise<any> {
    try {
      // Check if method exists
      const method = (this as any)[action]
      if (typeof method !== 'function') {
        throw new Error(`Action '${action}' not found on component`)
      }

      // Execute method
      const result = await method.call(this, payload)
      return result
    } catch (error: any) {
      this.emit('ERROR', { 
        action, 
        error: error.message,
        stack: error.stack 
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

  // Broadcast to all clients in room
  protected broadcast(type: string, payload: any, excludeCurrentUser = false) {
    const message: BroadcastMessage = {
      type,
      payload,
      room: this.room,
      excludeUser: excludeCurrentUser ? this.userId : undefined
    }

    // This will be handled by the registry
    this.broadcastToRoom(message)
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

  // Generate unique ID
  private generateId(): string {
    return `live-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Cleanup when component is destroyed
  public destroy() {
    this.unsubscribeFromRoom()
    // Override in subclasses for custom cleanup
  }

  // Get serializable state for client
  public getSerializableState(): TState {
    return this.state
  }

  // ===== Livewire-style Actions =====
  // These are automatically available for all LiveComponents
  // Used by useLivewire() hook for transparent property access

  /**
   * Set a single state property value
   * Used by useLivewire() proxy for transparent property assignment
   *
   * @example
   * // Frontend with useLivewire:
   * clock.format = '12h'  // Automatically calls setValue({ key: 'format', value: '12h' })
   */
  async setValue<K extends keyof TState>(payload: { key: K; value: TState[K] }): Promise<{ success: boolean; key: K; value: TState[K] }> {
    const { key, value } = payload

    // Validate that the key exists in state
    const stateObj = this.state as Record<string, unknown>
    if (!(String(key) in stateObj)) {
      throw new Error(`Property '${String(key)}' does not exist in component state`)
    }

    this.setState({ [key]: value } as unknown as Partial<TState>)

    return { success: true, key, value }
  }

  /**
   * Set multiple state properties at once
   * Useful for batch updates
   *
   * @example
   * await clock.$call('setValues', { format: '12h', showSeconds: false })
   */
  async setValues(payload: Partial<TState>): Promise<{ success: boolean; updated: (keyof TState)[] }> {
    const stateObj = this.state as Record<string, unknown>
    const validKeys = Object.keys(payload).filter(key => key in stateObj) as (keyof TState)[]

    if (validKeys.length === 0) {
      throw new Error('No valid properties to update')
    }

    const updates = validKeys.reduce((acc, key) => {
      acc[key] = payload[key] as TState[keyof TState]
      return acc
    }, {} as Partial<TState>)

    this.setState(updates)

    return { success: true, updated: validKeys }
  }

  /**
   * Get a single state property value
   * Useful for getting computed/derived values from server
   */
  async getValue<K extends keyof TState>(payload: { key: K }): Promise<{ success: boolean; key: K; value: TState[K] }> {
    const { key } = payload

    const stateObj = this.state as Record<string, unknown>
    if (!(String(key) in stateObj)) {
      throw new Error(`Property '${String(key)}' does not exist in component state`)
    }

    return { success: true, key, value: this.state[key] }
  }

  /**
   * Get all state values (snapshot)
   */
  async getSnapshot(): Promise<{ success: boolean; state: TState; timestamp: number }> {
    return {
      success: true,
      state: this.getSerializableState(),
      timestamp: Date.now()
    }
  }
}

// Utility types for better TypeScript experience
export type ComponentActions<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never
}

export type ComponentProps<T extends LiveComponent> = T extends LiveComponent<infer TState> ? TState : never

export type ActionParameters<T, K extends keyof T> = T[K] extends (...args: infer P) => any ? P : never

export type ActionReturnType<T, K extends keyof T> = T[K] extends (...args: any[]) => infer R ? R : never