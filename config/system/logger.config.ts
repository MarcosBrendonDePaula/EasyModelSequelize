/**
 * Logger Configuration
 * Declarative logger config using FluxStack config system
 */

import { defineConfig, config } from '@core/utils/config-schema'

export const loggerConfig = defineConfig({
  // Log level
  level: config.enum('LOG_LEVEL', ['debug', 'info', 'warn', 'error'] as const, 'info'),
  format: config.enum('LOG_FORMAT', ['pretty', 'json'] as const, 'pretty'),

  // Format settings
  dateFormat: config.string('LOG_DATE_FORMAT', 'YYYY-MM-DD HH:mm:ss'),
  objectDepth: config.number('LOG_OBJECT_DEPTH', 4),

  // File logging
  logToFile: config.boolean('LOG_TO_FILE', false),
  maxSize: config.string('LOG_MAX_SIZE', '20m'),
  maxFiles: config.string('LOG_MAX_FILES', '14d'),
  transports: config.array('LOG_TRANSPORTS', ['console']),

  // Display options
  enableColors: config.boolean('LOG_COLORS', true),
  enableStackTrace: config.boolean('LOG_STACK_TRACE', true)
})

export type LoggerConfig = typeof loggerConfig
export default loggerConfig
