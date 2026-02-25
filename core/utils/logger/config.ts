/**
 * FluxStack Logger Configuration
 * Re-export from declarative config
 */

import { loggerConfig } from '@config'

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  format: 'pretty' | 'json'
  dateFormat: string
  logToFile: boolean
  maxSize: string
  maxFiles: string
  objectDepth: number
  enableColors: boolean
  enableStackTrace: boolean
  transports: string[]
}

/**
 * Get logger configuration from declarative config
 */
export function getLoggerConfig(): LoggerConfig {
  return {
    level: loggerConfig.level ?? 'info',
    format: (loggerConfig as any).format ?? 'pretty',
    dateFormat: loggerConfig.dateFormat ?? 'YYYY-MM-DD HH:mm:ss',
    logToFile: loggerConfig.logToFile ?? false,
    maxSize: loggerConfig.maxSize ?? '20m',
    maxFiles: loggerConfig.maxFiles ?? '14d',
    objectDepth: loggerConfig.objectDepth ?? 4,
    enableColors: loggerConfig.enableColors ?? true,
    enableStackTrace: loggerConfig.enableStackTrace ?? true,
    transports: (loggerConfig as any).transports ?? ['console']
  }
}

export const LOGGER_CONFIG = getLoggerConfig()
