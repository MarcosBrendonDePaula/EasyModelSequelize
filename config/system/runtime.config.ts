/**
 * Runtime-Reloadable Configuration
 * Configs that can be reloaded without server restart
 */

import { defineReactiveConfig, config } from '@core/utils/config-schema'

/**
 * Runtime app configuration
 * Can be reloaded via appRuntimeConfig.reload()
 */
export const appRuntimeConfig = defineReactiveConfig({
  // Features that can be toggled in runtime
  enableSwagger: config.boolean('ENABLE_SWAGGER', true),
  enableMetrics: config.boolean('ENABLE_METRICS', false),
  enableMonitoring: config.boolean('ENABLE_MONITORING', false),
  enableDebugMode: config.boolean('DEBUG', false),

  // Live Component Debugger
  // Defaults to false — opt-in via DEBUG_LIVE=true
  debugLive: config.boolean('DEBUG_LIVE', false),

  // Rate limiting
  rateLimitEnabled: config.boolean('RATE_LIMIT_ENABLED', true),

  rateLimitMax: {
    type: 'number' as const,
    env: 'RATE_LIMIT_MAX',
    default: 100,
    validate: (value: number) => value > 0 || 'Rate limit must be positive'
  },

  rateLimitWindow: {
    type: 'number' as const,
    env: 'RATE_LIMIT_WINDOW',
    default: 60000,
    description: 'Rate limit window in milliseconds'
  },

  // Request timeout
  requestTimeout: {
    type: 'number' as const,
    env: 'REQUEST_TIMEOUT',
    default: 30000,
    validate: (value: number) => value > 0 || 'Timeout must be positive'
  },

  // Max upload size
  maxUploadSize: {
    type: 'number' as const,
    env: 'MAX_UPLOAD_SIZE',
    default: 10485760, // 10MB
    validate: (value: number) => value > 0 || 'Max upload size must be positive'
  },

  // Maintenance mode
  maintenanceMode: config.boolean('MAINTENANCE_MODE', false),

  maintenanceMessage: config.string(
    'MAINTENANCE_MESSAGE',
    'System is under maintenance. Please try again later.'
  )
})

/**
 * Setup config watcher with logging
 */
appRuntimeConfig.watch((newConfig) => {
  console.log('🔄 Runtime config reloaded:')
  console.log('   Debug:', newConfig.enableDebugMode)
  console.log('   Maintenance:', newConfig.maintenanceMode)
})

/**
 * Export type
 */
export type AppRuntimeConfig = typeof appRuntimeConfig.values

export default appRuntimeConfig
