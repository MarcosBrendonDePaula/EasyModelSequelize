import { Elysia } from 'elysia'
import { EnhancedErrorHandler, type ErrorHandlerContext, type ErrorHandlerOptions, type ErrorMetricsCollector } from './handlers'
import type { Logger } from '../logger/index'

export interface ErrorMiddlewareOptions extends ErrorHandlerOptions {
  logger?: Logger
  isDevelopment?: boolean
  enableRequestContext?: boolean
  metricsCollector?: ErrorMetricsCollector
}

export const errorMiddleware = (options: ErrorMiddlewareOptions = {}) => {
  const handler = new EnhancedErrorHandler(options)
  
  return new Elysia({ name: 'error-handler' })
    .onError(async ({ error, request, path, set }) => {
      // Extract request context
      const context: ErrorHandlerContext = {
        logger: options.logger || console as any, // Fallback to console if no logger provided
        isDevelopment: options.isDevelopment ?? process.env.NODE_ENV === 'development',
        request,
        path,
        method: request.method,
        correlationId: request.headers.get('x-correlation-id') || undefined,
        userId: request.headers.get('x-user-id') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') || 
            'unknown',
        metricsCollector: options.metricsCollector
      }

      try {
        // Convert Elysia error to standard Error if needed
        const standardError = error instanceof Error ? error : new Error(String(error))
        const errorResponse = await handler.handle(standardError, context)
        
        // Set response status code
        set.status = errorResponse.error.statusCode
        
        // Set correlation ID header if available
        if (errorResponse.error.correlationId) {
          set.headers['x-correlation-id'] = errorResponse.error.correlationId
        }
        
        return errorResponse
      } catch (handlerError) {
        // Fallback error handling if the error handler itself fails
        const fallbackLogger = options.logger || console as any
        fallbackLogger.error('Error handler failed', {
          originalError: error instanceof Error ? error.message : String(error),
          handlerError: handlerError instanceof Error ? handlerError.message : handlerError
        })
        
        set.status = 500
        return {
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
            statusCode: 500,
            timestamp: new Date().toISOString()
          }
        }
      }
    })
}

// Correlation ID middleware to add correlation IDs to requests
export const correlationIdMiddleware = () => {
  return new Elysia({ name: 'correlation-id' })
    .onRequest(({ request, set }) => {
      // Check if correlation ID already exists in headers
      let correlationId = request.headers.get('x-correlation-id')
      
      // Generate new correlation ID if not present
      if (!correlationId) {
        correlationId = crypto.randomUUID()
      }
      
      // Add correlation ID to response headers
      set.headers['x-correlation-id'] = correlationId
      
      // Store correlation ID in request context for later use
      // Note: This would typically be stored in a request-scoped context
      // For now, we'll rely on the error handler to extract it from headers
    })
}

// Request context middleware to extract and store request information
export const requestContextMiddleware = () => {
  return new Elysia({ name: 'request-context' })
    .onRequest(({ request, set }) => {
      // Extract useful request information and store in headers for error handling
      const userAgent = request.headers.get('user-agent')
      const ip = request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown'
      
      // Store in custom headers for error handler access
      // In a real implementation, this would use request-scoped storage
      if (userAgent) {
        set.headers['x-internal-user-agent'] = userAgent
      }
      set.headers['x-internal-ip'] = ip
    })
}

// Combined error handling middleware with all features
export const fullErrorHandlingMiddleware = (options: ErrorMiddlewareOptions = {}) => {
  return new Elysia({ name: 'full-error-handling' })
    .use(correlationIdMiddleware())
    .use(requestContextMiddleware())
    .use(errorMiddleware(options))
}