// 🔍 FluxStack Live Component Debugger - Server-Side Event Bus
//
// Captures and streams debug events from the Live Components system.
// Controlled by debugLive in config/system/runtime.config.ts (DEBUG_LIVE env var).
//
// Events captured:
//   - Component mount/unmount/rehydrate
//   - State changes (setState, proxy mutations)
//   - Action calls (name, payload, result, duration, errors)
//   - Room events (join, leave, emit)
//   - WebSocket connections/disconnections
//   - Errors
//
// Usage:
//   import { liveDebugger } from './LiveDebugger'
//   liveDebugger.emit('STATE_CHANGE', componentId, componentName, { delta, fullState })

import type { FluxStackWebSocket } from '@core/types/types'
import { appRuntimeConfig } from '@config'

// ===== Types =====

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
  | 'LOG'

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

// ===== Debug Message Types (sent to debug clients) =====

export interface DebugWsMessage {
  type: 'DEBUG_EVENT' | 'DEBUG_SNAPSHOT' | 'DEBUG_WELCOME' | 'DEBUG_DISABLED'
  event?: DebugEvent
  snapshot?: DebugSnapshot
  enabled?: boolean
  timestamp: number
}

// ===== LiveDebugger =====

const MAX_EVENTS = 500
const MAX_STATE_SIZE = 50_000 // Truncate large states in debug events

class LiveDebugger {
  private events: DebugEvent[] = []
  private componentSnapshots = new Map<string, ComponentSnapshot>()
  private debugClients = new Set<FluxStackWebSocket>()
  private _enabled = false
  private startTime = Date.now()
  private eventCounter = 0

  constructor() {
    // Read from FluxStack config system (config/system/runtime.config.ts)
    // Defaults to true in development, false otherwise.
    // Override via DEBUG_LIVE env var or config reload.
    this._enabled = appRuntimeConfig.values.debugLive ?? false
  }

  get enabled(): boolean {
    return this._enabled
  }

  set enabled(value: boolean) {
    this._enabled = value
  }

  // ===== Event Emission =====

  emit(
    type: DebugEventType,
    componentId: string | null,
    componentName: string | null,
    data: Record<string, unknown> = {}
  ): void {
    if (!this._enabled) return

    const event: DebugEvent = {
      id: `dbg-${++this.eventCounter}`,
      timestamp: Date.now(),
      type,
      componentId,
      componentName,
      data: this.sanitizeData(data)
    }

    // Store in circular buffer
    this.events.push(event)
    if (this.events.length > MAX_EVENTS) {
      this.events.shift()
    }

    // Update component snapshot
    if (componentId) {
      this.updateSnapshot(event)
    }

    // Broadcast to debug clients
    this.broadcastEvent(event)
  }

  // ===== Component Tracking =====

  trackComponentMount(
    componentId: string,
    componentName: string,
    initialState: Record<string, unknown>,
    room?: string,
    debugLabel?: string
  ): void {
    if (!this._enabled) return

    const snapshot: ComponentSnapshot = {
      componentId,
      componentName,
      debugLabel,
      state: this.sanitizeState(initialState),
      rooms: room ? [room] : [],
      mountedAt: Date.now(),
      lastActivity: Date.now(),
      actionCount: 0,
      stateChangeCount: 0,
      errorCount: 0
    }

    this.componentSnapshots.set(componentId, snapshot)

    this.emit('COMPONENT_MOUNT', componentId, componentName, {
      initialState: snapshot.state,
      room: room ?? null,
      debugLabel: debugLabel ?? null
    })
  }

  trackComponentUnmount(componentId: string): void {
    if (!this._enabled) return

    const snapshot = this.componentSnapshots.get(componentId)
    const componentName = snapshot?.componentName ?? null

    this.emit('COMPONENT_UNMOUNT', componentId, componentName, {
      lifetime: snapshot ? Date.now() - snapshot.mountedAt : 0,
      totalActions: snapshot?.actionCount ?? 0,
      totalStateChanges: snapshot?.stateChangeCount ?? 0,
      totalErrors: snapshot?.errorCount ?? 0
    })

    this.componentSnapshots.delete(componentId)
  }

  trackStateChange(
    componentId: string,
    delta: Record<string, unknown>,
    fullState: Record<string, unknown>,
    source: 'proxy' | 'setState' | 'rehydrate' = 'setState'
  ): void {
    if (!this._enabled) return

    const snapshot = this.componentSnapshots.get(componentId)
    if (snapshot) {
      snapshot.state = this.sanitizeState(fullState)
      snapshot.stateChangeCount++
      snapshot.lastActivity = Date.now()
    }

    this.emit('STATE_CHANGE', componentId, snapshot?.componentName ?? null, {
      delta,
      fullState: this.sanitizeState(fullState),
      source
    })
  }

  trackActionCall(
    componentId: string,
    action: string,
    payload: unknown
  ): void {
    if (!this._enabled) return

    const snapshot = this.componentSnapshots.get(componentId)
    if (snapshot) {
      snapshot.actionCount++
      snapshot.lastActivity = Date.now()
    }

    this.emit('ACTION_CALL', componentId, snapshot?.componentName ?? null, {
      action,
      payload: this.sanitizeData({ payload }).payload
    })
  }

  trackActionResult(
    componentId: string,
    action: string,
    result: unknown,
    duration: number
  ): void {
    if (!this._enabled) return

    const snapshot = this.componentSnapshots.get(componentId)

    this.emit('ACTION_RESULT', componentId, snapshot?.componentName ?? null, {
      action,
      result: this.sanitizeData({ result }).result,
      duration
    })
  }

  trackActionError(
    componentId: string,
    action: string,
    error: string,
    duration: number
  ): void {
    if (!this._enabled) return

    const snapshot = this.componentSnapshots.get(componentId)
    if (snapshot) {
      snapshot.errorCount++
    }

    this.emit('ACTION_ERROR', componentId, snapshot?.componentName ?? null, {
      action,
      error,
      duration
    })
  }

  trackRoomJoin(componentId: string, roomId: string): void {
    if (!this._enabled) return

    const snapshot = this.componentSnapshots.get(componentId)
    if (snapshot && !snapshot.rooms.includes(roomId)) {
      snapshot.rooms.push(roomId)
    }

    this.emit('ROOM_JOIN', componentId, snapshot?.componentName ?? null, { roomId })
  }

  trackRoomLeave(componentId: string, roomId: string): void {
    if (!this._enabled) return

    const snapshot = this.componentSnapshots.get(componentId)
    if (snapshot) {
      snapshot.rooms = snapshot.rooms.filter(r => r !== roomId)
    }

    this.emit('ROOM_LEAVE', componentId, snapshot?.componentName ?? null, { roomId })
  }

  trackRoomEmit(componentId: string, roomId: string, event: string, data: unknown): void {
    if (!this._enabled) return

    const snapshot = this.componentSnapshots.get(componentId)

    this.emit('ROOM_EMIT', componentId, snapshot?.componentName ?? null, {
      roomId,
      event,
      data: this.sanitizeData({ data }).data
    })
  }

  trackConnection(connectionId: string): void {
    if (!this._enabled) return
    this.emit('WS_CONNECT', null, null, { connectionId })
  }

  trackDisconnection(connectionId: string, componentCount: number): void {
    if (!this._enabled) return
    this.emit('WS_DISCONNECT', null, null, { connectionId, componentCount })
  }

  trackError(componentId: string | null, error: string, context?: Record<string, unknown>): void {
    if (!this._enabled) return

    const snapshot = componentId ? this.componentSnapshots.get(componentId) : null
    if (snapshot) {
      snapshot.errorCount++
    }

    this.emit('ERROR', componentId, snapshot?.componentName ?? null, {
      error,
      ...context
    })
  }

  // ===== Debug Client Management =====

  registerDebugClient(ws: FluxStackWebSocket): void {
    // If debugging is disabled, tell the client and close
    if (!this._enabled) {
      const disabled: DebugWsMessage = {
        type: 'DEBUG_DISABLED',
        enabled: false,
        timestamp: Date.now()
      }
      ws.send(JSON.stringify(disabled))
      ws.close()
      return
    }

    this.debugClients.add(ws)

    // Send welcome with current snapshot
    const welcome: DebugWsMessage = {
      type: 'DEBUG_WELCOME',
      enabled: true,
      snapshot: this.getSnapshot(),
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(welcome))

    // Send recent events
    for (const event of this.events.slice(-100)) {
      const msg: DebugWsMessage = {
        type: 'DEBUG_EVENT',
        event,
        timestamp: Date.now()
      }
      ws.send(JSON.stringify(msg))
    }
  }

  unregisterDebugClient(ws: FluxStackWebSocket): void {
    this.debugClients.delete(ws)
  }

  // ===== Snapshot =====

  getSnapshot(): DebugSnapshot {
    return {
      components: Array.from(this.componentSnapshots.values()),
      connections: this.debugClients.size,
      uptime: Date.now() - this.startTime,
      totalEvents: this.eventCounter
    }
  }

  getComponentState(componentId: string): ComponentSnapshot | null {
    return this.componentSnapshots.get(componentId) ?? null
  }

  getEvents(filter?: {
    componentId?: string
    type?: DebugEventType
    limit?: number
  }): DebugEvent[] {
    let filtered = this.events

    if (filter?.componentId) {
      filtered = filtered.filter(e => e.componentId === filter.componentId)
    }
    if (filter?.type) {
      filtered = filtered.filter(e => e.type === filter.type)
    }

    const limit = filter?.limit ?? 100
    return filtered.slice(-limit)
  }

  clearEvents(): void {
    this.events = []
  }

  // ===== Internal =====

  private broadcastEvent(event: DebugEvent): void {
    if (this.debugClients.size === 0) return

    const msg: DebugWsMessage = {
      type: 'DEBUG_EVENT',
      event,
      timestamp: Date.now()
    }
    const json = JSON.stringify(msg)

    for (const client of this.debugClients) {
      try {
        client.send(json)
      } catch {
        // Client disconnected, will be cleaned up
        this.debugClients.delete(client)
      }
    }
  }

  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    try {
      const json = JSON.stringify(data)
      if (json.length > MAX_STATE_SIZE) {
        return { _truncated: true, _size: json.length, _preview: json.slice(0, 500) + '...' }
      }
      return JSON.parse(json) // Deep clone to avoid mutation
    } catch {
      return { _serialization_error: true }
    }
  }

  private sanitizeState(state: Record<string, unknown>): Record<string, unknown> {
    try {
      const json = JSON.stringify(state)
      if (json.length > MAX_STATE_SIZE) {
        return { _truncated: true, _size: json.length }
      }
      return JSON.parse(json)
    } catch {
      return { _serialization_error: true }
    }
  }

  private updateSnapshot(event: DebugEvent): void {
    if (!event.componentId) return

    const snapshot = this.componentSnapshots.get(event.componentId)
    if (snapshot) {
      snapshot.lastActivity = event.timestamp
    }
  }
}

// Global singleton
export const liveDebugger = new LiveDebugger()
