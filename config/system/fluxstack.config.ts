/**
 * FluxStack Main Configuration
 * Composes all modular system configs into a single unified configuration
 *
 * ✨ 100% modular and type-safe using defineConfig
 * ✨ No composer needed - direct config composition
 * ✨ All configs use defineConfig for automatic validation and inference
 */

import { appConfig } from './app.config'
import { serverConfig } from './server.config'
import { clientConfig } from './client.config'
import { buildConfig } from './build.config'
import { loggerConfig } from './logger.config'
import { pluginsConfig } from './plugins.config'
import { monitoringConfig } from './monitoring.config'
import { appRuntimeConfig } from './runtime.config'
import { systemConfig } from './system.config'
import { databaseConfig } from './database.config'
import { servicesConfig } from './services.config'

const serverWithCors = {
  ...serverConfig.server,
  cors: {
    origins: serverConfig.cors.origins,
    methods: serverConfig.cors.methods,
    headers: serverConfig.cors.headers,
    credentials: serverConfig.cors.credentials,
    maxAge: serverConfig.cors.maxAge
  }
}

const client = {
  port: clientConfig.vite.port,
  host: clientConfig.vite.host,
  build: {
    ...clientConfig.build,
    sourceMaps: true
  }
}

const monitoring = {
  ...monitoringConfig.monitoring,
  metrics: monitoringConfig.metrics,
  profiling: monitoringConfig.profiling
}

const environments = {
  development: {
    logging: { level: 'debug', format: 'pretty' },
    build: { optimization: { ...buildConfig.optimization, minify: false } }
  },
  production: {
    logging: { level: 'warn', format: 'json' },
    monitoring: { enabled: true }
  },
  test: {
    logging: { level: 'error', format: 'pretty' },
    server: { port: 0 },
    client: { port: 0 }
  }
}

/**
 * FluxStack complete configuration
 * Direct composition of all modular configs
 */
export const fluxStackConfig = {
  // Core system configs
  app: appConfig,
  server: serverWithCors,
  client,
  build: {
    ...buildConfig.build,
    optimization: {
      ...buildConfig.optimization,
      minify: true
    }
  },

  // CORS (from server)
  cors: serverConfig.cors,

  // Client Build (from client)
  clientBuild: clientConfig.build,

  // Build optimization
  optimization: buildConfig.optimization,

  // Logging, plugins, monitoring
  logging: loggerConfig,
  plugins: pluginsConfig,
  monitoring,

  // Runtime & system
  runtime: appRuntimeConfig.values,
  system: systemConfig,
  database: databaseConfig,
  services: servicesConfig,

  // Environment defaults (backward compatibility)
  environments
} as const

/**
 * Type for the complete FluxStack configuration
 */
export type FluxStackConfig = typeof fluxStackConfig

/**
 * Named exports
 */
export default fluxStackConfig
export { fluxStackConfig as config }
