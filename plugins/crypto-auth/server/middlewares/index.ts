/**
 * Crypto Auth Middlewares
 * Exports centralizados de todos os middlewares
 */

// Middlewares
export { cryptoAuthRequired } from './cryptoAuthRequired'
export { cryptoAuthAdmin } from './cryptoAuthAdmin'
export { cryptoAuthOptional } from './cryptoAuthOptional'
export { cryptoAuthPermissions } from './cryptoAuthPermissions'

// Helpers
export {
  getCryptoAuthUser,
  isCryptoAuthAuthenticated,
  isCryptoAuthAdmin,
  hasCryptoAuthPermission,
  type CryptoAuthUser
} from './helpers'

// Types
export type { CryptoAuthMiddlewareOptions } from './cryptoAuthRequired'
