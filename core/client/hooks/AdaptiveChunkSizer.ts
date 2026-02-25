// 🚀 Adaptive Chunk Sizing - Dynamic chunk size adjustment based on connection speed
// Automatically optimizes upload speed by adjusting chunk sizes

export interface AdaptiveChunkConfig {
  minChunkSize: number      // Minimum chunk size (default: 16KB)
  maxChunkSize: number      // Maximum chunk size (default: 1MB)
  initialChunkSize: number  // Starting chunk size (default: 64KB)
  targetLatency: number     // Target latency per chunk in ms (default: 200ms)
  adjustmentFactor: number  // How aggressively to adjust (default: 1.5)
  measurementWindow: number // Number of chunks to measure (default: 3)
}

export interface ChunkMetrics {
  chunkIndex: number
  chunkSize: number
  startTime: number
  endTime: number
  latency: number
  throughput: number // bytes per second
  success: boolean
}

export class AdaptiveChunkSizer {
  private config: Required<AdaptiveChunkConfig>
  private currentChunkSize: number
  private metrics: ChunkMetrics[] = []
  private consecutiveErrors = 0
  private consecutiveSuccesses = 0

  constructor(config: Partial<AdaptiveChunkConfig> = {}) {
    this.config = {
      minChunkSize: config.minChunkSize ?? 16 * 1024,      // 16KB
      maxChunkSize: config.maxChunkSize ?? 1024 * 1024,    // 1MB
      initialChunkSize: config.initialChunkSize ?? 64 * 1024, // 64KB
      targetLatency: config.targetLatency ?? 200,          // 200ms
      adjustmentFactor: config.adjustmentFactor ?? 1.5,
      measurementWindow: config.measurementWindow ?? 3
    }

    this.currentChunkSize = this.config.initialChunkSize
  }

  /**
   * Get the current optimal chunk size
   */
  getChunkSize(): number {
    return this.currentChunkSize
  }

  /**
   * Record the start of a chunk upload
   */
  recordChunkStart(chunkIndex: number): number {
    return Date.now()
  }

  /**
   * Record the completion of a chunk upload and adjust chunk size
   */
  recordChunkComplete(
    chunkIndex: number,
    chunkSize: number,
    startTime: number,
    success: boolean
  ): void {
    const endTime = Date.now()
    const latency = endTime - startTime
    const throughput = success ? (chunkSize / latency) * 1000 : 0 // bytes per second

    const metric: ChunkMetrics = {
      chunkIndex,
      chunkSize,
      startTime,
      endTime,
      latency,
      throughput,
      success
    }

    this.metrics.push(metric)

    // Keep only recent measurements
    if (this.metrics.length > this.config.measurementWindow * 2) {
      this.metrics = this.metrics.slice(-this.config.measurementWindow * 2)
    }

    if (success) {
      this.consecutiveSuccesses++
      this.consecutiveErrors = 0
      this.adjustChunkSizeUp(latency)
    } else {
      this.consecutiveErrors++
      this.consecutiveSuccesses = 0
      this.adjustChunkSizeDown()
    }

    console.log(`📊 Adaptive Chunk Stats:`, {
      chunkIndex,
      currentSize: this.formatBytes(this.currentChunkSize),
      latency: `${latency}ms`,
      throughput: `${this.formatBytes(throughput)}/s`,
      avgThroughput: `${this.formatBytes(this.getAverageThroughput())}/s`,
      success
    })
  }

  /**
   * Increase chunk size if connection is fast
   */
  private adjustChunkSizeUp(latency: number): void {
    // Only increase if we have enough successful measurements
    if (this.consecutiveSuccesses < 2) return

    // Only increase if latency is below target
    if (latency > this.config.targetLatency) return

    // Calculate new chunk size based on how much faster we are than target
    const latencyRatio = this.config.targetLatency / latency
    let newSize = Math.floor(this.currentChunkSize * Math.min(latencyRatio, this.config.adjustmentFactor))

    // Cap at max chunk size
    newSize = Math.min(newSize, this.config.maxChunkSize)

    if (newSize > this.currentChunkSize) {
      console.log(`⬆️ Increasing chunk size: ${this.formatBytes(this.currentChunkSize)} → ${this.formatBytes(newSize)}`)
      this.currentChunkSize = newSize
    }
  }

  /**
   * Decrease chunk size if connection is slow or unstable
   */
  private adjustChunkSizeDown(): void {
    // Decrease more aggressively on errors
    const decreaseFactor = this.consecutiveErrors > 1 ? 2 : this.config.adjustmentFactor

    let newSize = Math.floor(this.currentChunkSize / decreaseFactor)

    // Cap at min chunk size
    newSize = Math.max(newSize, this.config.minChunkSize)

    if (newSize < this.currentChunkSize) {
      console.log(`⬇️ Decreasing chunk size: ${this.formatBytes(this.currentChunkSize)} → ${this.formatBytes(newSize)}`)
      this.currentChunkSize = newSize
    }
  }

  /**
   * Get average throughput from recent measurements
   */
  getAverageThroughput(): number {
    if (this.metrics.length === 0) return 0

    const recentMetrics = this.metrics
      .slice(-this.config.measurementWindow)
      .filter(m => m.success)

    if (recentMetrics.length === 0) return 0

    const totalThroughput = recentMetrics.reduce((sum, m) => sum + m.throughput, 0)
    return totalThroughput / recentMetrics.length
  }

  /**
   * Get average latency from recent measurements
   */
  getAverageLatency(): number {
    if (this.metrics.length === 0) return 0

    const recentMetrics = this.metrics
      .slice(-this.config.measurementWindow)
      .filter(m => m.success)

    if (recentMetrics.length === 0) return 0

    const totalLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0)
    return totalLatency / recentMetrics.length
  }

  /**
   * Get current performance statistics
   */
  getStats() {
    return {
      currentChunkSize: this.currentChunkSize,
      averageThroughput: this.getAverageThroughput(),
      averageLatency: this.getAverageLatency(),
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveErrors: this.consecutiveErrors,
      totalMeasurements: this.metrics.length,
      config: this.config
    }
  }

  /**
   * Reset the adaptive chunking state
   */
  reset(): void {
    this.currentChunkSize = this.config.initialChunkSize
    this.metrics = []
    this.consecutiveErrors = 0
    this.consecutiveSuccesses = 0
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }
}
