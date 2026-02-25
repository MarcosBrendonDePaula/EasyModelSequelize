# FluxStack Monitoring Plugin

The monitoring plugin provides comprehensive performance monitoring, metrics collection, and system monitoring for FluxStack applications.

## Features

- **HTTP Metrics**: Request/response timing, status codes, request/response sizes
- **System Metrics**: Memory usage, CPU usage, event loop lag, load average
- **Custom Metrics**: Counters, gauges, and histograms
- **Multiple Exporters**: Console, Prometheus, JSON, and file exporters
- **Alert System**: Configurable thresholds and alerts
- **Metrics Endpoint**: Built-in `/metrics` endpoint for Prometheus scraping

## Configuration

```typescript
// fluxstack.config.ts
export default {
  plugins: {
    config: {
      monitoring: {
        enabled: true,
        httpMetrics: true,
        systemMetrics: true,
        customMetrics: true,
        collectInterval: 5000, // 5 seconds
        retentionPeriod: 300000, // 5 minutes
        
        exporters: [
          {
            type: "prometheus",
            endpoint: "/metrics",
            enabled: true,
            format: "text"
          },
          {
            type: "console",
            interval: 30000,
            enabled: false
          },
          {
            type: "file",
            filePath: "./logs/metrics.json",
            interval: 60000,
            enabled: true,
            format: "json"
          }
        ],
        
        thresholds: {
          responseTime: 1000, // ms
          errorRate: 0.05, // 5%
          memoryUsage: 0.8, // 80%
          cpuUsage: 0.8 // 80%
        },
        
        alerts: [
          {
            metric: "http_request_duration_ms",
            operator: ">",
            value: 2000,
            severity: "warning",
            message: "High response time detected"
          },
          {
            metric: "process_memory_rss_bytes",
            operator: ">",
            value: 1000000000, // 1GB
            severity: "error",
            message: "High memory usage"
          }
        ]
      }
    }
  }
}
```

## Metrics Collected

### HTTP Metrics
- `http_requests_total` - Total number of HTTP requests
- `http_responses_total` - Total number of HTTP responses
- `http_errors_total` - Total number of HTTP errors
- `http_request_duration_seconds` - HTTP request duration histogram
- `http_request_size_bytes` - HTTP request size histogram
- `http_response_size_bytes` - HTTP response size histogram

### System Metrics
- `process_memory_rss_bytes` - Process resident set size
- `process_memory_heap_used_bytes` - Process heap used
- `process_memory_heap_total_bytes` - Process heap total
- `process_memory_external_bytes` - Process external memory
- `process_cpu_user_seconds_total` - Process CPU user time
- `process_cpu_system_seconds_total` - Process CPU system time
- `process_uptime_seconds` - Process uptime
- `nodejs_eventloop_lag_seconds` - Node.js event loop lag
- `system_memory_total_bytes` - System total memory
- `system_memory_free_bytes` - System free memory
- `system_load_average_1m` - System load average (1 minute)

## Exporters

### Prometheus Exporter
Exports metrics in Prometheus format. Can be configured to:
- Serve metrics at `/metrics` endpoint (default)
- Push metrics to Prometheus pushgateway

### Console Exporter
Logs metrics to console at specified intervals.

### JSON Exporter
Exports metrics in JSON format to:
- HTTP endpoint (POST request)
- Console logs

### File Exporter
Writes metrics to file in JSON or Prometheus format.

## Usage

The monitoring plugin is automatically loaded and configured through the FluxStack plugin system. Once enabled, it will:

1. Start collecting system metrics at the configured interval
2. Record HTTP request/response metrics automatically
3. Export metrics according to the configured exporters
4. Monitor alert thresholds and log warnings/errors

## Accessing Metrics

### Prometheus Endpoint
Visit `http://localhost:3000/metrics` (or your configured endpoint) to see Prometheus-formatted metrics.

### Programmatic Access
```typescript
import { MetricsCollector } from 'fluxstack/core/utils/monitoring'

const collector = new MetricsCollector()

// Create custom metrics
const myCounter = collector.createCounter('my_custom_counter', 'My custom counter')
myCounter.inc(1)

const myGauge = collector.createGauge('my_custom_gauge', 'My custom gauge')
myGauge.set(42)

const myHistogram = collector.createHistogram('my_custom_histogram', 'My custom histogram')
myHistogram.observe(1.5)

// Get system metrics
const systemMetrics = collector.getSystemMetrics()
console.log('Memory usage:', systemMetrics.memoryUsage)

// Export metrics
const prometheusData = collector.exportPrometheus()
console.log(prometheusData)
```

## Alert Configuration

Alerts can be configured to monitor specific metrics and trigger notifications when thresholds are exceeded:

```typescript
alerts: [
  {
    metric: "http_request_duration_ms",
    operator: ">",
    value: 2000,
    severity: "warning",
    message: "High response time detected"
  },
  {
    metric: "process_memory_rss_bytes", 
    operator: ">",
    value: 1000000000, // 1GB
    severity: "error",
    message: "High memory usage"
  }
]
```

Supported operators: `>`, `<`, `>=`, `<=`, `==`, `!=`
Supported severities: `info`, `warning`, `error`, `critical`

## Requirements Satisfied

This monitoring plugin satisfies the following requirements:

- **7.1**: Collects basic metrics (response time, memory usage, etc.)
- **7.2**: Provides detailed performance logging with timing
- **7.3**: Identifies performance problems through thresholds and alerts
- **7.4**: Includes basic metrics dashboard via `/metrics` endpoint
- **7.5**: Supports integration with external monitoring systems (Prometheus, etc.)