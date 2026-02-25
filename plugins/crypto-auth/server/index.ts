/**
 * Exportações do servidor de autenticação
 */

export { CryptoAuthService } from './CryptoAuthService'
export type { AuthResult, CryptoAuthConfig } from './CryptoAuthService'

export { AuthMiddleware } from './AuthMiddleware'
export type { AuthMiddlewareConfig, AuthMiddlewareResult } from './AuthMiddleware'

// LiveAuthProvider adapter for Live Components
export { CryptoAuthLiveProvider } from './CryptoAuthLiveProvider'

// Middlewares Elysia
export {
  cryptoAuthRequired,
  cryptoAuthAdmin,
  cryptoAuthPermissions,
  cryptoAuthOptional,
  getCryptoAuthUser,
  isCryptoAuthAuthenticated,
  isCryptoAuthAdmin,
  hasCryptoAuthPermission
} from './middlewares'
export type { CryptoAuthUser, CryptoAuthMiddlewareOptions } from './middlewares'