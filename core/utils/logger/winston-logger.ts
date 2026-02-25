/**
 * FluxStack Logger - Winston Logger Factory
 * Creates Winston logger instances for each module
 */

import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import chalk from 'chalk'
import { LOGGER_CONFIG } from './config'
import { LOG_SYMBOLS, LEVEL_COLORS } from './colors'

// Cache for module loggers
const moduleLoggers = new Map<string, winston.Logger>()

/**
 * Console format with colors and symbols
 */
function createConsoleFormat() {
  return winston.format.printf(({ timestamp, level, message }) => {
    const levelSymbol = LOG_SYMBOLS[level as keyof typeof LOG_SYMBOLS] || LOG_SYMBOLS.default
    const levelColor = LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] || LEVEL_COLORS.default
    const timestampFormatted = chalk.gray(`[${timestamp}]`)

    return `${levelSymbol} ${timestampFormatted} ${levelColor(level.toUpperCase().padEnd(5))} ${message}`
  })
}

/**
 * File format without colors
 */
function createFileFormat() {
  return winston.format.printf(({ timestamp, level, message }) => {
    // Remove ANSI color codes
    const cleanMessage = String(message).replace(/\u001b\[.*?m/g, '')
    return `[${timestamp}] [${level.toUpperCase()}]: ${cleanMessage}`
  })
}

/**
 * Create a logger for a specific module
 */
export function getLoggerForModule(modulePath: string): winston.Logger {
  // Normalize path for cache key
  const normalizedPath = modulePath.replace(/[:/\\]/g, '_').replace(/^_/, '')

  // Check cache
  if (moduleLoggers.has(normalizedPath)) {
    return moduleLoggers.get(normalizedPath)!
  }

  // Create logger
  const logger = createLogger(normalizedPath)
  moduleLoggers.set(normalizedPath, logger)

  return logger
}

/**
 * Create a Winston logger with appropriate transports
 */
function createLogger(modulePath: string): winston.Logger {
  const transports: winston.transport[] = [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: LOGGER_CONFIG.dateFormat }),
        createConsoleFormat()
      )
    })
  ]

  // Add file transports if enabled
  if (LOGGER_CONFIG.logToFile) {
    const logsDir = join(process.cwd(), 'logs', modulePath)

    // Ensure logs directory exists
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }

    const commonFileFormat = winston.format.combine(
      winston.format.timestamp({ format: LOGGER_CONFIG.dateFormat }),
      createFileFormat()
    )

    // All logs
    transports.push(
      new DailyRotateFile({
        filename: join(logsDir, '%DATE%-all.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: LOGGER_CONFIG.maxSize,
        maxFiles: LOGGER_CONFIG.maxFiles,
        level: LOGGER_CONFIG.level,
        format: commonFileFormat
      })
    )

    // Error logs
    transports.push(
      new DailyRotateFile({
        filename: join(logsDir, '%DATE%-errors.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: LOGGER_CONFIG.maxSize,
        maxFiles: LOGGER_CONFIG.maxFiles,
        level: 'error',
        format: commonFileFormat
      })
    )

    // Warning logs
    transports.push(
      new DailyRotateFile({
        filename: join(logsDir, '%DATE%-warnings.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: LOGGER_CONFIG.maxSize,
        maxFiles: LOGGER_CONFIG.maxFiles,
        level: 'warn',
        format: commonFileFormat
      })
    )

    // Info logs
    transports.push(
      new DailyRotateFile({
        filename: join(logsDir, '%DATE%-info.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: LOGGER_CONFIG.maxSize,
        maxFiles: LOGGER_CONFIG.maxFiles,
        level: 'info',
        format: commonFileFormat
      })
    )
  }

  return winston.createLogger({
    level: LOGGER_CONFIG.level,
    transports
  })
}

/**
 * Clear logger cache (useful for testing)
 */
export function clearLoggerCache(): void {
  // Close all loggers before clearing
  for (const logger of moduleLoggers.values()) {
    logger.close()
  }
  moduleLoggers.clear()
}
