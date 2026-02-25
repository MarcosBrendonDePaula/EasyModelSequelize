/**
 * FluxStack Auth System
 *
 * Sistema de autenticação modular inspirado no Laravel.
 * Guard + Provider pattern com session e token support.
 *
 * ```ts
 * import { auth, guest, initAuth, getAuthManager } from '@server/auth'
 *
 * // Inicializar (no boot da app)
 * initAuth()
 *
 * // Proteger rotas
 * app.use(auth()).get('/me', ({ user }) => user.toJSON())
 * app.use(guest()).post('/login', loginHandler)
 *
 * // Usar auth manager diretamente
 * const manager = getAuthManager()
 * const guard = manager.guard('session')
 * const user = await guard.attempt({ email, password })
 * ```
 */

// Contracts
export type {
  Authenticatable,
  Guard,
  UserProvider,
  RequestContext,
  CookieOptions,
  GuardConfig,
  GuardFactory,
} from './contracts'

// Auth Manager
export { AuthManager } from './AuthManager'
export type { AuthManagerConfig, ProviderConfig } from './AuthManager'

// Hash
export { HashManager, Hash, getHashManager, setHashManager } from './HashManager'
export type { HashAlgorithm, HashOptions } from './HashManager'

// Rate Limiter
export { RateLimiter } from './RateLimiter'

// Guards
export { SessionGuard } from './guards/SessionGuard'
export { TokenGuard } from './guards/TokenGuard'

// Providers
export { InMemoryUserProvider, InMemoryUser } from './providers/InMemoryProvider'

// Sessions
export { SessionManager } from './sessions/SessionManager'
export type { SessionData, SessionConfig } from './sessions/SessionManager'

// Middleware
export { auth, guest, authOptional } from './middleware'

// ===== Boot =====

import { AuthManager } from './AuthManager'
import { HashManager, setHashManager } from './HashManager'
import { RateLimiter } from './RateLimiter'
import { SessionManager } from './sessions/SessionManager'
import { InMemoryUserProvider } from './providers/InMemoryProvider'
import { setAuthManagerForMiddleware, buildRequestContext } from './middleware'
import { cacheManager } from '@server/cache'
import { authConfig } from '@config/system/auth.config'
import { sessionConfig } from '@config/system/session.config'

let authManagerInstance: AuthManager | null = null
let rateLimiterInstance: RateLimiter | null = null
let sessionManagerInstance: SessionManager | null = null

/**
 * Inicializa o sistema de auth.
 * Deve ser chamado uma vez no boot da aplicação.
 */
export function initAuth(): {
  authManager: AuthManager
  rateLimiter: RateLimiter
  sessionManager: SessionManager
} {
  // 1. Configurar Hash
  const hashManager = new HashManager({
    algorithm: authConfig.passwords.hashAlgorithm as 'bcrypt' | 'argon2id',
    bcryptRounds: authConfig.passwords.bcryptRounds,
  })
  setHashManager(hashManager)

  // 2. Criar Session Manager
  const cache = cacheManager.driver()
  sessionManagerInstance = new SessionManager(cache, {
    lifetime: sessionConfig.lifetime,
    cookieName: sessionConfig.cookieName,
    httpOnly: sessionConfig.httpOnly,
    secure: sessionConfig.secure,
    sameSite: sessionConfig.sameSite as 'strict' | 'lax' | 'none',
    path: sessionConfig.path,
    domain: sessionConfig.domain || undefined,
  })

  // 3. Criar Rate Limiter
  rateLimiterInstance = new RateLimiter(cache)

  // 4. Criar Auth Manager
  authManagerInstance = new AuthManager(
    {
      defaults: {
        guard: authConfig.defaults.guard ?? 'session',
        provider: authConfig.defaults.provider ?? 'memory',
      },
      guards: {
        session: {
          driver: 'session',
          provider: 'memory',
        },
        token: {
          driver: 'token',
          provider: 'memory',
          tokenTtl: authConfig.token.ttl,
        },
      },
      providers: {
        memory: {
          driver: 'memory',
        },
      },
    },
    sessionManagerInstance
  )

  // 5. Registrar InMemoryProvider como default
  const inMemoryProvider = new InMemoryUserProvider()
  authManagerInstance.registerProvider('memory', inMemoryProvider)

  // 6. Conectar middleware
  setAuthManagerForMiddleware(authManagerInstance)

  console.log(`🔐 Auth system initialized (guard: ${authConfig.defaults.guard}, hash: ${authConfig.passwords.hashAlgorithm})`)

  return {
    authManager: authManagerInstance,
    rateLimiter: rateLimiterInstance,
    sessionManager: sessionManagerInstance,
  }
}

/** Retorna o AuthManager (deve ser chamado após initAuth) */
export function getAuthManager(): AuthManager {
  if (!authManagerInstance) {
    throw new Error('Auth not initialized. Call initAuth() first.')
  }
  return authManagerInstance
}

/** Retorna o RateLimiter (deve ser chamado após initAuth) */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    throw new Error('Auth not initialized. Call initAuth() first.')
  }
  return rateLimiterInstance
}

/** Retorna o SessionManager (deve ser chamado após initAuth) */
export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    throw new Error('Auth not initialized. Call initAuth() first.')
  }
  return sessionManagerInstance
}

export { buildRequestContext }
