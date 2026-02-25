// 📊 FluxStack Live Component Performance Monitor
// Advanced performance monitoring, metrics collection, and optimization suggestions

import { EventEmitter } from 'events'
import { liveLog, liveWarn } from './LiveLogger'

export interface PerformanceMetrics {
  componentId: string
  componentName: string
  renderMetrics: RenderMetrics
  actionMetrics: ActionMetrics
  memoryMetrics: MemoryMetrics
  networkMetrics: NetworkMetrics
  userInteractionMetrics: UserInteractionMetrics
  timestamp: Date
}

export interface RenderMetrics {
  totalRenders: number
  averageRenderTime: number
  minRenderTime: number
  maxRenderTime: number
  lastRenderTime: number
  renderTimeHistory: number[]
  slowRenderCount: number // renders > threshold
  renderErrorCount: number
}

export interface ActionMetrics {
  totalActions: number
  averageActionTime: number
  minActionTime: number
  maxActionTime: number
  actionsByType: Record<string, ActionTypeMetrics>
  failedActions: number
  timeoutActions: number
}

export interface ActionTypeMetrics {
  count: number
  averageTime: number
  minTime: number
  maxTime: number
  errorCount: number
  lastExecuted: Date
}

export interface MemoryMetrics {
  currentUsage: number // bytes
  peakUsage: number
  averageUsage: number
  memoryLeakDetected: boolean
  gcCount: number
  stateSize: number // serialized state size
  stateSizeHistory: number[]
}

export interface NetworkMetrics {
  messagesSent: number
  messagesReceived: number
  bytesTransferred: number
  averageLatency: number
  connectionDrops: number
  reconnectCount: number
  queuedMessages: number
}

export interface UserInteractionMetrics {
  clickCount: number
  inputChangeCount: number
  formSubmissions: number
  averageInteractionTime: number
  bounceRate: number // percentage of single interactions
  engagementScore: number // calculated engagement metric
}

export interface PerformanceAlert {
  id: string
  componentId: string
  type: 'warning' | 'critical'
  category: 'render' | 'action' | 'memory' | 'network' | 'interaction'
  message: string
  threshold: number
  currentValue: number
  timestamp: Date
  resolved: boolean
}

export interface OptimizationSuggestion {
  id: string
  componentId: string
  type: 'render' | 'memory' | 'network' | 'state' | 'action'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  impact: string
  implementation: string
  estimatedImprovement: string
  timestamp: Date
}

export interface PerformanceDashboard {
  overview: {
    totalComponents: number
    healthyComponents: number
    degradedComponents: number
    unhealthyComponents: number
    averageRenderTime: number
    averageMemoryUsage: number
    totalAlerts: number
    criticalAlerts: number
  }
  topPerformers: PerformanceMetrics[]
  worstPerformers: PerformanceMetrics[]
  recentAlerts: PerformanceAlert[]
  suggestions: OptimizationSuggestion[]
  trends: {
    renderTimetrend: number[] // last 24 hours
    memoryUsageTrend: number[]
    actionTimeTrend: number[]
  }
}

export interface MonitoringConfig {
  enabled: boolean
  sampleRate: number // 0-1, percentage of operations to monitor
  renderTimeThreshold: number // ms
  memoryThreshold: number // bytes
  actionTimeThreshold: number // ms
  alertCooldown: number // ms between same type alerts
  historyRetention: number // ms to keep historical data
  dashboardUpdateInterval: number // ms
}

export class LiveComponentPerformanceMonitor extends EventEmitter {
  private metrics = new Map<string, PerformanceMetrics>()
  private alerts = new Map<string, PerformanceAlert[]>() // componentId -> alerts
  private suggestions = new Map<string, OptimizationSuggestion[]>()
  private config: MonitoringConfig
  private dashboardUpdateInterval!: NodeJS.Timeout
  private alertCooldowns = new Map<string, number>() // alertType -> lastAlertTime
  private performanceObserver?: any

  constructor(config?: Partial<MonitoringConfig>) {
    super()
    
    this.config = {
      enabled: true,
      sampleRate: 1.0, // Monitor 100% by default
      renderTimeThreshold: 100, // 100ms
      memoryThreshold: 50 * 1024 * 1024, // 50MB
      actionTimeThreshold: 1000, // 1 second
      alertCooldown: 60000, // 1 minute
      historyRetention: 24 * 60 * 60 * 1000, // 24 hours
      dashboardUpdateInterval: 30000, // 30 seconds
      ...config
    }

    if (this.config.enabled) {
      this.setupPerformanceObserver()
      this.setupDashboardUpdates()
      this.setupCleanupTasks()
    }
  }

  /**
   * Setup performance observer for native performance monitoring
   */
  private setupPerformanceObserver(): void {
    try {
      // Use Node.js performance hooks if available
      const { PerformanceObserver, performance } = require('perf_hooks')
      
      this.performanceObserver = new PerformanceObserver((list: any) => {
        const entries = list.getEntries()
        for (const entry of entries) {
          if (entry.name.startsWith('live-component-')) {
            this.processPerformanceEntry(entry)
          }
        }
      })
      
      this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] })
      // Performance observer ready (logged at DEBUG level to keep startup clean)
    } catch (error) {
      console.warn('⚠️ Performance observer not available:', error)
    }
  }

  /**
   * Process performance entry from observer
   */
  private processPerformanceEntry(entry: any): void {
    const [, componentId, operation] = entry.name.split('-')
    
    if (operation === 'render') {
      this.recordRenderTime(componentId, entry.duration)
    } else if (operation === 'action') {
      this.recordActionTime(componentId, 'unknown', entry.duration)
    }
  }

  /**
   * Setup dashboard update interval
   */
  private setupDashboardUpdates(): void {
    this.dashboardUpdateInterval = setInterval(() => {
      this.updateDashboard()
    }, this.config.dashboardUpdateInterval)
  }

  /**
   * Setup cleanup tasks
   */
  private setupCleanupTasks(): void {
    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData()
    }, 60 * 60 * 1000)
  }

  /**
   * Initialize metrics for a component
   */
  initializeComponent(componentId: string, componentName: string): void {
    if (!this.config.enabled || !this.shouldSample()) return

    const metrics: PerformanceMetrics = {
      componentId,
      componentName,
      renderMetrics: {
        totalRenders: 0,
        averageRenderTime: 0,
        minRenderTime: Infinity,
        maxRenderTime: 0,
        lastRenderTime: 0,
        renderTimeHistory: [],
        slowRenderCount: 0,
        renderErrorCount: 0
      },
      actionMetrics: {
        totalActions: 0,
        averageActionTime: 0,
        minActionTime: Infinity,
        maxActionTime: 0,
        actionsByType: {},
        failedActions: 0,
        timeoutActions: 0
      },
      memoryMetrics: {
        currentUsage: 0,
        peakUsage: 0,
        averageUsage: 0,
        memoryLeakDetected: false,
        gcCount: 0,
        stateSize: 0,
        stateSizeHistory: []
      },
      networkMetrics: {
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransferred: 0,
        averageLatency: 0,
        connectionDrops: 0,
        reconnectCount: 0,
        queuedMessages: 0
      },
      userInteractionMetrics: {
        clickCount: 0,
        inputChangeCount: 0,
        formSubmissions: 0,
        averageInteractionTime: 0,
        bounceRate: 0,
        engagementScore: 0
      },
      timestamp: new Date()
    }

    this.metrics.set(componentId, metrics)
    this.alerts.set(componentId, [])
    this.suggestions.set(componentId, [])

    liveLog('performance', componentId, `📊 Performance monitoring initialized for component: ${componentId}`)
  }

  /**
   * Record render performance
   */
  recordRenderTime(componentId: string, renderTime: number, error?: Error): void {
    if (!this.config.enabled || !this.shouldSample()) return

    const metrics = this.metrics.get(componentId)
    if (!metrics) return

    const renderMetrics = metrics.renderMetrics

    if (error) {
      renderMetrics.renderErrorCount++
      this.createAlert(componentId, 'warning', 'render', `Render error: ${error.message}`, 0, 1)
      return
    }

    // Update render metrics
    renderMetrics.totalRenders++
    renderMetrics.lastRenderTime = renderTime
    renderMetrics.minRenderTime = Math.min(renderMetrics.minRenderTime, renderTime)
    renderMetrics.maxRenderTime = Math.max(renderMetrics.maxRenderTime, renderTime)
    
    // Update average
    renderMetrics.averageRenderTime = 
      (renderMetrics.averageRenderTime * (renderMetrics.totalRenders - 1) + renderTime) / renderMetrics.totalRenders

    // Track history (keep last 100 renders)
    renderMetrics.renderTimeHistory.push(renderTime)
    if (renderMetrics.renderTimeHistory.length > 100) {
      renderMetrics.renderTimeHistory.shift()
    }

    // Check for slow renders
    if (renderTime > this.config.renderTimeThreshold) {
      renderMetrics.slowRenderCount++
      
      if (renderTime > this.config.renderTimeThreshold * 2) {
        this.createAlert(componentId, 'warning', 'render', 
          `Slow render detected: ${renderTime.toFixed(2)}ms`, 
          this.config.renderTimeThreshold, renderTime)
      }
    }

    // Generate optimization suggestions
    this.analyzeRenderPerformance(componentId, metrics)

    metrics.timestamp = new Date()
  }

  /**
   * Record action performance
   */
  recordActionTime(componentId: string, actionName: string, actionTime: number, error?: Error): void {
    if (!this.config.enabled || !this.shouldSample()) return

    const metrics = this.metrics.get(componentId)
    if (!metrics) return

    const actionMetrics = metrics.actionMetrics

    if (error) {
      actionMetrics.failedActions++
      this.createAlert(componentId, 'warning', 'action', 
        `Action failed: ${actionName} - ${error.message}`, 0, 1)
      return
    }

    // Update overall action metrics
    actionMetrics.totalActions++
    actionMetrics.minActionTime = Math.min(actionMetrics.minActionTime, actionTime)
    actionMetrics.maxActionTime = Math.max(actionMetrics.maxActionTime, actionTime)
    actionMetrics.averageActionTime = 
      (actionMetrics.averageActionTime * (actionMetrics.totalActions - 1) + actionTime) / actionMetrics.totalActions

    // Update action type metrics
    if (!actionMetrics.actionsByType[actionName]) {
      actionMetrics.actionsByType[actionName] = {
        count: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errorCount: 0,
        lastExecuted: new Date()
      }
    }

    const typeMetrics = actionMetrics.actionsByType[actionName]
    typeMetrics.count++
    typeMetrics.minTime = Math.min(typeMetrics.minTime, actionTime)
    typeMetrics.maxTime = Math.max(typeMetrics.maxTime, actionTime)
    typeMetrics.averageTime = 
      (typeMetrics.averageTime * (typeMetrics.count - 1) + actionTime) / typeMetrics.count
    typeMetrics.lastExecuted = new Date()

    // Check for slow actions
    if (actionTime > this.config.actionTimeThreshold) {
      this.createAlert(componentId, 'warning', 'action', 
        `Slow action detected: ${actionName} took ${actionTime.toFixed(2)}ms`, 
        this.config.actionTimeThreshold, actionTime)
    }

    // Generate optimization suggestions
    this.analyzeActionPerformance(componentId, actionName, metrics)

    metrics.timestamp = new Date()
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(componentId: string, memoryUsage: number, stateSize?: number): void {
    if (!this.config.enabled || !this.shouldSample()) return

    const metrics = this.metrics.get(componentId)
    if (!metrics) return

    const memoryMetrics = metrics.memoryMetrics

    // Update memory metrics
    memoryMetrics.currentUsage = memoryUsage
    memoryMetrics.peakUsage = Math.max(memoryMetrics.peakUsage, memoryUsage)
    
    // Calculate average (simple moving average)
    const sampleCount = Math.min(100, memoryMetrics.gcCount + 1)
    memoryMetrics.averageUsage = 
      (memoryMetrics.averageUsage * (sampleCount - 1) + memoryUsage) / sampleCount

    if (stateSize !== undefined) {
      memoryMetrics.stateSize = stateSize
      memoryMetrics.stateSizeHistory.push(stateSize)
      
      // Keep last 100 state sizes
      if (memoryMetrics.stateSizeHistory.length > 100) {
        memoryMetrics.stateSizeHistory.shift()
      }
    }

    // Check for memory issues
    if (memoryUsage > this.config.memoryThreshold) {
      this.createAlert(componentId, 'critical', 'memory', 
        `High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`, 
        this.config.memoryThreshold, memoryUsage)
    }

    // Detect memory leaks (increasing trend over time)
    if (memoryMetrics.stateSizeHistory.length >= 10) {
      const recentSizes = memoryMetrics.stateSizeHistory.slice(-10)
      const trend = this.calculateTrend(recentSizes)
      
      if (trend > 0.1) { // 10% increase trend
        memoryMetrics.memoryLeakDetected = true
        this.createAlert(componentId, 'critical', 'memory', 
          'Potential memory leak detected - state size increasing', 0, trend)
      }
    }

    // Generate optimization suggestions
    this.analyzeMemoryPerformance(componentId, metrics)

    metrics.timestamp = new Date()
  }

  /**
   * Record network metrics
   */
  recordNetworkActivity(componentId: string, type: 'sent' | 'received', bytes: number, latency?: number): void {
    if (!this.config.enabled || !this.shouldSample()) return

    const metrics = this.metrics.get(componentId)
    if (!metrics) return

    const networkMetrics = metrics.networkMetrics

    if (type === 'sent') {
      networkMetrics.messagesSent++
    } else {
      networkMetrics.messagesReceived++
    }

    networkMetrics.bytesTransferred += bytes

    if (latency !== undefined) {
      const totalMessages = networkMetrics.messagesSent + networkMetrics.messagesReceived
      networkMetrics.averageLatency = 
        (networkMetrics.averageLatency * (totalMessages - 1) + latency) / totalMessages
    }

    metrics.timestamp = new Date()
  }

  /**
   * Record user interaction
   */
  recordUserInteraction(componentId: string, type: 'click' | 'input' | 'submit', interactionTime?: number): void {
    if (!this.config.enabled || !this.shouldSample()) return

    const metrics = this.metrics.get(componentId)
    if (!metrics) return

    const interactionMetrics = metrics.userInteractionMetrics

    switch (type) {
      case 'click':
        interactionMetrics.clickCount++
        break
      case 'input':
        interactionMetrics.inputChangeCount++
        break
      case 'submit':
        interactionMetrics.formSubmissions++
        break
    }

    if (interactionTime !== undefined) {
      const totalInteractions = interactionMetrics.clickCount + 
                               interactionMetrics.inputChangeCount + 
                               interactionMetrics.formSubmissions
      
      interactionMetrics.averageInteractionTime = 
        (interactionMetrics.averageInteractionTime * (totalInteractions - 1) + interactionTime) / totalInteractions
    }

    // Calculate engagement score
    interactionMetrics.engagementScore = this.calculateEngagementScore(interactionMetrics)

    metrics.timestamp = new Date()
  }

  /**
   * Calculate engagement score based on interactions
   */
  private calculateEngagementScore(metrics: UserInteractionMetrics): number {
    const totalInteractions = metrics.clickCount + metrics.inputChangeCount + metrics.formSubmissions
    const timeWeight = Math.min(metrics.averageInteractionTime / 1000, 10) // Cap at 10 seconds
    const diversityBonus = (metrics.clickCount > 0 ? 1 : 0) + 
                          (metrics.inputChangeCount > 0 ? 1 : 0) + 
                          (metrics.formSubmissions > 0 ? 1 : 0)
    
    return Math.min(100, (totalInteractions * timeWeight * diversityBonus) / 10)
  }

  /**
   * Create performance alert
   */
  private createAlert(
    componentId: string, 
    type: 'warning' | 'critical', 
    category: 'render' | 'action' | 'memory' | 'network' | 'interaction',
    message: string,
    threshold: number,
    currentValue: number
  ): void {
    const alertKey = `${componentId}-${category}-${type}`
    const now = Date.now()
    
    // Check cooldown
    const lastAlert = this.alertCooldowns.get(alertKey)
    if (lastAlert && (now - lastAlert) < this.config.alertCooldown) {
      return
    }

    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      componentId,
      type,
      category,
      message,
      threshold,
      currentValue,
      timestamp: new Date(),
      resolved: false
    }

    const componentAlerts = this.alerts.get(componentId) || []
    componentAlerts.push(alert)
    this.alerts.set(componentId, componentAlerts)

    this.alertCooldowns.set(alertKey, now)

    liveWarn('performance', componentId, `⚠️ Performance alert [${type}]: ${message}`)
    this.emit('performanceAlert', alert)
  }

  /**
   * Analyze render performance and generate suggestions
   */
  private analyzeRenderPerformance(componentId: string, metrics: PerformanceMetrics): void {
    const renderMetrics = metrics.renderMetrics
    
    // Check for consistently slow renders
    if (renderMetrics.averageRenderTime > this.config.renderTimeThreshold * 0.8) {
      this.createSuggestion(componentId, 'render', 'medium', 
        'Optimize Render Performance',
        'Component renders are consistently slow. Consider optimizing state updates and reducing re-renders.',
        'Improved user experience and responsiveness',
        'Use React.memo, useMemo, or useCallback to prevent unnecessary re-renders. Optimize state structure.',
        `${((this.config.renderTimeThreshold - renderMetrics.averageRenderTime) / renderMetrics.averageRenderTime * 100).toFixed(1)}% faster renders`
      )
    }

    // Check for render time variance
    if (renderMetrics.renderTimeHistory.length >= 10) {
      const variance = this.calculateVariance(renderMetrics.renderTimeHistory)
      if (variance > renderMetrics.averageRenderTime * 0.5) {
        this.createSuggestion(componentId, 'render', 'low',
          'Reduce Render Time Variance',
          'Render times are inconsistent, which can cause jank.',
          'Smoother user experience',
          'Identify and optimize conditional rendering logic. Consider lazy loading heavy components.',
          'More consistent performance'
        )
      }
    }
  }

  /**
   * Analyze action performance and generate suggestions
   */
  private analyzeActionPerformance(componentId: string, actionName: string, metrics: PerformanceMetrics): void {
    const actionMetrics = metrics.actionMetrics
    const typeMetrics = actionMetrics.actionsByType[actionName]

    // Check for slow actions
    if (typeMetrics.averageTime > this.config.actionTimeThreshold * 0.8) {
      this.createSuggestion(componentId, 'action', 'high',
        `Optimize ${actionName} Action`,
        `The ${actionName} action is taking longer than expected to complete.`,
        'Better user experience and responsiveness',
        'Consider adding loading states, optimizing database queries, or implementing caching.',
        `${((this.config.actionTimeThreshold - typeMetrics.averageTime) / typeMetrics.averageTime * 100).toFixed(1)}% faster actions`
      )
    }

    // Check for high error rate
    const errorRate = typeMetrics.errorCount / typeMetrics.count
    if (errorRate > 0.1) { // 10% error rate
      this.createSuggestion(componentId, 'action', 'critical',
        `Fix ${actionName} Action Errors`,
        `High error rate detected for ${actionName} action (${(errorRate * 100).toFixed(1)}%).`,
        'Improved reliability and user experience',
        'Add proper error handling, input validation, and retry mechanisms.',
        `${((1 - errorRate) * 100).toFixed(1)}% success rate improvement`
      )
    }
  }

  /**
   * Analyze memory performance and generate suggestions
   */
  private analyzeMemoryPerformance(componentId: string, metrics: PerformanceMetrics): void {
    const memoryMetrics = metrics.memoryMetrics

    // Check for large state size
    if (memoryMetrics.stateSize > 100 * 1024) { // 100KB
      this.createSuggestion(componentId, 'memory', 'medium',
        'Optimize State Size',
        'Component state is larger than recommended, which can impact performance.',
        'Reduced memory usage and faster serialization',
        'Consider normalizing state structure, removing unused data, or implementing state compression.',
        `${((memoryMetrics.stateSize - 50 * 1024) / 1024).toFixed(1)}KB reduction potential`
      )
    }

    // Check for memory leak
    if (memoryMetrics.memoryLeakDetected) {
      this.createSuggestion(componentId, 'memory', 'critical',
        'Fix Memory Leak',
        'Potential memory leak detected - memory usage is continuously increasing.',
        'Prevent application crashes and improve stability',
        'Review event listeners, timers, and subscriptions for proper cleanup. Use weak references where appropriate.',
        'Stable memory usage'
      )
    }
  }

  /**
   * Create optimization suggestion
   */
  private createSuggestion(
    componentId: string,
    type: 'render' | 'memory' | 'network' | 'state' | 'action',
    priority: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    description: string,
    impact: string,
    implementation: string,
    estimatedImprovement: string
  ): void {
    const suggestions = this.suggestions.get(componentId) || []
    
    // Check if similar suggestion already exists
    const existingSuggestion = suggestions.find(s => s.title === title && !s.timestamp || 
      (Date.now() - s.timestamp.getTime()) < 24 * 60 * 60 * 1000) // 24 hours
    
    if (existingSuggestion) return

    const suggestion: OptimizationSuggestion = {
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      componentId,
      type,
      priority,
      title,
      description,
      impact,
      implementation,
      estimatedImprovement,
      timestamp: new Date()
    }

    suggestions.push(suggestion)
    this.suggestions.set(componentId, suggestions)

    liveLog('performance', componentId, `💡 Optimization suggestion for ${componentId}: ${title}`)
    this.emit('optimizationSuggestion', suggestion)
  }

  /**
   * Calculate trend from array of numbers
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0

    const n = values.length
    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((sum, val) => sum + val, 0)
    const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    return slope / (sumY / n) // Normalize by average
  }

  /**
   * Calculate variance from array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * Should sample this operation based on sample rate
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate
  }

  /**
   * Update dashboard data
   */
  private updateDashboard(): void {
    const dashboard = this.generateDashboard()
    this.emit('dashboardUpdate', dashboard)
  }

  /**
   * Generate performance dashboard
   */
  generateDashboard(): PerformanceDashboard {
    const allMetrics = Array.from(this.metrics.values())
    const allAlerts = Array.from(this.alerts.values()).flat()
    const allSuggestions = Array.from(this.suggestions.values()).flat()

    // Calculate overview stats
    const totalComponents = allMetrics.length
    const healthyComponents = allMetrics.filter(m => this.isComponentHealthy(m)).length
    const degradedComponents = allMetrics.filter(m => this.isComponentDegraded(m)).length
    const unhealthyComponents = totalComponents - healthyComponents - degradedComponents

    const averageRenderTime = allMetrics.reduce((sum, m) => sum + m.renderMetrics.averageRenderTime, 0) / totalComponents || 0
    const averageMemoryUsage = allMetrics.reduce((sum, m) => sum + m.memoryMetrics.currentUsage, 0) / totalComponents || 0

    const totalAlerts = allAlerts.filter(a => !a.resolved).length
    const criticalAlerts = allAlerts.filter(a => a.type === 'critical' && !a.resolved).length

    // Get top and worst performers
    const sortedByRender = [...allMetrics].sort((a, b) => a.renderMetrics.averageRenderTime - b.renderMetrics.averageRenderTime)
    const topPerformers = sortedByRender.slice(0, 5)
    const worstPerformers = sortedByRender.slice(-5).reverse()

    // Get recent alerts
    const recentAlerts = allAlerts
      .filter(a => !a.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)

    // Get top suggestions
    const topSuggestions = allSuggestions
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
      .slice(0, 10)

    // Generate trends (simplified - would need historical data storage for real trends)
    const renderTimeHistory = allMetrics.map(m => m.renderMetrics.averageRenderTime)
    const memoryUsageHistory = allMetrics.map(m => m.memoryMetrics.currentUsage)
    const actionTimeHistory = allMetrics.map(m => m.actionMetrics.averageActionTime)

    return {
      overview: {
        totalComponents,
        healthyComponents,
        degradedComponents,
        unhealthyComponents,
        averageRenderTime,
        averageMemoryUsage,
        totalAlerts,
        criticalAlerts
      },
      topPerformers,
      worstPerformers,
      recentAlerts,
      suggestions: topSuggestions,
      trends: {
        renderTimetrend: renderTimeHistory,
        memoryUsageTrend: memoryUsageHistory,
        actionTimeTrend: actionTimeHistory
      }
    }
  }

  /**
   * Check if component is healthy
   */
  private isComponentHealthy(metrics: PerformanceMetrics): boolean {
    return metrics.renderMetrics.averageRenderTime < this.config.renderTimeThreshold * 0.5 &&
           metrics.memoryMetrics.currentUsage < this.config.memoryThreshold * 0.5 &&
           metrics.actionMetrics.failedActions / Math.max(metrics.actionMetrics.totalActions, 1) < 0.05
  }

  /**
   * Check if component is degraded
   */
  private isComponentDegraded(metrics: PerformanceMetrics): boolean {
    return !this.isComponentHealthy(metrics) && !this.isComponentUnhealthy(metrics)
  }

  /**
   * Check if component is unhealthy
   */
  private isComponentUnhealthy(metrics: PerformanceMetrics): boolean {
    return metrics.renderMetrics.averageRenderTime > this.config.renderTimeThreshold ||
           metrics.memoryMetrics.currentUsage > this.config.memoryThreshold ||
           metrics.actionMetrics.failedActions / Math.max(metrics.actionMetrics.totalActions, 1) > 0.2 ||
           metrics.memoryMetrics.memoryLeakDetected
  }

  /**
   * Get component metrics
   */
  getComponentMetrics(componentId: string): PerformanceMetrics | null {
    return this.metrics.get(componentId) || null
  }

  /**
   * Get component alerts
   */
  getComponentAlerts(componentId: string): PerformanceAlert[] {
    return this.alerts.get(componentId) || []
  }

  /**
   * Get component suggestions
   */
  getComponentSuggestions(componentId: string): OptimizationSuggestion[] {
    return this.suggestions.get(componentId) || []
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    for (const alerts of this.alerts.values()) {
      const alert = alerts.find(a => a.id === alertId)
      if (alert) {
        alert.resolved = true
        liveLog('performance', null, `✅ Alert resolved: ${alertId}`)
        return true
      }
    }
    return false
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const now = Date.now()
    const cutoff = now - this.config.historyRetention

    // Clean up old alerts
    for (const [componentId, alerts] of this.alerts) {
      const validAlerts = alerts.filter(alert => alert.timestamp.getTime() > cutoff)
      this.alerts.set(componentId, validAlerts)
    }

    // Clean up old suggestions
    for (const [componentId, suggestions] of this.suggestions) {
      const validSuggestions = suggestions.filter(suggestion => suggestion.timestamp.getTime() > cutoff)
      this.suggestions.set(componentId, validSuggestions)
    }

    liveLog('performance', null, '🧹 Performance monitoring data cleanup completed')
  }

  /**
   * Remove component from monitoring
   */
  removeComponent(componentId: string): void {
    this.metrics.delete(componentId)
    this.alerts.delete(componentId)
    this.suggestions.delete(componentId)
    
    liveLog('performance', componentId, `📊 Performance monitoring removed for component: ${componentId}`)
  }

  /**
   * Shutdown performance monitor
   */
  shutdown(): void {
    liveLog('performance', null, '📊 Shutting down Performance Monitor...')
    
    if (this.dashboardUpdateInterval) {
      clearInterval(this.dashboardUpdateInterval)
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
    }

    this.metrics.clear()
    this.alerts.clear()
    this.suggestions.clear()
    this.alertCooldowns.clear()

    liveLog('performance', null, '✅ Performance Monitor shutdown complete')
  }
}

// Global performance monitor instance
export const performanceMonitor = new LiveComponentPerformanceMonitor()