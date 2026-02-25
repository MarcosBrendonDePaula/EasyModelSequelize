/**
 * Server Configuration
 * Server-specific settings (port, host, CORS, middleware)
 */

import { defineConfig, defineNestedConfig, config } from '@core/utils/config-schema'

/**
 * CORS configuration schema
 */
const corsSchema = {
  origins: config.array('CORS_ORIGINS', ['http://localhost:3000', 'http://localhost:5173']),
  methods: config.array('CORS_METHODS', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
  headers: config.array('CORS_HEADERS', ['Content-Type', 'Authorization']),
  credentials: config.boolean('CORS_CREDENTIALS', false),
  maxAge: config.number('CORS_MAX_AGE', 86400)
} as const

/**
 * Server configuration schema
 */
const serverSchema = {
  // Server basics
  port: {
    type: 'number' as const,
    env: 'PORT',
    default: 3000,
    required: true,
    validate: (value: number) => {
      if (value < 1 || value > 65535) {
        return 'Port must be between 1 and 65535'
      }
      return true
    }
  },

  host: config.string('HOST', 'localhost', true),

  apiPrefix: {
    type: 'string' as const,
    env: 'API_PREFIX',
    default: '/api',
    validate: (value: string) => value.startsWith('/') || 'API prefix must start with /'
  },

  // Backend-only mode
  backendPort: config.number('BACKEND_PORT', 3001),

  // Features
  enableRequestLogging: config.boolean('ENABLE_REQUEST_LOGGING', true),
  showBanner: config.boolean('SHOW_SERVER_BANNER', true)
} as const

/**
 * Export server config (nested with CORS)
 */
export const serverConfig = defineNestedConfig({
  server: serverSchema,
  cors: corsSchema
})

// Export types
export type ServerConfig = typeof serverConfig.server
export type CorsConfig = typeof serverConfig.cors
export type ServerFullConfig = typeof serverConfig

// Export default
export default serverConfig
