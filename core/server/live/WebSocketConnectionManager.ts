// 🔌 FluxStack Enhanced WebSocket Connection Manager
// Advanced connection management with pooling, load balancing, and health monitoring

import { EventEmitter } from 'events'
import type { FluxStackWebSocket } from '@core/types/types'
import { liveLog, liveWarn } from './LiveLogger'

export interface ConnectionConfig {
  maxConnections: number
  connectionTimeout: number
  heartbeatInterval: number
  reconnectAttempts: number
  reconnectDelay: number
  maxReconnectDelay: number
  jitterFactor: number
  loadBalancing: 'round-robin' | 'least-connections' | 'random'
  healthCheckInterval: number
  messageQueueSize: number
  offlineQueueEnabled: boolean
}

export interface ConnectionMetrics {
  id: string
  connectedAt: Date
  lastActivity: Date
  messagesSent: number
  messagesReceived: number
  bytesTransferred: number
  latency: number
  status: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error'
  errorCount: number
  reconnectCount: number
}

export interface ConnectionHealth {
  id: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: Date
  issues: string[]
  metrics: ConnectionMetrics
}

export interface QueuedMessage {
  id: string
  message: any
  timestamp: number
  priority: number
  retryCount: number
  maxRetries: number
}

export interface LoadBalancerStats {
  strategy: string
  totalConnections: number
  activeConnections: number
  averageLatency: number
  messageDistribution: Record<string, number>
}

export class WebSocketConnectionManager extends EventEmitter {
  private connections = new Map<string, FluxStackWebSocket>() // connectionId -> websocket
  private connectionMetrics = new Map<string, ConnectionMetrics>()
  private connectionPools = new Map<string, Set<string>>() // poolId -> connectionIds
  private messageQueues = new Map<string, QueuedMessage[]>() // connectionId -> queued messages
  private healthCheckInterval!: NodeJS.Timeout
  private config: ConnectionConfig
  private loadBalancerIndex = 0

  constructor(config?: Partial<ConnectionConfig>) {
    super()
    
    this.config = {
      maxConnections: 10000,
      connectionTimeout: 30000,
      heartbeatInterval: 30000,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      jitterFactor: 0.1,
      loadBalancing: 'round-robin',
      healthCheckInterval: 60000,
      messageQueueSize: 1000,
      offlineQueueEnabled: true,
      ...config
    }
    
    this.setupHealthMonitoring()
    this.setupHeartbeat()
  }

  /**
   * Register a new WebSocket connection
   */
  registerConnection(ws: FluxStackWebSocket, connectionId: string, poolId?: string): void {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error('Maximum connections exceeded')
    }

    // Create connection metrics
    const metrics: ConnectionMetrics = {
      id: connectionId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      latency: 0,
      status: 'connected',
      errorCount: 0,
      reconnectCount: 0
    }

    this.connections.set(connectionId, ws)
    this.connectionMetrics.set(connectionId, metrics)

    // Add to pool if specified
    if (poolId) {
      this.addToPool(connectionId, poolId)
    }

    // Initialize message queue
    this.messageQueues.set(connectionId, [])

    // Setup connection event handlers
    this.setupConnectionHandlers(ws, connectionId)

    liveLog('websocket', null, `🔌 Connection registered: ${connectionId} (Pool: ${poolId || 'default'})`)
    this.emit('connectionRegistered', { connectionId, poolId })
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(ws: FluxStackWebSocket, connectionId: string): void {
    const metrics = this.connectionMetrics.get(connectionId)
    if (!metrics) return

    // Handle incoming messages
    // Note: Bun/Elysia WebSockets use different event handling patterns
    // This code provides compatibility layer for both Node.js style (on/addListener) and browser style (addEventListener)
    const wsAny = ws as any
    const addListener = (event: string, handler: (...args: any[]) => void) => {
      if (typeof wsAny.on === 'function') {
        wsAny.on(event, handler)
      } else if (typeof wsAny.addEventListener === 'function') {
        wsAny.addEventListener(event, handler)
      } else if (typeof wsAny.addListener === 'function') {
        wsAny.addListener(event, handler)
      }
    }

    addListener('message', (data: any) => {
      metrics.messagesReceived++
      metrics.lastActivity = new Date()
      if (typeof data === 'string') {
        metrics.bytesTransferred += Buffer.byteLength(data)
      } else if (data instanceof Buffer) {
        metrics.bytesTransferred += data.length
      }

      this.emit('messageReceived', { connectionId, data })
    })

    // Handle connection close
    addListener('close', () => {
      metrics.status = 'disconnected'
      this.handleConnectionClose(connectionId)
    })

    // Handle connection errors
    addListener('error', (error: Error) => {
      metrics.errorCount++
      metrics.status = 'error'
      this.handleConnectionError(connectionId, error)
    })

    // Handle pong responses for latency measurement
    addListener('pong', () => {
      const now = Date.now()
      const pingTime = wsAny._pingTime
      if (pingTime) {
        metrics.latency = now - pingTime
        delete wsAny._pingTime
      }
    })
  }

  /**
   * Add connection to a pool
   */
  addToPool(connectionId: string, poolId: string): void {
    if (!this.connectionPools.has(poolId)) {
      this.connectionPools.set(poolId, new Set())
    }
    
    this.connectionPools.get(poolId)!.add(connectionId)
    liveLog('websocket', null, `🏊 Connection ${connectionId} added to pool ${poolId}`)
  }

  /**
   * Remove connection from pool
   */
  removeFromPool(connectionId: string, poolId: string): void {
    const pool = this.connectionPools.get(poolId)
    if (pool) {
      pool.delete(connectionId)
      if (pool.size === 0) {
        this.connectionPools.delete(poolId)
      }
    }
  }

  /**
   * Send message with load balancing and queuing
   */
  async sendMessage(
    message: any,
    target?: { connectionId?: string; poolId?: string },
    options?: { priority?: number; maxRetries?: number; queueIfOffline?: boolean }
  ): Promise<boolean> {
    const { priority = 1, maxRetries = 3, queueIfOffline = true } = options || {}

    let targetConnections: string[] = []

    if (target?.connectionId) {
      // Send to specific connection
      targetConnections = [target.connectionId]
    } else if (target?.poolId) {
      // Send to pool using load balancing
      targetConnections = this.selectConnectionsFromPool(target.poolId, 1)
    } else {
      // Broadcast to all connections
      targetConnections = Array.from(this.connections.keys())
    }

    let successCount = 0

    for (const connectionId of targetConnections) {
      const success = await this.sendToConnection(connectionId, message, {
        priority,
        maxRetries,
        queueIfOffline
      })
      
      if (success) successCount++
    }

    return successCount > 0
  }

  /**
   * Send message to specific connection
   */
  private async sendToConnection(
    connectionId: string,
    message: any,
    options: { priority: number; maxRetries: number; queueIfOffline: boolean }
  ): Promise<boolean> {
    const ws = this.connections.get(connectionId)
    const metrics = this.connectionMetrics.get(connectionId)

    if (!ws || !metrics) {
      return false
    }

    // Check if connection is ready
    if (ws.readyState !== 1) { // WebSocket.OPEN
      if (options.queueIfOffline && this.config.offlineQueueEnabled) {
        return this.queueMessage(connectionId, message, options)
      }
      return false
    }

    try {
      const serializedMessage = JSON.stringify(message)
      ws.send(serializedMessage)
      
      // Update metrics
      metrics.messagesSent++
      metrics.lastActivity = new Date()
      metrics.bytesTransferred += Buffer.byteLength(serializedMessage)

      return true
    } catch (error) {
      console.error(`❌ Failed to send message to ${connectionId}:`, error)
      
      // Queue message for retry if enabled
      if (options.queueIfOffline) {
        return this.queueMessage(connectionId, message, options)
      }
      
      return false
    }
  }

  /**
   * Queue message for offline delivery
   */
  private queueMessage(
    connectionId: string,
    message: any,
    options: { priority: number; maxRetries: number }
  ): boolean {
    const queue = this.messageQueues.get(connectionId)
    if (!queue) return false

    // Check queue size limit
    if (queue.length >= this.config.messageQueueSize) {
      // Remove oldest low-priority message
      const lowPriorityIndex = queue.findIndex(msg => msg.priority <= options.priority)
      if (lowPriorityIndex !== -1) {
        queue.splice(lowPriorityIndex, 1)
      } else {
        return false // Queue full with higher priority messages
      }
    }

    const queuedMessage: QueuedMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      timestamp: Date.now(),
      priority: options.priority,
      retryCount: 0,
      maxRetries: options.maxRetries
    }

    // Insert message in priority order
    const insertIndex = queue.findIndex(msg => msg.priority < options.priority)
    if (insertIndex === -1) {
      queue.push(queuedMessage)
    } else {
      queue.splice(insertIndex, 0, queuedMessage)
    }

    liveLog('messages', null, `📬 Message queued for ${connectionId}: ${queuedMessage.id}`)
    return true
  }

  /**
   * Process queued messages for a connection
   */
  private async processMessageQueue(connectionId: string): Promise<void> {
    const queue = this.messageQueues.get(connectionId)
    const ws = this.connections.get(connectionId)
    
    if (!queue || !ws || ws.readyState !== 1) return

    const messagesToProcess = [...queue]
    queue.length = 0 // Clear queue

    for (const queuedMessage of messagesToProcess) {
      try {
        const success = await this.sendToConnection(connectionId, queuedMessage.message, {
          priority: queuedMessage.priority,
          maxRetries: queuedMessage.maxRetries - queuedMessage.retryCount,
          queueIfOffline: false
        })

        if (!success) {
          queuedMessage.retryCount++
          if (queuedMessage.retryCount < queuedMessage.maxRetries) {
            // Re-queue for retry
            queue.push(queuedMessage)
          } else {
            liveWarn('messages', null, `❌ Message ${queuedMessage.id} exceeded max retries`)
          }
        } else {
          liveLog('messages', null, `✅ Queued message delivered: ${queuedMessage.id}`)
        }
      } catch (error) {
        console.error(`❌ Error processing queued message ${queuedMessage.id}:`, error)
      }
    }
  }

  /**
   * Select connections from pool using load balancing strategy
   */
  private selectConnectionsFromPool(poolId: string, count: number = 1): string[] {
    const pool = this.connectionPools.get(poolId)
    if (!pool || pool.size === 0) return []

    const availableConnections = Array.from(pool).filter(connectionId => {
      const ws = this.connections.get(connectionId)
      return ws && ws.readyState === 1 // WebSocket.OPEN
    })

    if (availableConnections.length === 0) return []

    switch (this.config.loadBalancing) {
      case 'round-robin':
        return this.roundRobinSelection(availableConnections, count)
      
      case 'least-connections':
        return this.leastConnectionsSelection(availableConnections, count)
      
      case 'random':
        return this.randomSelection(availableConnections, count)
      
      default:
        return this.roundRobinSelection(availableConnections, count)
    }
  }

  /**
   * Round-robin load balancing
   */
  private roundRobinSelection(connections: string[], count: number): string[] {
    const selected: string[] = []
    
    for (let i = 0; i < count && i < connections.length; i++) {
      const index = (this.loadBalancerIndex + i) % connections.length
      selected.push(connections[index])
    }
    
    this.loadBalancerIndex = (this.loadBalancerIndex + count) % connections.length
    return selected
  }

  /**
   * Least connections load balancing
   */
  private leastConnectionsSelection(connections: string[], count: number): string[] {
    const connectionLoads = connections.map(connectionId => {
      const metrics = this.connectionMetrics.get(connectionId)
      const queueSize = this.messageQueues.get(connectionId)?.length || 0
      return {
        connectionId,
        load: (metrics?.messagesSent || 0) + queueSize
      }
    })

    connectionLoads.sort((a, b) => a.load - b.load)
    return connectionLoads.slice(0, count).map(item => item.connectionId)
  }

  /**
   * Random load balancing
   */
  private randomSelection(connections: string[], count: number): string[] {
    const shuffled = [...connections].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  /**
   * Handle connection close
   */
  private handleConnectionClose(connectionId: string): void {
    liveLog('websocket', null, `🔌 Connection closed: ${connectionId}`)
    
    // Update metrics
    const metrics = this.connectionMetrics.get(connectionId)
    if (metrics) {
      metrics.status = 'disconnected'
    }

    // Remove from pools
    for (const [poolId, pool] of this.connectionPools) {
      if (pool.has(connectionId)) {
        this.removeFromPool(connectionId, poolId)
      }
    }

    this.emit('connectionClosed', { connectionId })
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(connectionId: string, error: Error): void {
    console.error(`❌ Connection error for ${connectionId}:`, error.message)
    
    const metrics = this.connectionMetrics.get(connectionId)
    if (metrics) {
      metrics.errorCount++
    }

    this.emit('connectionError', { connectionId, error })
  }

  /**
   * Setup health monitoring
   */
  private setupHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, this.config.healthCheckInterval)
  }

  /**
   * Setup heartbeat/ping mechanism
   */
  private setupHeartbeat(): void {
    setInterval(() => {
      this.sendHeartbeat()
    }, this.config.heartbeatInterval)
  }

  /**
   * Send heartbeat to all connections
   */
  private sendHeartbeat(): void {
    for (const [connectionId, ws] of this.connections) {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          const wsAny = ws as any
          wsAny._pingTime = Date.now()
          if (typeof wsAny.ping === 'function') {
            wsAny.ping()
          }
        } catch (error) {
          console.error(`❌ Heartbeat failed for ${connectionId}:`, error)
        }
      }
    }
  }

  /**
   * Perform health checks on all connections
   */
  private async performHealthChecks(): Promise<void> {
    const healthChecks: ConnectionHealth[] = []
    const now = Date.now()

    for (const [connectionId, metrics] of this.connectionMetrics) {
      const ws = this.connections.get(connectionId)
      const issues: string[] = []
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

      // Check connection state
      if (!ws || ws.readyState !== 1) {
        issues.push('Connection not open')
        status = 'unhealthy'
      }

      // Check activity
      const timeSinceActivity = now - metrics.lastActivity.getTime()
      if (timeSinceActivity > this.config.heartbeatInterval * 2) {
        issues.push('No activity for extended period')
        status = status === 'healthy' ? 'degraded' : 'unhealthy'
      }

      // Check error rate
      if (metrics.errorCount > 10) {
        issues.push('High error rate')
        status = 'unhealthy'
      }

      // Check latency
      if (metrics.latency > 5000) { // 5 seconds
        issues.push('High latency detected')
        status = status === 'healthy' ? 'degraded' : status
      }

      healthChecks.push({
        id: connectionId,
        status,
        lastCheck: new Date(),
        issues,
        metrics: { ...metrics }
      })
    }

    // Handle unhealthy connections
    const unhealthyConnections = healthChecks.filter(hc => hc.status === 'unhealthy')
    for (const unhealthy of unhealthyConnections) {
      await this.handleUnhealthyConnection(unhealthy.id)
    }

    this.emit('healthCheckCompleted', { healthChecks, unhealthyCount: unhealthyConnections.length })
  }

  /**
   * Handle unhealthy connection
   */
  private async handleUnhealthyConnection(connectionId: string): Promise<void> {
    liveWarn('websocket', null, `⚠️ Handling unhealthy connection: ${connectionId}`)
    
    const ws = this.connections.get(connectionId)
    if (ws) {
      try {
        ws.close()
      } catch (error) {
        console.error(`❌ Error closing unhealthy connection ${connectionId}:`, error)
      }
    }

    this.cleanupConnection(connectionId)
  }

  /**
   * Cleanup connection resources
   */
  cleanupConnection(connectionId: string): void {
    // Process any remaining queued messages
    this.processMessageQueue(connectionId)

    // Remove from all data structures
    this.connections.delete(connectionId)
    this.connectionMetrics.delete(connectionId)
    this.messageQueues.delete(connectionId)

    // Remove from pools
    for (const [poolId, pool] of this.connectionPools) {
      if (pool.has(connectionId)) {
        this.removeFromPool(connectionId, poolId)
      }
    }

    liveLog('websocket', null, `🧹 Connection cleaned up: ${connectionId}`)
  }

  /**
   * Get connection metrics
   */
  getConnectionMetrics(connectionId: string): ConnectionMetrics | null {
    return this.connectionMetrics.get(connectionId) || null
  }

  /**
   * Get all connection metrics
   */
  getAllConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values())
  }

  /**
   * Get pool statistics
   */
  getPoolStats(poolId: string): LoadBalancerStats | null {
    const pool = this.connectionPools.get(poolId)
    if (!pool) return null

    const connections = Array.from(pool)
    const activeConnections = connections.filter(connectionId => {
      const ws = this.connections.get(connectionId)
      return ws && ws.readyState === 1
    })

    const totalLatency = activeConnections.reduce((sum, connectionId) => {
      const metrics = this.connectionMetrics.get(connectionId)
      return sum + (metrics?.latency || 0)
    }, 0)

    const messageDistribution: Record<string, number> = {}
    for (const connectionId of connections) {
      const metrics = this.connectionMetrics.get(connectionId)
      messageDistribution[connectionId] = metrics?.messagesSent || 0
    }

    return {
      strategy: this.config.loadBalancing,
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      averageLatency: activeConnections.length > 0 ? totalLatency / activeConnections.length : 0,
      messageDistribution
    }
  }

  /**
   * Get overall system stats
   */
  getSystemStats() {
    const totalConnections = this.connections.size
    const activeConnections = Array.from(this.connections.values()).filter(ws => ws.readyState === 1).length
    const totalPools = this.connectionPools.size
    const totalQueuedMessages = Array.from(this.messageQueues.values()).reduce((sum, queue) => sum + queue.length, 0)

    return {
      totalConnections,
      activeConnections,
      totalPools,
      totalQueuedMessages,
      maxConnections: this.config.maxConnections,
      connectionUtilization: (totalConnections / this.config.maxConnections) * 100
    }
  }

  /**
   * Shutdown connection manager
   */
  shutdown(): void {
    liveLog('websocket', null, '🔌 Shutting down WebSocket Connection Manager...')
    
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    // Close all connections
    for (const [connectionId, ws] of this.connections) {
      try {
        ws.close()
      } catch (error) {
        console.error(`❌ Error closing connection ${connectionId}:`, error)
      }
    }

    // Clear all data
    this.connections.clear()
    this.connectionMetrics.clear()
    this.connectionPools.clear()
    this.messageQueues.clear()

    liveLog('websocket', null, '✅ WebSocket Connection Manager shutdown complete')
  }
}

// Global connection manager instance
export const connectionManager = new WebSocketConnectionManager()