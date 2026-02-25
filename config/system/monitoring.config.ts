/**
 * Monitoring Configuration
 * Declarative monitoring, metrics and profiling configuration
 */

import { defineConfig, defineNestedConfig, config } from '@core/utils/config-schema'
import { helpers } from '@core/utils/env'

/**
 * Metrics Configuration Schema
 */
const metricsSchema = {
  enabled: config.boolean('ENABLE_METRICS', false),

  collectInterval: {
    type: 'number' as const,
    env: 'METRICS_INTERVAL',
    default: 5000,
    validate: (value: number) => {
      if (value < 1000) {
        return 'Metrics interval must be at least 1000ms'
      }
      return true
    }
  },

  httpMetrics: config.boolean('HTTP_METRICS', true),

  systemMetrics: config.boolean('SYSTEM_METRICS', true),

  customMetrics: config.boolean('CUSTOM_METRICS', false),

  // Metric exporters
  exportToConsole: config.boolean('METRICS_EXPORT_CONSOLE', helpers.isDevelopment()),

  exportToFile: config.boolean('METRICS_EXPORT_FILE', false),

  exportToHttp: config.boolean('METRICS_EXPORT_HTTP', false),

  exportHttpUrl: config.string('METRICS_EXPORT_URL'),

  // Metric storage
  retentionPeriod: config.number('METRICS_RETENTION_PERIOD', 3600000), // 1 hour in ms

  maxDataPoints: config.number('METRICS_MAX_DATA_POINTS', 1000)
} as const

/**
 * Profiling Configuration Schema
 */
const profilingSchema = {
  enabled: config.boolean('PROFILING_ENABLED', false),

  sampleRate: {
    type: 'number' as const,
    env: 'PROFILING_SAMPLE_RATE',
    default: helpers.isProduction() ? 0.01 : 0.1,
    validate: (value: number) => {
      if (value < 0 || value > 1) {
        return 'Sample rate must be between 0 and 1'
      }
      return true
    }
  },

  memoryProfiling: config.boolean('MEMORY_PROFILING', false),

  cpuProfiling: config.boolean('CPU_PROFILING', false),

  heapSnapshot: config.boolean('HEAP_SNAPSHOT', false),

  // Profiling output
  outputDir: config.string('PROFILING_OUTPUT_DIR', 'profiling'),

  maxProfiles: config.number('PROFILING_MAX_PROFILES', 10)
} as const

/**
 * Monitoring Configuration Schema
 */
const monitoringSchema = {
  enabled: config.boolean('ENABLE_MONITORING', false),

  // Exporters
  exporters: config.array('MONITORING_EXPORTERS', []),

  // Health checks
  enableHealthChecks: config.boolean('ENABLE_HEALTH_CHECKS', true),

  healthCheckInterval: config.number('HEALTH_CHECK_INTERVAL', 30000), // 30s

  // Alerting
  enableAlerts: config.boolean('ENABLE_ALERTS', false),

  alertWebhook: config.string('ALERT_WEBHOOK')
} as const

/**
 * Export monitoring config (nested)
 */
export const monitoringConfig = defineNestedConfig({
  monitoring: monitoringSchema,
  metrics: metricsSchema,
  profiling: profilingSchema
})

// Export types
export type MonitoringConfig = typeof monitoringConfig.monitoring
export type MetricsConfig = typeof monitoringConfig.metrics
export type ProfilingConfig = typeof monitoringConfig.profiling
export type MonitoringFullConfig = typeof monitoringConfig

// Export default
export default monitoringConfig
