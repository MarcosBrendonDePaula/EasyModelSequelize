/**
 * Error Handling Middleware
 * Core FluxStack error handling infrastructure
 */

// Express types - these should be provided by the framework user
export interface Request {
  url: string
  method: string
  ip?: string
  [key: string]: any
}

export interface Response {
  status: (code: number) => Response
  json: (data: any) => Response
  [key: string]: any
}

export interface NextFunction {
  (error?: any): void
}
import type { Logger } from '@core/utils/logger/index'

export interface ErrorHandlingOptions {
  logger?: Logger
  includeStack?: boolean
  customErrorHandler?: (error: Error, req: Request, res: Response) => void
}

export interface FluxStackError extends Error {
  statusCode?: number
  code?: string
  details?: any
}

/**
 * Global error handling middleware
 */
export function errorHandlingMiddleware(options: ErrorHandlingOptions = {}) {
  const { logger, includeStack = false, customErrorHandler } = options

  return (error: FluxStackError, req: Request, res: Response, next: NextFunction) => {
    // Log the error
    if (logger) {
      logger.error('Request error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        statusCode: error.statusCode || 500
      })
    }

    // Custom error handler
    if (customErrorHandler) {
      try {
        customErrorHandler(error, req, res)
        return
      } catch (handlerError) {
        if (logger) {
          logger.error('Custom error handler failed', { error: handlerError })
        }
      }
    }

    // Default error response
    const statusCode = error.statusCode || 500
    const response: any = {
      error: {
        message: error.message || 'Internal Server Error',
        code: error.code || 'INTERNAL_ERROR',
        statusCode
      }
    }

    // Include stack trace in development
    if (includeStack && error.stack) {
      response.error.stack = error.stack
    }

    // Include additional details if available
    if (error.details) {
      response.error.details = error.details
    }

    res.status(statusCode).json(response)
  }
}

/**
 * 404 Not Found middleware
 */
export function notFoundMiddleware(options: { logger?: Logger } = {}) {
  const { logger } = options

  return (req: Request, res: Response, next: NextFunction) => {
    if (logger) {
      logger.warn('Route not found', {
        url: req.url,
        method: req.method,
        ip: req.ip
      })
    }

    res.status(404).json({
      error: {
        message: 'Route not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        path: req.url,
        method: req.method
      }
    })
  }
}

/**
 * Create a FluxStack error
 */
export function createError(
  message: string, 
  statusCode: number = 500, 
  code?: string, 
  details?: any
): FluxStackError {
  const error = new Error(message) as FluxStackError
  error.statusCode = statusCode
  error.code = code
  error.details = details
  return error
}

/**
 * Async error wrapper
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}