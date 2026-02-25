/**
 * Crypto Auth Plugin Configuration
 * Declarative config using FluxStack config system
 */

import { defineConfig, config } from '@core/utils/config-schema'

const cryptoAuthConfigSchema = {
  // Enable/disable plugin
  enabled: config.boolean('CRYPTO_AUTH_ENABLED', true),

  // Security settings
  maxTimeDrift: config.number('CRYPTO_AUTH_MAX_TIME_DRIFT', 300000, false), // 5 minutes in ms

  // Admin keys (array of public keys in hex format)
  adminKeys: config.array('CRYPTO_AUTH_ADMIN_KEYS', []),

  // Metrics and monitoring
  enableMetrics: config.boolean('CRYPTO_AUTH_ENABLE_METRICS', true),

  // Session configuration (for future features)
  sessionTimeout: config.number('CRYPTO_AUTH_SESSION_TIMEOUT', 1800000, false), // 30 minutes

  // Nonce configuration
  nonceLength: config.number('CRYPTO_AUTH_NONCE_LENGTH', 16, false), // bytes

  // Rate limiting (requests per minute per public key)
  rateLimitPerMinute: config.number('CRYPTO_AUTH_RATE_LIMIT', 100, false),
} as const

export const cryptoAuthConfig = defineConfig(cryptoAuthConfigSchema)

export type CryptoAuthConfig = typeof cryptoAuthConfig
export default cryptoAuthConfig
