/**
 * FluxStack Auth - Elysia Middleware
 *
 * Middlewares prontos para proteger rotas:
 *
 * ```ts
 * // Rota protegida (requer login)
 * app.use(auth()).get('/me', ({ user }) => user.toJSON())
 *
 * // Rota de guest (requer NÃO estar logado)
 * app.use(guest()).post('/login', loginHandler)
 *
 * // Guard específico
 * app.use(auth('api')).get('/api/data', handler)
 * ```
 */

import { Elysia } from 'elysia'
import type { AuthManager } from './AuthManager'
import type { Authenticatable, RequestContext } from './contracts'

/** Referência ao AuthManager (setado no boot) */
let authManagerRef: AuthManager | null = null

export function setAuthManagerForMiddleware(manager: AuthManager): void {
  authManagerRef = manager
}

/**
 * Extrai RequestContext do context do Elysia.
 */
function buildRequestContext(ctx: any): RequestContext {
  const headers: Record<string, string | undefined> = {}
  if (ctx.headers) {
    for (const [key, value] of Object.entries(ctx.headers)) {
      headers[key] = value as string | undefined
    }
  }

  return {
    headers,
    cookie: ctx.cookie ?? {},
    setCookie: (name: string, value: string, options?: any) => {
      if (ctx.cookie) {
        ctx.cookie[name].set({
          value,
          ...options,
        })
      }
    },
    removeCookie: (name: string) => {
      if (ctx.cookie) {
        ctx.cookie[name].set({
          value: '',
          maxAge: 0,
          path: '/',
        })
      }
    },
    ip: ctx.request?.headers?.get('x-forwarded-for')
      ?? ctx.request?.headers?.get('x-real-ip')
      ?? ctx.server?.requestIP?.(ctx.request)?.address
      ?? '127.0.0.1',
  }
}

/**
 * Middleware que requer autenticação.
 * Injeta `user` (Authenticatable) no context do Elysia.
 *
 * Retorna 401 se não autenticado.
 */
export function auth(guardName?: string) {
  return new Elysia({ name: `auth-guard${guardName ? `-${guardName}` : ''}` })
    .derive(async (ctx) => {
      if (!authManagerRef) {
        throw new Error('Auth system not initialized. Did you forget to call initAuth()?')
      }

      const requestContext = buildRequestContext(ctx)
      const guard = authManagerRef.freshGuard(guardName, requestContext)

      const user = await guard.user()

      return {
        user: user as Authenticatable | null,
        auth: guard,
      }
    })
    .onBeforeHandle(async (ctx) => {
      if (!(ctx as any).user) {
        (ctx as any).set.status = 401
        return {
          success: false,
          error: 'Unauthenticated',
          message: 'You must be logged in to access this resource.',
        }
      }
    })
    .as('scoped')
}

/**
 * Middleware que requer NÃO estar autenticado.
 * Útil para rotas de login/register.
 *
 * Retorna 409 se já autenticado.
 */
export function guest(guardName?: string) {
  return new Elysia({ name: `guest-guard${guardName ? `-${guardName}` : ''}` })
    .derive(async (ctx) => {
      if (!authManagerRef) {
        throw new Error('Auth system not initialized. Did you forget to call initAuth()?')
      }

      const requestContext = buildRequestContext(ctx)
      const guard = authManagerRef.freshGuard(guardName, requestContext)

      const user = await guard.user()

      return {
        user: user as Authenticatable | null,
        auth: guard,
      }
    })
    .onBeforeHandle(async (ctx) => {
      if ((ctx as any).user) {
        (ctx as any).set.status = 409
        return {
          success: false,
          error: 'AlreadyAuthenticated',
          message: 'You are already logged in.',
        }
      }
    })
    .as('scoped')
}

/**
 * Middleware que resolve auth opcionalmente (não bloqueia).
 * Útil para rotas que funcionam com ou sem login.
 */
export function authOptional(guardName?: string) {
  return new Elysia({ name: `auth-optional${guardName ? `-${guardName}` : ''}` })
    .derive(async (ctx) => {
      if (!authManagerRef) {
        return { user: null, auth: null }
      }

      const requestContext = buildRequestContext(ctx)
      const guard = authManagerRef.freshGuard(guardName, requestContext)

      const user = await guard.user()

      return {
        user: user as Authenticatable | null,
        auth: guard,
      }
    })
    .as('scoped')
}

export { buildRequestContext }
