/**
 * Eden Treaty Client Factory
 * Creates a type-safe API client with sensible defaults
 */

import { treaty, type Treaty } from '@elysiajs/eden'
import type { Elysia } from 'elysia'

/**
 * Any Elysia application type
 * Used as constraint for the createEdenClient generic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElysiaApp = Elysia<any, any, any, any, any, any, any>

/**
 * Configuration options for the Eden client
 */
export interface EdenClientOptions {
  /**
   * Custom function to get the base URL
   * @default Uses window.location.origin or 'http://localhost:3000'
   */
  getBaseUrl?: () => string

  /**
   * Custom function to get the auth token
   * @default Reads from localStorage.getItem('accessToken')
   */
  getAuthToken?: () => string | null

  /**
   * Callback when a 401 Unauthorized response is received
   * @default Removes accessToken from localStorage
   */
  onUnauthorized?: () => void

  /**
   * Enable request/response logging in development
   * @default true in development, false in production
   */
  enableLogging?: boolean

  /**
   * localStorage key for the access token
   * @default 'accessToken'
   */
  tokenKey?: string
}

/**
 * Default base URL getter
 */
export function getDefaultBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000'
  return window.location.origin
}

/**
 * Create a default auth token getter
 */
function createDefaultGetAuthToken(tokenKey: string): () => string | null {
  return () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(tokenKey)
  }
}

/**
 * Create a default unauthorized handler
 */
function createDefaultOnUnauthorized(tokenKey: string): () => void {
  return () => {
    if (typeof window !== 'undefined') {
      console.warn('🔒 Token expired')
      localStorage.removeItem(tokenKey)
    }
  }
}

/**
 * Check if we're in development mode
 */
function isDev(): boolean {
  try {
    return import.meta.env?.DEV ?? false
  } catch {
    return false
  }
}

/**
 * Create an Eden Treaty client with authentication and logging
 *
 * @example
 * ```typescript
 * import { createEdenClient } from '@core/client/api/eden'
 * import type { App } from '@server/app'
 *
 * // Basic usage
 * export const api = createEdenClient<App>()
 *
 * // With custom options
 * export const api = createEdenClient<App>({
 *   onUnauthorized: () => {
 *     window.location.href = '/login'
 *   }
 * })
 * ```
 */
export function createEdenClient<TApp extends AnyElysiaApp>(
  options: EdenClientOptions = {}
) {
  const {
    getBaseUrl = getDefaultBaseUrl,
    tokenKey = 'accessToken',
    enableLogging = isDev(),
  } = options

  const getAuthToken = options.getAuthToken ?? createDefaultGetAuthToken(tokenKey)
  const onUnauthorized = options.onUnauthorized ?? createDefaultOnUnauthorized(tokenKey)

  const client = treaty<TApp>(getBaseUrl(), {
    // Dynamic headers for every request
    headers(_path, _options) {
      const token = getAuthToken()
      return token ? { Authorization: `Bearer ${token}` } : undefined
    },

    // Custom fetcher with logging and error handling
    fetcher: (async (url: string | URL | Request, init?: RequestInit) => {
      if (enableLogging) {
        console.log(`🌐 ${init?.method ?? 'GET'} ${url}`)
      }

      const res = await fetch(url, init)

      if (enableLogging) {
        console.log(`📡 ${url} → ${res.status}`)
      }

      // Handle 401 Unauthorized
      if (res.status === 401) {
        onUnauthorized()
      }

      return res
    }) as typeof fetch
  })

  // Return the .api property for direct access to endpoints
  // Type inference works automatically from the TApp generic
  return client.api as Treaty.Create<TApp>['api']
}

/**
 * Extract user-friendly error message from Eden Treaty errors
 *
 * @example
 * ```typescript
 * const { data, error } = await api.users.get()
 * if (error) {
 *   toast.error(getErrorMessage(error))
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  // Eden Treaty error format
  if (error && typeof error === 'object' && 'value' in error) {
    const edenError = error as { value?: { message?: string; userMessage?: string } }
    return edenError.value?.userMessage || edenError.value?.message || 'An error occurred'
  }

  // Standard Error
  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred'
}

// Re-export treaty for advanced usage
export { treaty } from '@elysiajs/eden'
