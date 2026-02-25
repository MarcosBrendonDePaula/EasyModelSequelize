/**
 * FluxStack Logger - Message Formatter
 * Formats log messages with proper object inspection
 */

import { inspect } from 'util'
import { LOGGER_CONFIG } from './config'

/**
 * Format a log message with proper object inspection
 */
export function formatMessage(message: unknown, args: unknown[] = []): string {
  const inspectOptions = {
    depth: LOGGER_CONFIG.objectDepth,
    colors: LOGGER_CONFIG.enableColors,
    compact: false,
    breakLength: 100
  }

  // Format the main message
  let formattedMessage: string

  if (typeof message === 'string') {
    formattedMessage = message
  } else if (message instanceof Error) {
    // Special handling for Error objects
    formattedMessage = `${message.name}: ${message.message}\n${message.stack || ''}`
  } else if (typeof message === 'object' && message !== null) {
    // Use util.inspect for better object formatting
    formattedMessage = inspect(message, inspectOptions)
  } else {
    formattedMessage = String(message)
  }

  // Format additional arguments (skip undefined values)
  if (args.length > 0) {
    const formattedArgs = args
      .filter(arg => arg !== undefined) // Skip undefined values
      .map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return inspect(arg, inspectOptions)
        }
        return String(arg)
      })
      .join(' ')

    // Only add formatted args if there are any after filtering
    if (formattedArgs.length > 0) {
      return `${formattedMessage} ${formattedArgs}`
    }
  }

  return formattedMessage
}

/**
 * Format a section title
 */
export function formatSection(title: string): string {
  return `=== ${title.toUpperCase()} ===`
}

/**
 * Format an important message
 */
export function formatImportant(title: string): string {
  return `■ ${title.toUpperCase()} ■`
}

/**
 * Format operation start
 */
export function formatOperationStart(operation: string): string {
  return `▶ INICIANDO: ${operation}`
}

/**
 * Format operation success
 */
export function formatOperationSuccess(operation: string): string {
  return `✓ CONCLUÍDO: ${operation}`
}
