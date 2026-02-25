/**
 * Core Server Middleware
 * FluxStack middleware infrastructure exports
 */

export {
  errorHandlingMiddleware,
  notFoundMiddleware,
  createError,
  asyncHandler
} from './errorHandling'

export type {
  ErrorHandlingOptions,
  FluxStackError
} from './errorHandling'

// Elysia Middleware Helpers
export {
  createMiddleware,
  createDerive,
  createGuard,
  createRateLimit,
  composeMiddleware,
  isDevelopment,
  isProduction,
  isTest
} from './elysia-helpers'

export type {
  MiddlewareOptions
} from './elysia-helpers'