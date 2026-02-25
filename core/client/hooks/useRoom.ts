// 🔥 FluxStack useRoom - Hook para conectar a salas do backend

import { useState, useEffect, useCallback, useRef } from 'react'

// Tipos de mensagens do servidor
interface RoomMessage {
  type: 'room:event' | 'room:state' | 'room:system'
  roomId: string
  event: string
  data: any
  timestamp: number
  senderId?: string
}

// Mensagens do cliente para o servidor
interface ClientMessage {
  type: 'room:join' | 'room:leave' | 'room:emit'
  roomId: string
  event?: string
  data?: any
  timestamp: number
}

// Opções do hook
interface UseRoomOptions<TState> {
  initialState: TState
  autoJoin?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: string) => void
  onStateChange?: (state: TState, prevState: TState) => void
}

// Retorno do hook
interface UseRoomReturn<TState, TEvents extends Record<string, any>> {
  // Estado
  state: TState

  // Status
  connected: boolean
  joined: boolean
  roomId: string | null

  // Ações
  join: (roomId: string) => void
  leave: () => void
  emit: <K extends keyof TEvents>(event: K, data: TEvents[K]) => void

  // Listeners
  on: <K extends keyof TEvents>(event: K, handler: (data: TEvents[K]) => void) => () => void
  onSystem: (event: string, handler: (data: any) => void) => () => void
}

// Gerenciador de conexão WebSocket (singleton por URL)
class RoomWebSocketManager {
  private static instances = new Map<string, RoomWebSocketManager>()

  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private listeners = new Map<string, Set<(msg: RoomMessage) => void>>()
  private connectionListeners = new Set<{
    onConnect?: () => void
    onDisconnect?: () => void
    onError?: (error: string) => void
  }>()
  private messageQueue: ClientMessage[] = []
  private isConnected = false

  static getInstance(url: string): RoomWebSocketManager {
    if (!this.instances.has(url)) {
      this.instances.set(url, new RoomWebSocketManager(url))
    }
    return this.instances.get(url)!
  }

  private constructor(url: string) {
    this.url = url
    this.connect()
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('[RoomWS] Connected')
        this.isConnected = true
        this.reconnectAttempts = 0

        // Enviar mensagens em fila
        for (const msg of this.messageQueue) {
          this.send(msg)
        }
        this.messageQueue = []

        // Notificar listeners
        for (const listener of this.connectionListeners) {
          listener.onConnect?.()
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: RoomMessage = JSON.parse(event.data)
          this.handleMessage(msg)
        } catch (error) {
          console.error('[RoomWS] Failed to parse message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('[RoomWS] Disconnected')
        this.isConnected = false

        for (const listener of this.connectionListeners) {
          listener.onDisconnect?.()
        }

        // Tentar reconectar
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
          console.log(`[RoomWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
          setTimeout(() => this.connect(), delay)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[RoomWS] Error:', error)
        for (const listener of this.connectionListeners) {
          listener.onError?.('WebSocket error')
        }
      }
    } catch (error) {
      console.error('[RoomWS] Failed to connect:', error)
    }
  }

  private handleMessage(msg: RoomMessage): void {
    // Chave para listeners: roomId:event
    const key = `${msg.roomId}:${msg.event}`
    const listeners = this.listeners.get(key)

    if (listeners) {
      for (const handler of listeners) {
        try {
          handler(msg)
        } catch (error) {
          console.error('[RoomWS] Handler error:', error)
        }
      }
    }

    // Também notificar listeners de todos eventos da sala
    const roomKey = `${msg.roomId}:*`
    const roomListeners = this.listeners.get(roomKey)
    if (roomListeners) {
      for (const handler of roomListeners) {
        try {
          handler(msg)
        } catch (error) {
          console.error('[RoomWS] Handler error:', error)
        }
      }
    }
  }

  send(message: ClientMessage): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  subscribe(roomId: string, event: string, handler: (msg: RoomMessage) => void): () => void {
    const key = `${roomId}:${event}`

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key)!.add(handler)

    return () => {
      this.listeners.get(key)?.delete(handler)
      if (this.listeners.get(key)?.size === 0) {
        this.listeners.delete(key)
      }
    }
  }

  addConnectionListener(listener: {
    onConnect?: () => void
    onDisconnect?: () => void
    onError?: (error: string) => void
  }): () => void {
    this.connectionListeners.add(listener)

    // Se já conectado, chamar onConnect imediatamente
    if (this.isConnected) {
      listener.onConnect?.()
    }

    return () => {
      this.connectionListeners.delete(listener)
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }
}

// Hook principal
export function useRoom<
  TDef extends { state: any; events: Record<string, any> }
>(
  wsUrl: string,
  options: UseRoomOptions<TDef['state']>
): UseRoomReturn<TDef['state'], TDef['events']> {
  const [state, setState] = useState<TDef['state']>(options.initialState)
  const [connected, setConnected] = useState(false)
  const [joined, setJoined] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)

  const wsManager = useRef<RoomWebSocketManager | null>(null)
  const eventHandlers = useRef<Map<string, Set<(data: any) => void>>>(new Map())
  const unsubscribes = useRef<(() => void)[]>([])

  // Inicializar WebSocket manager
  useEffect(() => {
    wsManager.current = RoomWebSocketManager.getInstance(wsUrl)

    const unsub = wsManager.current.addConnectionListener({
      onConnect: () => {
        setConnected(true)
        options.onConnect?.()
      },
      onDisconnect: () => {
        setConnected(false)
        setJoined(false)
        options.onDisconnect?.()
      },
      onError: options.onError
    })

    setConnected(wsManager.current.getConnectionStatus())

    return () => {
      unsub()
      // Limpar todas as subscriptions
      for (const unsub of unsubscribes.current) {
        unsub()
      }
    }
  }, [wsUrl])

  // Join room
  const join = useCallback((newRoomId: string) => {
    if (!wsManager.current) return

    // Sair da sala anterior se existir
    if (roomId && roomId !== newRoomId) {
      leave()
    }

    setRoomId(newRoomId)

    // Enviar mensagem de join
    wsManager.current.send({
      type: 'room:join',
      roomId: newRoomId,
      data: { initialState: options.initialState },
      timestamp: Date.now()
    })

    // Subscrever em todos os eventos da sala
    const unsub = wsManager.current.subscribe(newRoomId, '*', (msg) => {
      // Atualizar estado
      if (msg.event === '$state:sync' || msg.event === '$state:update') {
        setState(prev => {
          const newState = { ...prev, ...msg.data.state }
          options.onStateChange?.(newState, prev)
          return newState
        })
      } else if (msg.event === '$state:change') {
        setState(prev => {
          const newState = { ...prev, [msg.data.path]: msg.data.newValue }
          options.onStateChange?.(newState, prev)
          return newState
        })
      }

      // Chamar handlers registrados
      const handlers = eventHandlers.current.get(msg.event)
      if (handlers) {
        for (const handler of handlers) {
          handler(msg.data)
        }
      }
    })

    unsubscribes.current.push(unsub)
    setJoined(true)
  }, [roomId, options.initialState])

  // Leave room
  const leave = useCallback(() => {
    if (!wsManager.current || !roomId) return

    wsManager.current.send({
      type: 'room:leave',
      roomId,
      timestamp: Date.now()
    })

    // Limpar subscriptions
    for (const unsub of unsubscribes.current) {
      unsub()
    }
    unsubscribes.current = []
    eventHandlers.current.clear()

    setJoined(false)
    setRoomId(null)
    setState(options.initialState)
  }, [roomId, options.initialState])

  // Emit event
  const emit = useCallback(<K extends keyof TDef['events']>(
    event: K,
    data: TDef['events'][K]
  ) => {
    if (!wsManager.current || !roomId) return

    wsManager.current.send({
      type: 'room:emit',
      roomId,
      event: event as string,
      data,
      timestamp: Date.now()
    })
  }, [roomId])

  // Subscribe to event
  const on = useCallback(<K extends keyof TDef['events']>(
    event: K,
    handler: (data: TDef['events'][K]) => void
  ): (() => void) => {
    const eventKey = event as string

    if (!eventHandlers.current.has(eventKey)) {
      eventHandlers.current.set(eventKey, new Set())
    }
    eventHandlers.current.get(eventKey)!.add(handler)

    return () => {
      eventHandlers.current.get(eventKey)?.delete(handler)
    }
  }, [])

  // Subscribe to system event
  const onSystem = useCallback((
    event: string,
    handler: (data: any) => void
  ): (() => void) => {
    const eventKey = `$${event}`

    if (!eventHandlers.current.has(eventKey)) {
      eventHandlers.current.set(eventKey, new Set())
    }
    eventHandlers.current.get(eventKey)!.add(handler)

    return () => {
      eventHandlers.current.get(eventKey)?.delete(handler)
    }
  }, [])

  // Auto-join
  useEffect(() => {
    if (options.autoJoin && connected && !joined && roomId) {
      join(roomId)
    }
  }, [options.autoJoin, connected, joined, roomId, join])

  return {
    state,
    connected,
    joined,
    roomId,
    join,
    leave,
    emit,
    on,
    onSystem
  }
}

// Helper para criar hook tipado
export function createRoomHook<
  TDef extends { state: any; events: Record<string, any> }
>(wsUrl: string) {
  return (options: UseRoomOptions<TDef['state']>) => useRoom<TDef>(wsUrl, options)
}

export type { UseRoomOptions, UseRoomReturn, RoomMessage, ClientMessage }
