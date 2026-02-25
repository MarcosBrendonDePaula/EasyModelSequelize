export interface Metric {
  name: string
  type: 'counter' | 'gauge' | 'histogram'
  help: string
  labels?: string[]
  value?: number
  values?: number[]
}

export interface Counter extends Metric {
  type: 'counter'
  inc(value?: number, labels?: Record<string, string>): void
}

export interface Gauge extends Metric {
  type: 'gauge'
  set(value: number, labels?: Record<string, string>): void
  inc(value?: number, labels?: Record<string, string>): void
  dec(value?: number, labels?: Record<string, string>): void
}

export interface Histogram extends Metric {
  type: 'histogram'
  observe(value: number, labels?: Record<string, string>): void
  buckets: number[]
}

export interface SystemMetrics {
  memoryUsage: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  }
  cpuUsage: {
    user: number
    system: number
  }
  eventLoopLag: number
  uptime: number
}

export interface HttpMetrics {
  requestsTotal: number
  requestDuration: number[]
  requestSize: number[]
  responseSize: number[]
  errorRate: number
}

export class MetricsCollector {
  private metrics: Map<string, Metric> = new Map()
  private httpMetrics: HttpMetrics = {
    requestsTotal: 0,
    requestDuration: [],
    requestSize: [],
    responseSize: [],
    errorRate: 0
  }

  // Create metrics
  createCounter(name: string, help: string, labels?: string[]): Counter {
    const counter: Counter = {
      name,
      type: 'counter',
      help,
      labels,
      value: 0,
      inc: (value = 1, _labels) => {
        counter.value = (counter.value || 0) + value
      }
    }
    
    this.metrics.set(name, counter)
    return counter
  }

  createGauge(name: string, help: string, labels?: string[]): Gauge {
    const gauge: Gauge = {
      name,
      type: 'gauge',
      help,
      labels,
      value: 0,
      set: (value, _labels) => {
        gauge.value = value
      },
      inc: (value = 1, _labels) => {
        gauge.value = (gauge.value || 0) + value
      },
      dec: (value = 1, _labels) => {
        gauge.value = (gauge.value || 0) - value
      }
    }
    
    this.metrics.set(name, gauge)
    return gauge
  }

  createHistogram(name: string, help: string, buckets: number[] = [0.1, 0.5, 1, 2.5, 5, 10]): Histogram {
    const histogram: Histogram = {
      name,
      type: 'histogram',
      help,
      buckets,
      values: [],
      observe: (value, _labels) => {
        histogram.values = histogram.values || []
        histogram.values.push(value)
      }
    }
    
    this.metrics.set(name, histogram)
    return histogram
  }

  // HTTP metrics
  recordHttpRequest(_method: string, _path: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number): void {
    this.httpMetrics.requestsTotal++
    this.httpMetrics.requestDuration.push(duration)
    
    if (requestSize) {
      this.httpMetrics.requestSize.push(requestSize)
    }
    
    if (responseSize) {
      this.httpMetrics.responseSize.push(responseSize)
    }
    
    if (statusCode >= 400) {
      this.httpMetrics.errorRate = this.calculateErrorRate()
    }
  }

  // System metrics
  getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    return {
      memoryUsage: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      eventLoopLag: this.measureEventLoopLag(),
      uptime: process.uptime()
    }
  }

  // Get all metrics
  getAllMetrics(): Map<string, Metric> {
    return new Map(this.metrics)
  }

  getHttpMetrics(): HttpMetrics {
    return { ...this.httpMetrics }
  }

  // Export metrics in Prometheus format
  exportPrometheus(): string {
    let output = ''
    
    for (const metric of this.metrics.values()) {
      output += `# HELP ${metric.name} ${metric.help}\n`
      output += `# TYPE ${metric.name} ${metric.type}\n`
      
      if (metric.type === 'counter' || metric.type === 'gauge') {
        output += `${metric.name} ${metric.value || 0}\n`
      } else if (metric.type === 'histogram' && metric.values) {
        const values = metric.values.sort((a, b) => a - b)
        const buckets = (metric as Histogram).buckets
        
        for (const bucket of buckets) {
          const count = values.filter(v => v <= bucket).length
          output += `${metric.name}_bucket{le="${bucket}"} ${count}\n`
        }
        
        output += `${metric.name}_bucket{le="+Inf"} ${values.length}\n`
        output += `${metric.name}_count ${values.length}\n`
        output += `${metric.name}_sum ${values.reduce((sum, v) => sum + v, 0)}\n`
      }
      
      output += '\n'
    }
    
    return output
  }

  private calculateErrorRate(): number {
    const totalRequests = this.httpMetrics.requestsTotal
    if (totalRequests === 0) return 0
    
    // This is a simplified calculation - in a real implementation,
    // you'd track error counts separately
    return 0 // Placeholder
  }

  private measureEventLoopLag(): number {
    const start = process.hrtime.bigint()
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6 // Convert to milliseconds
      return lag
    })
    return 0 // Placeholder - actual implementation would be more complex
  }
}