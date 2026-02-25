/**
 * Eden Treaty API Client
 * Configured for this application
 *
 * This file extends the core Eden client with app-specific customizations.
 * Modify the options below to change API behavior across the entire app.
 */

import { createEdenClient, getErrorMessage } from '@/core/client/api'
import type { App } from '@server/app'

/**
 * API client with full type inference from server routes
 *
 * @example
 * ```typescript
 * // GET request
 * const { data, error } = await api.users.get()
 *
 * // POST request
 * const { data, error } = await api.users.post({
 *   name: 'John',
 *   email: 'john@example.com'
 * })
 *
 * // With query params
 * const { data } = await api.users.get({ query: { page: 1, limit: 10 } })
 *
 * // With path params
 * const { data } = await api.users({ id: 123 }).get()
 * ```
 */
export const api = createEdenClient<App>({
  // ┌─────────────────────────────────────────────────────────────────┐
  // │ CUSTOMIZATION EXAMPLES                                         │
  // │ Uncomment and modify the options below as needed                │
  // └─────────────────────────────────────────────────────────────────┘

  // ── Authentication ──────────────────────────────────────────────────
  // Custom token key (default: 'accessToken')
  // tokenKey: 'authToken',

  // Custom token getter (e.g., from a state manager)
  // getAuthToken: () => {
  //   return useAuthStore.getState().token
  // },

  // ── Unauthorized Handler ────────────────────────────────────────────
  // Redirect to login on 401
  // onUnauthorized: () => {
  //   localStorage.removeItem('accessToken')
  //   window.location.href = '/login'
  // },

  // Show toast notification on 401
  // onUnauthorized: () => {
  //   toast.error('Session expired. Please login again.')
  //   router.push('/login')
  // },

  // ── Base URL ────────────────────────────────────────────────────────
  // Custom base URL (e.g., for different environments)
  // getBaseUrl: () => {
  //   if (import.meta.env.PROD) return 'https://api.myapp.com'
  //   return 'http://localhost:3000'
  // },

  // ── Logging ─────────────────────────────────────────────────────────
  // Force enable/disable logging (default: auto based on DEV mode)
  // enableLogging: true,
})

// Re-export utility for convenience
export { getErrorMessage }

// ┌─────────────────────────────────────────────────────────────────────┐
// │ ADVANCED: Creating Multiple API Clients                            │
// │                                                                     │
// │ You can create additional clients for different purposes:          │
// └─────────────────────────────────────────────────────────────────────┘
//
// // Public API (no auth)
// export const publicApi = createEdenClient<App>({
//   getAuthToken: () => null,
// })
//
// // Admin API (different token)
// export const adminApi = createEdenClient<App>({
//   tokenKey: 'adminToken',
//   onUnauthorized: () => {
//     window.location.href = '/admin/login'
//   },
// })
//
// // External API (different base URL)
// import type { ExternalApp } from './external-types'
// export const externalApi = createEdenClient<ExternalApp>({
//   getBaseUrl: () => 'https://external-api.com',
// })
