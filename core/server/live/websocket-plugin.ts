// 🔥 FluxStack Live Components - Enhanced WebSocket Plugin with Connection Management

import { componentRegistry } from './ComponentRegistry'
import { fileUploadManager } from './FileUploadManager'
import { connectionManager } from './WebSocketConnectionManager'
import { performanceMonitor } from './LiveComponentPerformanceMonitor'
import { liveRoomManager, type RoomMessage } from './LiveRoomManager'
import { liveAuthManager } from './auth/LiveAuthManager'
import { ANONYMOUS_CONTEXT } from './auth/LiveAuthContext'
import type { LiveMessage, FileUploadStartMessage, FileUploadChunkMessage, FileUploadCompleteMessage, BinaryChunkHeader, FluxStackWebSocket, FluxStackWSData } from '@core/types/types'
import type { Plugin, PluginContext } from '@core/index'
import { t, Elysia } from 'elysia'
import path from 'path'
import { liveLog } from './LiveLogger'
import { liveDebugger } from './LiveDebugger'

// ===== Response Schemas for Live Components Routes =====

const LiveWebSocketInfoSchema = t.Object({
  success: t.Boolean(),
  message: t.String(),
  endpoint: t.String(),
  status: t.String(),
  connectionManager: t.Any()
}, {
  description: 'WebSocket connection information and system statistics'
})

const LiveStatsSchema = t.Object({
  success: t.Boolean(),
  stats: t.Any(),
  timestamp: t.String()
}, {
  description: 'Live Components statistics including registered components and instances'
})

const LiveHealthSchema = t.Object({
  success: t.Boolean(),
  service: t.String(),
  status: t.String(),
  components: t.Number(),
  connections: t.Any(),
  uptime: t.Number(),
  timestamp: t.String()
}, {
  description: 'Health status of Live Components service'
})

const LiveConnectionsSchema = t.Object({
  success: t.Boolean(),
  connections: t.Array(t.Any()),
  systemStats: t.Any(),
  timestamp: t.String()
}, {
  description: 'List of all active WebSocket connections with metrics'
})

const LiveConnectionDetailsSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    connection: t.Any(),
    timestamp: t.String()
  }),
  t.Object({
    success: t.Literal(false),
    error: t.String()
  })
], {
  description: 'Detailed metrics for a specific connection'
})

const LivePoolStatsSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    pool: t.String(),
    stats: t.Any(),
    timestamp: t.String()
  }),
  t.Object({
    success: t.Literal(false),
    error: t.String()
  })
], {
  description: 'Statistics for a specific connection pool'
})

const LivePerformanceDashboardSchema = t.Object({
  success: t.Boolean(),
  dashboard: t.Any(),
  timestamp: t.String()
}, {
  description: 'Performance monitoring dashboard data'
})

const LiveComponentMetricsSchema = t.Union([
  t.Object({
    success: t.Literal(true),
    component: t.String(),
    metrics: t.Any(),
    alerts: t.Array(t.Any()),
    suggestions: t.Array(t.Any()),
    timestamp: t.String()
  }),
  t.Object({
    success: t.Literal(false),
    error: t.String()
  })
], {
  description: 'Performance metrics, alerts and suggestions for a specific component'
})

const LiveAlertResolveSchema = t.Object({
  success: t.Boolean(),
  message: t.String(),
  timestamp: t.String()
}, {
  description: 'Result of alert resolution operation'
})

// 🔒 Per-connection rate limiter to prevent WebSocket message flooding
class ConnectionRateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly maxTokens: number
  private readonly refillRate: number // tokens per second

  constructor(maxTokens = 100, refillRate = 50) {
    this.maxTokens = maxTokens
    this.tokens = maxTokens
    this.refillRate = refillRate
    this.lastRefill = Date.now()
  }

  tryConsume(count = 1): boolean {
    this.refill()
    if (this.tokens >= count) {
      this.tokens -= count
      return true
    }
    return false
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate)
    this.lastRefill = now
  }
}

const connectionRateLimiters = new Map<string, ConnectionRateLimiter>()

export const liveComponentsPlugin: Plugin = {
  name: 'live-components',
  version: '1.0.0',
  description: 'Real-time Live Components with Elysia native WebSocket support',
  author: 'FluxStack Team',
  priority: 'normal',
  category: 'core',
  tags: ['websocket', 'real-time', 'live-components'],
  
  setup: async (context: PluginContext) => {
    context.logger.debug('🔌 Setting up Live Components plugin with Elysia WebSocket...')
    
    // Auto-discover components from app/server/live directory
    const componentsPath = path.join(process.cwd(), 'app', 'server', 'live')
    await componentRegistry.autoDiscoverComponents(componentsPath)
    context.logger.debug('🔍 Component auto-discovery completed')
    
    // Create grouped routes for Live Components with documentation
    const liveRoutes = new Elysia({ prefix: '/api/live', tags: ['Live Components'] })
      // WebSocket route - supports both JSON and binary messages
      .ws('/ws', {
        // Use t.Any() to allow both JSON objects and binary data
        // Binary messages will be ArrayBuffer/Uint8Array, JSON will be parsed objects
        body: t.Any(),
        
        async open(ws) {
          const socket = ws as unknown as FluxStackWebSocket
          const connectionId = `ws-${crypto.randomUUID()}`
          liveLog('websocket', null, `🔌 Live Components WebSocket connected: ${connectionId}`)

          // 🔒 Initialize rate limiter for this connection
          connectionRateLimiters.set(connectionId, new ConnectionRateLimiter())

          // Register connection with enhanced connection manager
          connectionManager.registerConnection(ws as unknown as FluxStackWebSocket, connectionId, 'live-components')

          // Initialize and store connection data in ws.data
          const wsData: FluxStackWSData = {
            connectionId,
            components: new Map(),
            subscriptions: new Set(),
            connectedAt: new Date()
          }

          // Assign data to websocket (Elysia creates ws.data from context)
          if (!socket.data) {
            (socket as { data: FluxStackWSData }).data = wsData
          } else {
            socket.data.connectionId = connectionId
            socket.data.components = new Map()
            socket.data.subscriptions = new Set()
            socket.data.connectedAt = new Date()
          }

          // 🔒 Try to authenticate from query params (token=xxx)
          try {
            const query = (ws as any).data?.query as Record<string, string> | undefined
            const token = query?.token
            if (token && liveAuthManager.hasProviders()) {
              const authContext = await liveAuthManager.authenticate({ token })
              socket.data.authContext = authContext
              if (authContext.authenticated) {
                socket.data.userId = authContext.user?.id
                liveLog('websocket', null, `🔒 WebSocket authenticated via query: user=${authContext.user?.id}`)
              } else {
                // 🔒 Log failed auth attempts (token was provided but auth failed)
                liveLog('websocket', null, `🔒 WebSocket authentication failed via query token`)
              }
            }
          } catch (authError) {
            // 🔒 Log auth errors instead of silently ignoring them
            console.warn('🔒 WebSocket query auth error:', authError instanceof Error ? authError.message : 'Unknown error')
          }

          // Debug: track connection
          liveDebugger.trackConnection(connectionId)

          // Send connection confirmation
          ws.send(JSON.stringify({
            type: 'CONNECTION_ESTABLISHED',
            connectionId,
            timestamp: Date.now(),
            authenticated: socket.data.authContext?.authenticated ?? false,
            userId: socket.data.authContext?.user?.id,
            features: {
              compression: true,
              encryption: true,
              offlineQueue: true,
              loadBalancing: true,
              auth: liveAuthManager.hasProviders()
            }
          }))
        },
        
        async message(ws: unknown, rawMessage: LiveMessage | ArrayBuffer | Uint8Array) {
          const socket = ws as FluxStackWebSocket
          try {
            // 🔒 Rate limiting: reject messages if connection exceeds rate limit
            const connId = socket.data?.connectionId
            if (connId) {
              const limiter = connectionRateLimiters.get(connId)
              if (limiter && !limiter.tryConsume()) {
                socket.send(JSON.stringify({
                  type: 'ERROR',
                  error: 'Rate limit exceeded. Please slow down.',
                  timestamp: Date.now()
                }))
                return
              }
            }

            let message: LiveMessage
            let binaryChunkData: Buffer | null = null

            // Check if this is a binary message (file upload chunk)
            if (rawMessage instanceof ArrayBuffer || rawMessage instanceof Uint8Array) {
              // Binary protocol: [4 bytes header length][JSON header][binary data]
              const buffer = rawMessage instanceof ArrayBuffer
                ? Buffer.from(rawMessage)
                : Buffer.from(rawMessage.buffer, rawMessage.byteOffset, rawMessage.byteLength)

              // Read header length (first 4 bytes, little-endian)
              const headerLength = buffer.readUInt32LE(0)

              // Extract and parse JSON header
              const headerJson = buffer.slice(4, 4 + headerLength).toString('utf-8')
              const header = JSON.parse(headerJson) as BinaryChunkHeader

              // Extract binary chunk data
              binaryChunkData = buffer.slice(4 + headerLength)

              liveLog('messages', null, `📦 Binary chunk received: ${binaryChunkData.length} bytes for upload ${header.uploadId}`)

              // Create message with binary data attached
              message = {
                ...header,
                data: binaryChunkData, // Buffer instead of base64 string
                timestamp: Date.now()
              } as unknown as LiveMessage
            } else {
              // Regular JSON message
              message = rawMessage as LiveMessage
              message.timestamp = Date.now()
            }

            liveLog('messages', message.componentId || null, `📨 Received message:`, {
              type: message.type,
              componentId: message.componentId,
              action: message.action,
              requestId: message.requestId,
              isBinary: binaryChunkData !== null
            })

            // Handle different message types
            switch (message.type) {
              case 'COMPONENT_MOUNT':
                await handleComponentMount(socket, message)
                break
              case 'COMPONENT_REHYDRATE':
                await handleComponentRehydrate(socket, message)
                break
              case 'COMPONENT_UNMOUNT':
                await handleComponentUnmount(socket, message)
                break
              case 'CALL_ACTION':
                await handleActionCall(socket, message)
                break
              case 'PROPERTY_UPDATE':
                await handlePropertyUpdate(socket, message)
                break
              case 'COMPONENT_PING':
                await handleComponentPing(socket, message)
                break
              case 'AUTH':
                await handleAuth(socket, message)
                break
              case 'FILE_UPLOAD_START':
                await handleFileUploadStart(socket, message as FileUploadStartMessage)
                break
              case 'FILE_UPLOAD_CHUNK':
                await handleFileUploadChunk(socket, message as FileUploadChunkMessage, binaryChunkData)
                break
              case 'FILE_UPLOAD_COMPLETE':
                await handleFileUploadComplete(socket, message as unknown as FileUploadCompleteMessage)
                break
              // Room system messages
              case 'ROOM_JOIN':
                await handleRoomJoin(socket, message as unknown as RoomMessage)
                break
              case 'ROOM_LEAVE':
                await handleRoomLeave(socket, message as unknown as RoomMessage)
                break
              case 'ROOM_EMIT':
                await handleRoomEmit(socket, message as unknown as RoomMessage)
                break
              case 'ROOM_STATE_SET':
                await handleRoomStateSet(socket, message as unknown as RoomMessage)
                break
              default:
                console.warn(`❌ Unknown message type: ${message.type}`)
                socket.send(JSON.stringify({
                  type: 'ERROR',
                  error: `Unknown message type: ${message.type}`,
                  timestamp: Date.now()
                }))
            }
          } catch (error) {
            console.error('❌ WebSocket message error:', error)
            socket.send(JSON.stringify({
              type: 'ERROR',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: Date.now()
            }))
          }
        },
        
        close(ws) {
          const socket = ws as unknown as FluxStackWebSocket
          const connectionId = socket.data?.connectionId
          liveLog('websocket', null, `🔌 Live Components WebSocket disconnected: ${connectionId}`)

          // Debug: track disconnection
          const componentCount = socket.data?.components?.size ?? 0
          if (connectionId) {
            liveDebugger.trackDisconnection(connectionId, componentCount)
          }

          // 🔒 Cleanup rate limiter
          if (connectionId) {
            connectionRateLimiters.delete(connectionId)
          }

          // Cleanup connection in connection manager
          if (connectionId) {
            connectionManager.cleanupConnection(connectionId)
          }

          // Cleanup components for this connection
          componentRegistry.cleanupConnection(socket)
        }
      })

      // ===== Live Components Information Routes =====
      .get('/websocket-info', () => {
        return {
          success: true,
          message: 'Live Components WebSocket available via Elysia',
          endpoint: 'ws://localhost:3000/api/live/ws',
          status: 'running',
          connectionManager: connectionManager.getSystemStats()
        }
      }, {
        detail: {
          summary: 'Get WebSocket Information',
          description: 'Returns WebSocket endpoint information and connection manager statistics',
          tags: ['Live Components', 'WebSocket']
        },
        response: LiveWebSocketInfoSchema
      })

      .get('/stats', () => {
        const stats = componentRegistry.getStats()
        return {
          success: true,
          stats,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Get Live Components Statistics',
          description: 'Returns statistics about registered components and active instances',
          tags: ['Live Components', 'Monitoring']
        },
        response: LiveStatsSchema
      })

      .get('/health', () => {
        return {
          success: true,
          service: 'FluxStack Live Components',
          status: 'operational',
          components: componentRegistry.getStats().components,
          connections: connectionManager.getSystemStats(),
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Health Check',
          description: 'Returns the health status of the Live Components service',
          tags: ['Live Components', 'Health']
        },
        response: LiveHealthSchema
      })

      // ===== Connection Management Routes =====
      .get('/connections', () => {
        return {
          success: true,
          connections: connectionManager.getAllConnectionMetrics(),
          systemStats: connectionManager.getSystemStats(),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'List All Connections',
          description: 'Returns all active WebSocket connections with their metrics',
          tags: ['Live Components', 'Connections']
        },
        response: LiveConnectionsSchema
      })

      .get('/connections/:connectionId', ({ params }) => {
        const metrics = connectionManager.getConnectionMetrics(params.connectionId)
        if (!metrics) {
          return {
            success: false,
            error: 'Connection not found'
          }
        }
        return {
          success: true,
          connection: metrics,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Get Connection Details',
          description: 'Returns detailed metrics for a specific WebSocket connection',
          tags: ['Live Components', 'Connections']
        },
        params: t.Object({
          connectionId: t.String({ description: 'The unique connection identifier' })
        }),
        response: LiveConnectionDetailsSchema
      })

      .get('/pools/:poolId/stats', ({ params }) => {
        const stats = connectionManager.getPoolStats(params.poolId)
        if (!stats) {
          return {
            success: false,
            error: 'Pool not found'
          }
        }
        return {
          success: true,
          pool: params.poolId,
          stats,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Get Pool Statistics',
          description: 'Returns statistics for a specific connection pool',
          tags: ['Live Components', 'Connections', 'Pools']
        },
        params: t.Object({
          poolId: t.String({ description: 'The unique pool identifier' })
        }),
        response: LivePoolStatsSchema
      })

      // ===== Performance Monitoring Routes =====
      .get('/performance/dashboard', () => {
        return {
          success: true,
          dashboard: performanceMonitor.generateDashboard(),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Performance Dashboard',
          description: 'Returns comprehensive performance monitoring dashboard data',
          tags: ['Live Components', 'Performance']
        },
        response: LivePerformanceDashboardSchema
      })

      .get('/performance/components/:componentId', ({ params }) => {
        const metrics = performanceMonitor.getComponentMetrics(params.componentId)
        if (!metrics) {
          return {
            success: false,
            error: 'Component metrics not found'
          }
        }

        const alerts = performanceMonitor.getComponentAlerts(params.componentId)
        const suggestions = performanceMonitor.getComponentSuggestions(params.componentId)

        return {
          success: true,
          component: params.componentId,
          metrics,
          alerts,
          suggestions,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Get Component Performance Metrics',
          description: 'Returns performance metrics, alerts, and optimization suggestions for a specific component',
          tags: ['Live Components', 'Performance']
        },
        params: t.Object({
          componentId: t.String({ description: 'The unique component identifier' })
        }),
        response: LiveComponentMetricsSchema
      })

      .post('/performance/alerts/:alertId/resolve', ({ params }) => {
        const resolved = performanceMonitor.resolveAlert(params.alertId)
        return {
          success: resolved,
          message: resolved ? 'Alert resolved' : 'Alert not found',
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Resolve Performance Alert',
          description: 'Marks a performance alert as resolved',
          tags: ['Live Components', 'Performance', 'Alerts']
        },
        params: t.Object({
          alertId: t.String({ description: 'The unique alert identifier' })
        }),
        response: LiveAlertResolveSchema
      })

      // ===== Live Component Debugger Routes =====

      // Debug WebSocket - streams debug events in real-time
      .ws('/debug/ws', {
        body: t.Any(),

        open(ws) {
          const socket = ws as unknown as FluxStackWebSocket
          liveLog('websocket', null, '🔍 Debug client connected')
          liveDebugger.registerDebugClient(socket)
        },

        message() {
          // Debug clients are read-only, no incoming messages to handle
        },

        close(ws) {
          const socket = ws as unknown as FluxStackWebSocket
          liveLog('websocket', null, '🔍 Debug client disconnected')
          liveDebugger.unregisterDebugClient(socket)
        }
      })

      // Debug snapshot - current state of all components
      .get('/debug/snapshot', () => {
        return {
          success: true,
          snapshot: liveDebugger.getSnapshot(),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Debug Snapshot',
          description: 'Returns current state of all active Live Components for debugging',
          tags: ['Live Components', 'Debug']
        }
      })

      // Debug events - recent event history
      .get('/debug/events', ({ query }) => {
        const filter: { componentId?: string; type?: any; limit?: number } = {}
        if (query.componentId) filter.componentId = query.componentId as string
        if (query.type) filter.type = query.type
        if (query.limit) filter.limit = parseInt(query.limit as string, 10)

        return {
          success: true,
          events: liveDebugger.getEvents(filter),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Debug Events',
          description: 'Returns recent debug events, optionally filtered by component or type',
          tags: ['Live Components', 'Debug']
        },
        query: t.Object({
          componentId: t.Optional(t.String()),
          type: t.Optional(t.String()),
          limit: t.Optional(t.String())
        })
      })

      // Debug toggle - enable/disable debugger at runtime
      .post('/debug/toggle', ({ body }) => {
        const enabled = (body as any)?.enabled
        if (typeof enabled === 'boolean') {
          liveDebugger.enabled = enabled
        } else {
          liveDebugger.enabled = !liveDebugger.enabled
        }
        return {
          success: true,
          enabled: liveDebugger.enabled,
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Toggle Debugger',
          description: 'Enable or disable the Live Component debugger at runtime',
          tags: ['Live Components', 'Debug']
        }
      })

      // Debug component state - get specific component state
      .get('/debug/components/:componentId', ({ params }) => {
        const snapshot = liveDebugger.getComponentState(params.componentId)
        if (!snapshot) {
          return { success: false, error: 'Component not found' }
        }
        return {
          success: true,
          component: snapshot,
          events: liveDebugger.getEvents({
            componentId: params.componentId,
            limit: 50
          }),
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Debug Component State',
          description: 'Returns current state and recent events for a specific component',
          tags: ['Live Components', 'Debug']
        },
        params: t.Object({
          componentId: t.String()
        })
      })

      // Clear debug events
      .post('/debug/clear', () => {
        liveDebugger.clearEvents()
        return {
          success: true,
          message: 'Debug events cleared',
          timestamp: new Date().toISOString()
        }
      }, {
        detail: {
          summary: 'Clear Debug Events',
          description: 'Clears the debug event history buffer',
          tags: ['Live Components', 'Debug']
        }
      })

    // Register the grouped routes with the main app
    context.app.use(liveRoutes)
  },

  onServerStart: async (context: PluginContext) => {
    context.logger.debug('🔌 Live Components WebSocket ready on /api/live/ws')
  }
}

// Handler functions for WebSocket messages
async function handleComponentMount(ws: FluxStackWebSocket, message: LiveMessage) {
  const result = await componentRegistry.handleMessage(ws, message)

  if (result !== null) {
    const response = {
      type: 'COMPONENT_MOUNTED',
      componentId: message.componentId,
      success: result.success,
      result: result.result,
      error: result.error,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))
  }
}

async function handleComponentRehydrate(ws: FluxStackWebSocket, message: LiveMessage) {
  liveLog('lifecycle', message.componentId, '🔄 Processing component re-hydration request:', {
    componentId: message.componentId,
    payload: message.payload
  })

  try {
    const { componentName, signedState, room, userId } = message.payload || {}
    
    if (!componentName || !signedState) {
      throw new Error('Missing componentName or signedState in rehydration payload')
    }

    const result = await componentRegistry.rehydrateComponent(
      message.componentId,
      componentName,
      signedState,
      ws,
      { room, userId }
    )

    const response = {
      type: 'COMPONENT_REHYDRATED',
      componentId: message.componentId,
      success: result.success,
      result: {
        newComponentId: result.newComponentId,
        ...result
      },
      error: result.error,
      requestId: message.requestId,
      timestamp: Date.now()
    }

    liveLog('lifecycle', message.componentId, '📤 Sending COMPONENT_REHYDRATED response:', {
      type: response.type,
      success: response.success,
      newComponentId: response.result?.newComponentId,
      requestId: response.requestId
    })
    
    ws.send(JSON.stringify(response))

  } catch (error: any) {
    console.error('❌ Re-hydration handler error:', error.message)
    
    const errorResponse = {
      type: 'COMPONENT_REHYDRATED',
      componentId: message.componentId,
      success: false,
      error: error.message,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    
    ws.send(JSON.stringify(errorResponse))
  }
}

async function handleComponentUnmount(ws: FluxStackWebSocket, message: LiveMessage) {
  const result = await componentRegistry.handleMessage(ws, message)
  
  if (result !== null) {
    const response = {
      type: 'COMPONENT_UNMOUNTED',
      componentId: message.componentId,
      success: result.success,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))
  }
}

async function handleActionCall(ws: FluxStackWebSocket, message: LiveMessage) {
  const result = await componentRegistry.handleMessage(ws, message)
  
  if (result !== null) {
    const response = {
      type: message.expectResponse ? 'ACTION_RESPONSE' : 'MESSAGE_RESPONSE',
      originalType: message.type,
      componentId: message.componentId,
      success: result.success,
      result: result.result,
      error: result.error,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))
  }
}

async function handlePropertyUpdate(ws: FluxStackWebSocket, message: LiveMessage) {
  const result = await componentRegistry.handleMessage(ws, message)

  if (result !== null) {
    const response = {
      type: 'PROPERTY_UPDATED',
      componentId: message.componentId,
      success: result.success,
      result: result.result,
      error: result.error,
      requestId: message.requestId,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(response))
  }
}

async function handleComponentPing(ws: FluxStackWebSocket, message: LiveMessage) {
  // Update component's last activity timestamp
  const updated = componentRegistry.updateComponentActivity(message.componentId)

  // Send pong response
  const response = {
    type: 'COMPONENT_PONG',
    componentId: message.componentId,
    success: updated,
    requestId: message.requestId,
    timestamp: Date.now()
  }

  ws.send(JSON.stringify(response))
}

// ===== Auth Handler =====

async function handleAuth(ws: FluxStackWebSocket, message: LiveMessage) {
  liveLog('websocket', null, '🔒 Processing WebSocket authentication request')

  try {
    const credentials = message.payload || {}
    const providerName = credentials.provider as string | undefined

    if (!liveAuthManager.hasProviders()) {
      ws.send(JSON.stringify({
        type: 'AUTH_RESPONSE',
        success: false,
        error: 'No auth providers configured',
        requestId: message.requestId,
        timestamp: Date.now()
      }))
      return
    }

    const authContext = await liveAuthManager.authenticate(credentials, providerName)

    // Store auth context on the WebSocket connection
    ws.data.authContext = authContext

    if (authContext.authenticated) {
      ws.data.userId = authContext.user?.id
      liveLog('websocket', null, `🔒 WebSocket authenticated: user=${authContext.user?.id}`)
    }

    ws.send(JSON.stringify({
      type: 'AUTH_RESPONSE',
      success: authContext.authenticated,
      authenticated: authContext.authenticated,
      userId: authContext.user?.id,
      roles: authContext.user?.roles,
      requestId: message.requestId,
      timestamp: Date.now()
    }))
  } catch (error: any) {
    console.error('🔒 WebSocket auth error:', error.message)
    ws.send(JSON.stringify({
      type: 'AUTH_RESPONSE',
      success: false,
      error: error.message,
      requestId: message.requestId,
      timestamp: Date.now()
    }))
  }
}

// File Upload Handler Functions
async function handleFileUploadStart(ws: FluxStackWebSocket, message: FileUploadStartMessage) {
  liveLog('messages', message.componentId || null, '📤 Starting file upload:', message.uploadId)

  // 🔒 Pass userId for per-user upload quota enforcement
  const userId = ws.data?.userId || ws.data?.authContext?.user?.id
  const result = await fileUploadManager.startUpload(message, userId)

  const response = {
    type: 'FILE_UPLOAD_START_RESPONSE',
    componentId: message.componentId,
    uploadId: message.uploadId,
    success: result.success,
    error: result.error,
    requestId: message.requestId,
    timestamp: Date.now()
  }

  ws.send(JSON.stringify(response))
}

async function handleFileUploadChunk(ws: FluxStackWebSocket, message: FileUploadChunkMessage, binaryData: Buffer | null = null) {
  liveLog('messages', message.componentId || null, `📦 Receiving chunk ${message.chunkIndex + 1} for upload ${message.uploadId}${binaryData ? ' (binary)' : ' (base64)'}`)

  const progressResponse = await fileUploadManager.receiveChunk(message, ws, binaryData)

  if (progressResponse) {
    // Add requestId to response so client can correlate it
    const responseWithRequestId = {
      ...progressResponse,
      requestId: message.requestId,
      success: true
    }
    ws.send(JSON.stringify(responseWithRequestId))
  } else {
    // Send error response
    const errorResponse = {
      type: 'FILE_UPLOAD_ERROR',
      componentId: message.componentId,
      uploadId: message.uploadId,
      error: 'Failed to process chunk',
      requestId: message.requestId,
      success: false,
      timestamp: Date.now()
    }
    ws.send(JSON.stringify(errorResponse))
  }
}

async function handleFileUploadComplete(ws: FluxStackWebSocket, message: FileUploadCompleteMessage) {
  liveLog('messages', null, '✅ Completing file upload:', message.uploadId)

  const completeResponse = await fileUploadManager.completeUpload(message)

  // Add requestId to response so client can correlate it
  const responseWithRequestId = {
    ...completeResponse,
    requestId: message.requestId
  }

  ws.send(JSON.stringify(responseWithRequestId))
}

// ===== Room System Handlers =====

async function handleRoomJoin(ws: FluxStackWebSocket, message: RoomMessage) {
  liveLog('rooms', message.componentId, `🚪 Component ${message.componentId} joining room ${message.roomId}`)

  try {
    // 🔒 Validate room name format (alphanumeric, hyphens, underscores, max 64 chars)
    if (!message.roomId || !/^[a-zA-Z0-9_:.-]{1,64}$/.test(message.roomId)) {
      throw new Error('Invalid room name. Must be 1-64 alphanumeric characters, hyphens, underscores, dots, or colons.')
    }

    // 🔒 Room authorization check
    const authContext = ws.data?.authContext || ANONYMOUS_CONTEXT
    const authResult = await liveAuthManager.authorizeRoom(authContext, message.roomId)
    if (!authResult.allowed) {
      throw new Error(`Room access denied: ${authResult.reason}`)
    }

    const result = liveRoomManager.joinRoom(
      message.componentId,
      message.roomId,
      ws,
      undefined // 🔒 Don't allow client to set initial room state - server controls this
    )

    const response = {
      type: 'ROOM_JOINED',
      componentId: message.componentId,
      roomId: message.roomId,
      success: true,
      state: result.state,
      requestId: message.requestId,
      timestamp: Date.now()
    }

    ws.send(JSON.stringify(response))
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      componentId: message.componentId,
      roomId: message.roomId,
      error: error.message,
      requestId: message.requestId,
      timestamp: Date.now()
    }))
  }
}

async function handleRoomLeave(ws: FluxStackWebSocket, message: RoomMessage) {
  liveLog('rooms', message.componentId, `🚶 Component ${message.componentId} leaving room ${message.roomId}`)

  try {
    liveRoomManager.leaveRoom(message.componentId, message.roomId)

    const response = {
      type: 'ROOM_LEFT',
      componentId: message.componentId,
      roomId: message.roomId,
      success: true,
      requestId: message.requestId,
      timestamp: Date.now()
    }

    ws.send(JSON.stringify(response))
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      componentId: message.componentId,
      roomId: message.roomId,
      error: error.message,
      requestId: message.requestId,
      timestamp: Date.now()
    }))
  }
}

async function handleRoomEmit(ws: FluxStackWebSocket, message: RoomMessage) {
  liveLog('rooms', message.componentId, `📡 Component ${message.componentId} emitting '${message.event}' to room ${message.roomId}`)

  try {
    // 🔒 Validate room name
    if (!message.roomId || !/^[a-zA-Z0-9_:.-]{1,64}$/.test(message.roomId)) {
      throw new Error('Invalid room name')
    }

    const count = liveRoomManager.emitToRoom(
      message.roomId,
      message.event!,
      message.data,
      message.componentId // Excluir quem enviou
    )

    liveLog('rooms', message.componentId, `   → Notified ${count} components`)
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      componentId: message.componentId,
      roomId: message.roomId,
      error: error.message,
      timestamp: Date.now()
    }))
  }
}

async function handleRoomStateSet(ws: FluxStackWebSocket, message: RoomMessage) {
  liveLog('rooms', message.componentId, `📝 Component ${message.componentId} updating state in room ${message.roomId}`)

  try {
    // 🔒 Validate room name
    if (!message.roomId || !/^[a-zA-Z0-9_:.-]{1,64}$/.test(message.roomId)) {
      throw new Error('Invalid room name')
    }

    // 🔒 Validate state size (max 1MB per update to prevent memory attacks)
    const stateStr = JSON.stringify(message.data ?? {})
    if (stateStr.length > 1024 * 1024) {
      throw new Error('Room state update too large (max 1MB)')
    }

    liveRoomManager.setRoomState(
      message.roomId,
      message.data ?? {},
      message.componentId // Excluir quem enviou
    )
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      componentId: message.componentId,
      roomId: message.roomId,
      error: error.message,
      timestamp: Date.now()
    }))
  }
}
