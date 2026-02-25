/**
 * FluxStack Core Config
 * Re-exports configuration from @config for backward compatibility
 *
 * ✅ All configs now live in /config (modular and type-safe)
 * ✅ No more composer or schema - configs use defineConfig directly
 * ❌ DEPRECATED: Use @config directly instead of @core/config
 */

import type { FluxStackConfig } from '@config'
import { fluxStackConfig } from '@config'
import { helpers } from '../utils/env'

// ============================================================================
// 📦 TYPE RE-EXPORTS (for backward compatibility)
// ============================================================================

/**
 * @deprecated Import from @config instead
 */
export type {
  FluxStackConfig,
  AppConfig,
  ServerConfig,
  ClientConfig,
  BuildConfig,
  ViteConfig,
  ClientBuildConfig,
  OptimizationConfig,
  CorsConfig,
  LoggerConfig,
  PluginsConfig,
  MonitoringConfig
} from '@config'

// Legacy type aliases
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type BuildTarget = 'bun' | 'node' | 'docker'
export type LogFormat = 'json' | 'pretty'
export type LoggingConfig = import('@config').LoggerConfig
export type PluginConfig = import('@config').PluginsConfig

// ============================================================================
// 🚀 CONFIG LOADING FUNCTIONS (for backward compatibility)
// ============================================================================

/**
 * Get FluxStack configuration synchronously
 * @deprecated Use `import { fluxStackConfig } from '@config'` instead
 *
 * @example
 * ```ts
 * // ❌ Old way:
 * import { getConfigSync } from '@core/config'
 * const config = getConfigSync()
 *
 * // ✅ New way:
 * import { fluxStackConfig } from '@config'
 * console.log(fluxStackConfig.app.name)
 * ```
 */
export function getConfigSync(): FluxStackConfig {
  return fluxStackConfig
}

/**
 * Get FluxStack configuration asynchronously
 * @deprecated Use `import { fluxStackConfig } from '@config'` instead
 */
export async function getConfig(): Promise<FluxStackConfig> {
  return fluxStackConfig
}

// ============================================================================
// 🌍 ENVIRONMENT UTILITIES
// ============================================================================

/**
 * Get environment information
 * Used by core framework to set up context
 */
export function getEnvironmentInfo() {
  const getName = () => {
    if (helpers.isDevelopment()) return 'development'
    if (helpers.isProduction()) return 'production'
    if (helpers.isTest()) return 'test'
    return 'development'
  }

  return {
    name: getName(),
    isDevelopment: helpers.isDevelopment(),
    isProduction: helpers.isProduction(),
    isTest: helpers.isTest()
  }
}
