/**
 * FluxStack Configuration - Main Entry Point
 * Re-exports the complete FluxStack configuration from system/
 *
 * ✨ 100% modular configuration using defineConfig
 * ✨ No composer needed - direct config composition
 * ✨ All configs are type-safe with automatic validation
 *
 * To customize configuration, edit the individual config files:
 * - system/app.config.ts - Application metadata
 * - system/server.config.ts - Server and CORS settings
 * - system/client.config.ts - Vite, proxy, and client build
 * - system/build.config.ts - Server build and optimization
 * - system/logger.config.ts - Logging configuration
 * - system/plugins.config.ts - Plugin management
 * - system/monitoring.config.ts - Monitoring and metrics
 * - system/runtime.config.ts - Runtime-reloadable settings
 * - system/system.config.ts - System information
 * - database.config.ts - Database connection (optional)
 * - services.config.ts - JWT, Email, Storage (optional)
 */

export {
  fluxStackConfig,
  fluxStackConfig as config,
  fluxStackConfig as default,
  type FluxStackConfig
} from './system/fluxstack.config'