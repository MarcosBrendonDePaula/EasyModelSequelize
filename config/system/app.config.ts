/**
 * Application Configuration
 * Core application settings and metadata
 */

import { defineConfig, config } from '@core/utils/config-schema'

/**
 * App configuration schema
 */
export const appConfig = defineConfig({
  // Application metadata
  name: config.string('APP_NAME', 'fluxstack-app', true),
  version: config.string('APP_VERSION', '1.0.0', true),
  description: config.string('APP_DESCRIPTION', 'A FluxStack application', false),
  env: config.enum('NODE_ENV', ['development', 'production', 'test'] as const, 'development', false),

  // Runtime mode (set by CLI: --backend-only, --frontend-only)
  mode: config.enum('FLUXSTACK_MODE', ['full-stack', 'backend-only', 'frontend-only'] as const, 'full-stack', false),

  // Security
  trustProxy: config.boolean('APP_TRUST_PROXY', false),
  sessionSecret: config.string('APP_SESSION_SECRET', '')
})

// Export type
export type AppConfig = typeof appConfig

export default appConfig
