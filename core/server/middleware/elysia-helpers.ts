/**
 * Elysia Middleware Helpers
 * Utilities to simplify middleware creation for FluxStack apps using Elysia
 */

import { Elysia } from 'elysia'

/**
 * Options for creating middleware
 */
export interface MiddlewareOptions<TContext = any> {
  /** Unique name for the middleware (required for Elysia) */
  name: string

  /**
   * Handler function that runs before the route handler.
   * Return undefined to continue, or return a response to block execution.
   */
  handler: (context: TContext) => void | Promise<void> | any | Promise<any>

  /**
   * If true, uses derive() instead of onBeforeHandle().
   * Use this when you want to add data to context without blocking.
   */
  nonBlocking?: boolean
}

/**
 * Create a simple Elysia middleware plugin
 *
 * @example
 * ```ts
 * const myAuth = createMiddleware({
 *   name: 'myAuth',
 *   handler: ({ headers, set }) => {
 *     const token = headers.authorization
 *     if (!token) {
 *       set.status = 401
 *       return { error: 'Unauthorized' }
 *     }
 *   }
 * })
 *
 * app.use(myAuth)
 * ```
 */
export function createMiddleware<TContext = any>(
  options: MiddlewareOptions<TContext>
) {
  const { name, handler, nonBlocking = false } = options

  if (nonBlocking) {
    // Non-blocking: use derive() - adds to context without stopping execution
    return new Elysia({ name }).derive(handler as any)
  } else {
    // Blocking: use onBeforeHandle() - can stop execution by returning a response
    return new Elysia({ name }).onBeforeHandle(handler as any)
  }
}

/**
 * Create a middleware that derives (adds) data to the context without blocking
 *
 * @example
 * ```ts
 * const addTimestamp = createDerive({
 *   name: 'timestamp',
 *   derive: () => ({ timestamp: Date.now() })
 * })
 *
 * app.use(addTimestamp).get('/', ({ timestamp }) => ({ timestamp }))
 * ```
 */
export function createDerive<TDerived extends Record<string, any>>(options: {
  name: string
  derive: (context: any) => TDerived | Promise<TDerived>
}) {
  return new Elysia({ name: options.name }).derive(options.derive)
}

/**
 * Create a guard middleware (blocking middleware that validates conditions)
 *
 * @example
 * ```ts
 * const requireAdmin = createGuard({
 *   name: 'adminGuard',
 *   check: ({ store }) => {
 *     return store.user?.isAdmin === true
 *   },
 *   onFail: (set) => {
 *     set.status = 403
 *     return { error: 'Admin access required' }
 *   }
 * })
 *
 * app.use(requireAdmin).get('/admin', () => 'Admin panel')
 * ```
 */
export function createGuard<TContext = any>(options: {
  name: string
  check: (context: TContext) => boolean | Promise<boolean>
  onFail: (set: any, context: TContext) => any
}) {
  return new Elysia({ name: options.name })
    .onBeforeHandle(async (ctx) => {
      const passed = await options.check(ctx as TContext)
      if (!passed) {
        return options.onFail((ctx as any).set, ctx as TContext)
      }
    })
}

/**
 * Create a rate limiter middleware
 *
 * @example
 * ```ts
 * const apiRateLimit = createRateLimit({
 *   name: 'apiRateLimit',
 *   maxRequests: 100,
 *   windowMs: 60000, // 1 minute
 *   keyGenerator: ({ request }) => request.headers.get('x-api-key') || 'anonymous'
 * })
 * ```
 */
export function createRateLimit(options: {
  name: string
  maxRequests: number
  windowMs: number
  keyGenerator?: (context: any) => string
  message?: string
}) {
  const {
    name,
    maxRequests,
    windowMs,
    keyGenerator = ({ request }: any) =>
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown',
    message = 'Too many requests'
  } = options

  const requests = new Map<string, { count: number; resetTime: number }>()

  // Cleanup old entries periodically (store ref for proper disposal)
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(key)
      }
    }
  }, Math.max(windowMs, 60000)) // At least every minute

  // Prevent interval from keeping the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }

  return new Elysia({ name })
    .onBeforeHandle((ctx) => {
      const key = keyGenerator(ctx)
      const now = Date.now()
      const entry = requests.get(key)

      if (entry) {
        if (now > entry.resetTime) {
          // Reset window
          requests.set(key, { count: 1, resetTime: now + windowMs })
        } else if (entry.count >= maxRequests) {
          // Rate limit exceeded
          ;(ctx as any).set.status = 429
          return {
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message
          }
        } else {
          // Increment count
          entry.count++
        }
      } else {
        // First request
        requests.set(key, { count: 1, resetTime: now + windowMs })
      }
    })
}

/**
 * Create a composable middleware that runs multiple middlewares in sequence
 *
 * @example
 * ```ts
 * const protectedRoute = composeMiddleware({
 *   name: 'protectedRoute',
 *   middlewares: [auth(), requireEmailVerification(), rateLimit()]
 * })
 *
 * app.use(protectedRoute).get('/protected', () => 'Protected content')
 * ```
 */
export function composeMiddleware(options: {
  name: string
  middlewares: Elysia[]
}) {
  let composed = new Elysia({ name: options.name })

  for (const middleware of options.middlewares) {
    composed = composed.use(middleware)
  }

  return composed
}

/**
 * Environment-aware configuration helper
 */
export function isDevelopment() {
  return process.env.NODE_ENV === 'development'
}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function isTest() {
  return process.env.NODE_ENV === 'test'
}