import { FluxStackError, wrapError, type ErrorMetadata, type ErrorSerializedResponse } from "./index"
import type { Logger } from "../logger/index"
import { v4 as uuidv4 } from 'uuid'

export interface ErrorHandlerContext {
  logger: Logger
  isDevelopment: boolean
  request?: Request
  path?: string
  method?: string
  correlationId?: string
  userId?: string
  userAgent?: string
  ip?: string
  metricsCollector?: ErrorMetricsCollector
}

export interface ErrorMetricsCollector {
  recordError(error: FluxStackError, context: ErrorHandlerContext): void
}

export interface ErrorRecoveryStrategy {
  canRecover(error: FluxStackError): boolean
  recover(error: FluxStackError, context: ErrorHandlerContext): Promise<any> | any
}

export interface ErrorHandlerOptions {
  enableStackTrace?: boolean
  enableErrorMetrics?: boolean
  enableCorrelationId?: boolean
  sanitizeErrors?: boolean
  recoveryStrategies?: ErrorRecoveryStrategy[]
  customErrorMessages?: Record<string, string>
}

export class EnhancedErrorHandler {
  private options: Required<ErrorHandlerOptions>
  private recoveryStrategies: ErrorRecoveryStrategy[]

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      enableStackTrace: options.enableStackTrace ?? true,
      enableErrorMetrics: options.enableErrorMetrics ?? true,
      enableCorrelationId: options.enableCorrelationId ?? true,
      sanitizeErrors: options.sanitizeErrors ?? true,
      recoveryStrategies: options.recoveryStrategies ?? [],
      customErrorMessages: options.customErrorMessages ?? {}
    }
    this.recoveryStrategies = this.options.recoveryStrategies
  }

  async handle(error: Error, context: ErrorHandlerContext): Promise<ErrorSerializedResponse> {
    const { logger, isDevelopment, request, path, method, correlationId, userId, userAgent, ip, metricsCollector } = context
    
    // Generate correlation ID if not provided and enabled
    const finalCorrelationId = this.options.enableCorrelationId 
      ? (correlationId || uuidv4())
      : correlationId

    // Create metadata from context
    const metadata: ErrorMetadata = {
      correlationId: finalCorrelationId,
      userId,
      userAgent,
      ip,
      path,
      method,
      timestamp: new Date().toISOString()
    }

    // Convert to FluxStackError if needed
    let fluxError: FluxStackError
    if (error instanceof FluxStackError) {
      fluxError = error.withMetadata(metadata)
    } else {
      fluxError = wrapError(error, metadata)
    }

    // Try recovery strategies for operational errors
    if (fluxError.isOperational && this.recoveryStrategies.length > 0) {
      for (const strategy of this.recoveryStrategies) {
        if (strategy.canRecover(fluxError)) {
          try {
            const recoveryResult = await strategy.recover(fluxError, context)
            logger.info('Error recovery successful', {
              errorCode: fluxError.code,
              correlationId: finalCorrelationId,
              strategy: strategy.constructor.name
            })
            return recoveryResult
          } catch (recoveryError) {
            logger.warn('Error recovery failed', {
              errorCode: fluxError.code,
              correlationId: finalCorrelationId,
              strategy: strategy.constructor.name,
              recoveryError: recoveryError instanceof Error ? recoveryError.message : recoveryError
            })
          }
        }
      }
    }

    // Log the error with appropriate level and context
    this.logError(fluxError, logger, isDevelopment)

    // Record metrics if enabled
    if (this.options.enableErrorMetrics && metricsCollector) {
      try {
        metricsCollector.recordError(fluxError, context)
      } catch (metricsError) {
        logger.warn('Failed to record error metrics', { 
          error: metricsError instanceof Error ? metricsError.message : metricsError 
        })
      }
    }

    // Generate user-friendly response
    return this.generateErrorResponse(fluxError, isDevelopment)
  }

  private logError(error: FluxStackError, logger: Logger, isDevelopment: boolean): void {
    const logLevel = this.getLogLevel(error)

    // Format stack trace properly (handles CallSite objects from Bun)
    const formattedStack = isDevelopment ? this.formatErrorStack(error.stack) : undefined

    const logData = {
      code: error.code,
      statusCode: error.statusCode,
      context: error.context,
      metadata: error.metadata,
      isOperational: error.isOperational,
      ...(formattedStack && { stack: formattedStack })
    }

    // Skip logging for certain errors to reduce noise
    if (this.shouldSkipLogging(error)) {
      return
    }

    logger[logLevel](error.message, logData)
  }

  /**
   * Format stack trace to readable string (handles Bun CallSite objects)
   */
  private formatErrorStack(stack: any): string | undefined {
    if (!stack) return undefined

    // If stack is already a string, return it
    if (typeof stack === 'string') return stack

    // If stack is an array of CallSite objects (Bun), format them
    if (Array.isArray(stack)) {
      return stack
        .map((site: any, index: number) => {
          try {
            const fileName = site.getFileName?.() || 'unknown'
            const lineNumber = site.getLineNumber?.() || 0
            const columnNumber = site.getColumnNumber?.() || 0
            const functionName = site.getFunctionName?.() || 'anonymous'

            return `    at ${functionName} (${fileName}:${lineNumber}:${columnNumber})`
          } catch {
            return `    at ${String(site)}`
          }
        })
        .join('\n')
    }

    // Fallback: convert to string
    return String(stack)
  }

  private getLogLevel(error: FluxStackError): 'error' | 'warn' | 'info' {
    if (!error.isOperational) {
      return 'error'
    }
    
    if (error.statusCode >= 500) {
      return 'error'
    } else if (error.statusCode >= 400) {
      return 'warn'
    } else {
      return 'info'
    }
  }

  private shouldSkipLogging(error: FluxStackError): boolean {
    // Skip logging for 404 errors unless explicitly enabled
    if (error.code === 'NOT_FOUND' && !process.env.ENABLE_NOT_FOUND_LOGS) {
      return true
    }

    // Skip logging for Vite internal routes (even if NOT_FOUND logging is enabled)
    if (error.code === 'NOT_FOUND' && error.metadata?.path) {
      const path = error.metadata.path
      if (path.startsWith('/@') || 
          path.startsWith('/__vite') || 
          path.includes('/.vite/') ||
          path.endsWith('.js.map') ||
          path.endsWith('.css.map')) {
        return true
      }
    }

    // Skip logging for rate limit errors to prevent log spam
    if (error.code === 'RATE_LIMIT_EXCEEDED' && !process.env.ENABLE_RATE_LIMIT_LOGS) {
      return true
    }

    return false
  }

  private generateErrorResponse(error: FluxStackError, isDevelopment: boolean): ErrorSerializedResponse {
    const response = error.toResponse(isDevelopment)
    
    // Apply custom error messages if configured
    if (this.options.customErrorMessages[error.code]) {
      response.error.message = this.options.customErrorMessages[error.code]
    }

    // Sanitize sensitive information in production
    if (!isDevelopment && this.options.sanitizeErrors) {
      response.error = this.sanitizeErrorResponse(response.error)
    }

    return response
  }

  private sanitizeErrorResponse(errorResponse: any): any {
    const sanitized = { ...errorResponse }
    
    // Remove potentially sensitive fields in production
    if (sanitized.details) {
      // Remove sensitive fields from details
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential']
      for (const field of sensitiveFields) {
        if (sanitized.details[field]) {
          sanitized.details[field] = '[REDACTED]'
        }
      }
    }

    return sanitized
  }

  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy)
  }

  removeRecoveryStrategy(strategyClass: new (...args: any[]) => ErrorRecoveryStrategy): void {
    this.recoveryStrategies = this.recoveryStrategies.filter(
      strategy => !(strategy instanceof strategyClass)
    )
  }
}

// Legacy error handler for backward compatibility
export const errorHandler = (error: Error, context: ErrorHandlerContext) => {
  const handler = new EnhancedErrorHandler()
  return handler.handle(error, context)
}

export const createErrorHandler = (
  baseContext: Omit<ErrorHandlerContext, 'request' | 'path' | 'method'>,
  options?: ErrorHandlerOptions
) => {
  const handler = new EnhancedErrorHandler(options)
  
  return async (error: Error, request?: Request, path?: string, method?: string) => {
    const context: ErrorHandlerContext = {
      ...baseContext,
      request,
      path,
      method: method || request?.method
    }
    
    return handler.handle(error, context)
  }
}

// Built-in recovery strategies
export class RetryRecoveryStrategy implements ErrorRecoveryStrategy {
  constructor(
    private maxRetries: number = 3,
    private retryDelay: number = 1000,
    private retryableCodes: string[] = ['EXTERNAL_SERVICE_ERROR', 'DATABASE_ERROR']
  ) {}

  canRecover(error: FluxStackError): boolean {
    return this.retryableCodes.includes(error.code) && 
           (!error.context?.retryCount || error.context.retryCount < this.maxRetries)
  }

  async recover(error: FluxStackError, context: ErrorHandlerContext): Promise<any> {
    const retryCount = (error.context?.retryCount || 0) + 1
    
    context.logger.info('Attempting error recovery', {
      errorCode: error.code,
      retryCount,
      maxRetries: this.maxRetries
    })

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.retryDelay * retryCount))
    
    // This would typically re-execute the original operation
    // For now, we'll just return a recovery response
    throw error.withMetadata({ ...error.metadata, retryCount })
  }
}

export class FallbackRecoveryStrategy implements ErrorRecoveryStrategy {
  constructor(
    private fallbackResponse: any,
    private applicableCodes: string[] = ['EXTERNAL_SERVICE_ERROR']
  ) {}

  canRecover(error: FluxStackError): boolean {
    return this.applicableCodes.includes(error.code)
  }

  recover(error: FluxStackError, context: ErrorHandlerContext): any {
    context.logger.info('Using fallback recovery', {
      errorCode: error.code,
      correlationId: error.metadata.correlationId
    })

    return {
      data: this.fallbackResponse,
      warning: 'Fallback data provided due to service unavailability'
    }
  }
}