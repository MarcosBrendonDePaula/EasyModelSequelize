/**
 * Database Configuration
 * Optional database settings for backward compatibility
 */

import { defineConfig, config } from '@core/utils/config-schema'

export const databaseConfig = defineConfig({
  url: config.string('DATABASE_URL', ''),
  provider: config.enum('DATABASE_PROVIDER', ['postgres', 'mysql', 'sqlite', 'mssql', 'mongodb'] as const, 'postgres'),
  connectionTimeout: config.number('DATABASE_CONNECTION_TIMEOUT', 5000),
  ssl: config.boolean('DATABASE_SSL', false)
})

export type DatabaseConfig = typeof databaseConfig

export default databaseConfig
