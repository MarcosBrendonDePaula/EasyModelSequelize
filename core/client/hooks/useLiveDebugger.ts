// 🔍 FluxStack Live Component Debugger - Client Hook
//
// Connects to the debug WebSocket endpoint and streams debug events.
// Provides reactive state for building debugger UIs.
//
// Usage:
//   const debugger = useLiveDebugger()
//   debugger.components   // Active components with current states
//   debugger.events       // Event timeline
//   debugger.connected    // Connection status

import { useState, useEffect, useRef, useCallback } from 'react'

// ===== Types (mirrored from server) =====

export type DebugEventType =
  | 'COMPONENT_MOUNT'
  | 'COMPONENT_UNMOUNT'
  | 'COMPONENT_REHYDRATE'
  | 'STATE_CHANGE'
  | 'ACTION_CALL'
  | 'ACTION_RESULT'
  | 'ACTION_ERROR'
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'ROOM_EMIT'
  | 'ROOM_EVENT_RECEIVED'
  | 'WS_CONNECT'
  | 'WS_DISCONNECT'
  | 'ERROR'

export interface DebugEvent {
  id: string
  timestamp: number
  type: DebugEventType
  componentId: string | null
  componentName: string | null
  data: Record<string, unknown>
}

export interface ComponentSnapshot {
  componentId: string
  componentName: string
  /** Developer-defined label for easier identification in the debugger */
  debugLabel?: string
  state: Record<string, unknown>
  rooms: string[]
  mountedAt: number
  lastActivity: number
  actionCount: number
  stateChangeCount: number
  errorCount: number
}

export interface DebugSnapshot {
  components: ComponentSnapshot[]
  connections: number
  uptime: number
  totalEvents: number
}

export interface DebugFilter {
  componentId?: string | null
  types?: Set<DebugEventType>
  search?: string
}

export interface UseLiveDebuggerReturn {
  // Connection
  connected: boolean
  connecting: boolean
  /** Server reported that debugging is disabled */
  serverDisabled: boolean

  // Data
  components: ComponentSnapshot[]
  events: DebugEvent[]
  filteredEvents: DebugEvent[]
  snapshot: DebugSnapshot | null

  // Selected component
  selectedComponentId: string | null
  selectedComponent: ComponentSnapshot | null
  selectComponent: (id: string | null) => void

  // Filtering
  filter: DebugFilter
  setFilter: (filter: Partial<DebugFilter>) => void

  // Controls
  paused: boolean
  togglePause: () => void
  clearEvents: () => void
  reconnect: () => void

  // Stats
  eventCount: number
  componentCount: number
}

export interface UseLiveDebuggerOptions {
  /** Max events to keep in memory. Default: 500 */
  maxEvents?: number
  /** Auto-connect on mount. Default: true */
  autoConnect?: boolean
  /** Custom WebSocket URL */
  url?: string
}

// ===== Hook =====

export function useLiveDebugger(options: UseLiveDebuggerOptions = {}): UseLiveDebuggerReturn {
  const {
    maxEvents = 500,
    autoConnect = true,
    url
  } = options

  // State
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [components, setComponents] = useState<ComponentSnapshot[]>([])
  const [events, setEvents] = useState<DebugEvent[]>([])
  const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null)
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [filter, setFilterState] = useState<DebugFilter>({})
  const [paused, setPaused] = useState(false)
  const [serverDisabled, setServerDisabled] = useState(false)

  // Refs
  const wsRef = useRef<WebSocket | null>(null)
  const pausedRef = useRef(false)
  const serverDisabledRef = useRef(false)
  const reconnectTimeoutRef = useRef<number | null>(null)

  // Keep refs in sync
  pausedRef.current = paused
  serverDisabledRef.current = serverDisabled

  // Build WebSocket URL
  const getWsUrl = useCallback(() => {
    if (url) return url
    if (typeof window === 'undefined') return 'ws://localhost:3000/api/live/debug/ws'
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/live/debug/ws`
  }, [url])

  // Connect
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnecting(true)

    try {
      const ws = new WebSocket(getWsUrl())
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        setConnecting(false)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'DEBUG_DISABLED') {
            // Server has debugging disabled — stop reconnecting
            setServerDisabled(true)
            return
          }

          if (msg.type === 'DEBUG_WELCOME') {
            // Initial snapshot
            setServerDisabled(false)
            const snap = msg.snapshot as DebugSnapshot
            setSnapshot(snap)
            setComponents(snap.components)
          } else if (msg.type === 'DEBUG_EVENT') {
            if (pausedRef.current) return

            const debugEvent = msg.event as DebugEvent

            // Update events list
            setEvents(prev => {
              const next = [...prev, debugEvent]
              return next.length > maxEvents ? next.slice(-maxEvents) : next
            })

            // Update component snapshots based on event
            updateComponentsFromEvent(debugEvent)
          } else if (msg.type === 'DEBUG_SNAPSHOT') {
            const snap = msg.snapshot as DebugSnapshot
            setSnapshot(snap)
            setComponents(snap.components)
          }
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        setConnected(false)
        setConnecting(false)
        wsRef.current = null

        // Don't reconnect if server told us debug is disabled
        if (serverDisabledRef.current) return

        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (autoConnect) connect()
        }, 3000)
      }

      ws.onerror = () => {
        setConnecting(false)
      }
    } catch {
      setConnecting(false)
    }
  }, [getWsUrl, maxEvents, autoConnect])

  // Update components from incoming events
  const updateComponentsFromEvent = useCallback((event: DebugEvent) => {
    setComponents(prev => {
      switch (event.type) {
        case 'COMPONENT_MOUNT': {
          if (!event.componentId || !event.componentName) return prev
          const existing = prev.find(c => c.componentId === event.componentId)
          if (existing) return prev
          return [...prev, {
            componentId: event.componentId,
            componentName: event.componentName,
            debugLabel: (event.data.debugLabel as string) || undefined,
            state: (event.data.initialState as Record<string, unknown>) || {},
            rooms: event.data.room ? [event.data.room as string] : [],
            mountedAt: event.timestamp,
            lastActivity: event.timestamp,
            actionCount: 0,
            stateChangeCount: 0,
            errorCount: 0
          }]
        }

        case 'COMPONENT_UNMOUNT': {
          return prev.filter(c => c.componentId !== event.componentId)
        }

        case 'STATE_CHANGE': {
          return prev.map(c => {
            if (c.componentId !== event.componentId) return c
            return {
              ...c,
              state: (event.data.fullState as Record<string, unknown>) || c.state,
              stateChangeCount: c.stateChangeCount + 1,
              lastActivity: event.timestamp
            }
          })
        }

        case 'ACTION_CALL': {
          return prev.map(c => {
            if (c.componentId !== event.componentId) return c
            return {
              ...c,
              actionCount: c.actionCount + 1,
              lastActivity: event.timestamp
            }
          })
        }

        case 'ACTION_ERROR':
        case 'ERROR': {
          return prev.map(c => {
            if (c.componentId !== event.componentId) return c
            return {
              ...c,
              errorCount: c.errorCount + 1,
              lastActivity: event.timestamp
            }
          })
        }

        case 'ROOM_JOIN': {
          return prev.map(c => {
            if (c.componentId !== event.componentId) return c
            const roomId = event.data.roomId as string
            if (c.rooms.includes(roomId)) return c
            return { ...c, rooms: [...c.rooms, roomId] }
          })
        }

        case 'ROOM_LEAVE': {
          return prev.map(c => {
            if (c.componentId !== event.componentId) return c
            const roomId = event.data.roomId as string
            return { ...c, rooms: c.rooms.filter(r => r !== roomId) }
          })
        }

        default:
          return prev.map(c => {
            if (c.componentId !== event.componentId) return c
            return { ...c, lastActivity: event.timestamp }
          })
      }
    })
  }, [])

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
    setConnecting(false)
  }, [])

  // Reconnect
  const reconnect = useCallback(() => {
    disconnect()
    setTimeout(() => connect(), 100)
  }, [connect, disconnect])

  // Filter events
  const filteredEvents = events.filter(event => {
    if (filter.componentId && event.componentId !== filter.componentId) return false
    if (filter.types && filter.types.size > 0 && !filter.types.has(event.type)) return false
    if (filter.search) {
      const search = filter.search.toLowerCase()
      const matchesData = JSON.stringify(event.data).toLowerCase().includes(search)
      const matchesName = event.componentName?.toLowerCase().includes(search)
      const matchesType = event.type.toLowerCase().includes(search)
      if (!matchesData && !matchesName && !matchesType) return false
    }
    return true
  })

  // Selected component
  const selectedComponent = selectedComponentId
    ? components.find(c => c.componentId === selectedComponentId) ?? null
    : null

  // Filter setter
  const setFilter = useCallback((partial: Partial<DebugFilter>) => {
    setFilterState(prev => ({ ...prev, ...partial }))
  }, [])

  // Toggle pause
  const togglePause = useCallback(() => {
    setPaused(prev => !prev)
  }, [])

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([])
  }, [])

  // Auto-connect
  useEffect(() => {
    if (autoConnect) connect()
    return () => disconnect()
  }, [autoConnect, connect, disconnect])

  return {
    connected,
    connecting,
    serverDisabled,
    components,
    events,
    filteredEvents,
    snapshot,
    selectedComponentId,
    selectedComponent,
    selectComponent: setSelectedComponentId,
    filter,
    setFilter,
    paused,
    togglePause,
    clearEvents,
    reconnect,
    eventCount: events.length,
    componentCount: components.length
  }
}
