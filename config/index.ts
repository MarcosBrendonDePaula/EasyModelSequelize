/**
 * ⚡ FluxStack Configuration Index
 *
 * Centralized configuration using Laravel-style declarative schemas
 *
 * @example
 * ```ts
 * import { appConfig, serverConfig, databaseConfig } from '@config'
 *
 * // All configs are type-safe and validated!
 * console.log(appConfig.name)                    // string
 * console.log(serverConfig.server.port)          // number
 * console.log(clientConfig.vite.port)            // number
 *
 * // Nested configs
 * console.log(servicesConfig.email.host)         // string
 * console.log(monitoringConfig.metrics.enabled)  // boolean
 * ```
 *
 * ✨ For type safety with optional features (database, auth, email, storage):
 * Import types from this file instead of core:
 * ```ts
 * import type { DatabaseConfig, JWTConfig, EmailConfig, StorageConfig } from '@config'
 * ```
 */

// ============================================================================
// 📦 CONFIG EXPORTS
// ============================================================================

// System configs (from config/system/)
export { appConfig } from './system/app.config'
export { serverConfig } from './system/server.config'
export { clientConfig } from './system/client.config'
export { buildConfig } from './system/build.config'
export { loggerConfig } from './system/logger.config'
export { pluginsConfig } from './system/plugins.config'
export { monitoringConfig } from './system/monitoring.config'
export { appRuntimeConfig } from './system/runtime.config'
export { systemConfig, systemRuntimeInfo } from './system/system.config'
export { databaseConfig } from './system/database.config'
export { servicesConfig } from './system/services.config'
export { authConfig } from './system/auth.config'
export { sessionConfig } from './system/session.config'

// Main FluxStack config (composed)
export { fluxStackConfig, config as fluxConfig, type FluxStackConfig } from './fluxstack.config'

// Plugin configs (re-exported for convenience)
export { cryptoAuthConfig } from '../plugins/crypto-auth/config'

// ============================================================================
// 📝 TYPE EXPORTS
// ============================================================================

// System config types
export type { AppConfig } from './system/app.config'
export type {
  ServerConfig,
  CorsConfig,
  ServerFullConfig
} from './system/server.config'
export type {
  ClientConfig,
  ViteConfig,
  ClientBuildConfig
} from './system/client.config'
export type {
  BuildConfig,
  OptimizationConfig,
  BuildFullConfig
} from './system/build.config'
export type { LoggerConfig } from './system/logger.config'
export type { PluginsConfig } from './system/plugins.config'
export type {
  MonitoringConfig,
  MetricsConfig,
  ProfilingConfig,
  MonitoringFullConfig
} from './system/monitoring.config'
export type { SystemConfig, SystemRuntimeInfo } from './system/system.config'
export type { AppRuntimeConfig } from './system/runtime.config'
export type { DatabaseConfig } from './system/database.config'
export type { ServicesConfig } from './system/services.config'
export type { AuthConfig } from './system/auth.config'
export type { SessionConfig } from './system/session.config'

// Plugin types
export type { CryptoAuthConfig } from '../plugins/crypto-auth/config'

// ============================================================================
// 🎯 UNIFIED CONFIG OBJECT
// ============================================================================

import { appConfig } from './system/app.config'
import { serverConfig } from './system/server.config'
import { clientConfig } from './system/client.config'
import { buildConfig } from './system/build.config'
import { loggerConfig } from './system/logger.config'
import { pluginsConfig } from './system/plugins.config'
import { monitoringConfig } from './system/monitoring.config'
import { appRuntimeConfig } from './system/runtime.config'
import { systemConfig, systemRuntimeInfo } from './system/system.config'
import { databaseConfig } from './system/database.config'
import { servicesConfig } from './system/services.config'
import { authConfig } from './system/auth.config'
import { sessionConfig } from './system/session.config'
import { cryptoAuthConfig } from '../plugins/crypto-auth/config'

/**
 * All configs in one object
 * Use this when you need access to multiple configs at once
 *
 * For the complete FluxStack configuration with proper structure,
 * use `fluxStackConfig` from './fluxstack.config'
 */
export const config = {
  // System configs
  app: appConfig,
  server: serverConfig,
  client: clientConfig,
  build: buildConfig,
  logger: loggerConfig,
  plugins: pluginsConfig,
  monitoring: monitoringConfig,
  runtime: appRuntimeConfig,
  system: systemConfig,
  systemRuntime: systemRuntimeInfo,
  database: databaseConfig,
  services: servicesConfig,
  auth: authConfig,
  session: sessionConfig,

  // Plugin configs
  cryptoAuth: cryptoAuthConfig
} as const

export default config
