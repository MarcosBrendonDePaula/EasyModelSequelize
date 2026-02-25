/**
 * FluxStack Auth Routes
 *
 * Endpoints de autenticação:
 * - POST /api/auth/register — Registrar novo usuário
 * - POST /api/auth/login    — Login (email + password)
 * - POST /api/auth/logout   — Logout (destroi sessão)
 * - GET  /api/auth/me       — Retorna usuário autenticado
 */

import { Elysia, t } from 'elysia'
import {
  getAuthManager,
  getRateLimiter,
  auth,
  guest,
  buildRequestContext,
} from '@server/auth'
import { authConfig } from '@config/system/auth.config'

// ===== Schemas TypeBox (para validação + Swagger) =====

const RegisterBodySchema = t.Object({
  name: t.String({ minLength: 1, description: 'User name' }),
  email: t.String({ format: 'email', description: 'User email' }),
  password: t.String({ minLength: 6, description: 'User password (min 6 chars)' }),
})

const LoginBodySchema = t.Object({
  email: t.String({ format: 'email', description: 'User email' }),
  password: t.String({ minLength: 1, description: 'User password' }),
})

const AuthUserResponseSchema = t.Object({
  success: t.Literal(true),
  user: t.Object({
    id: t.Union([t.String(), t.Number()]),
    name: t.Optional(t.String()),
    email: t.Optional(t.String()),
    createdAt: t.Optional(t.String()),
  }),
})

const AuthErrorResponseSchema = t.Object({
  success: t.Literal(false),
  error: t.String(),
  message: t.Optional(t.String()),
})

const LoginResponseSchema = t.Object({
  success: t.Literal(true),
  user: t.Object({
    id: t.Union([t.String(), t.Number()]),
    name: t.Optional(t.String()),
    email: t.Optional(t.String()),
    createdAt: t.Optional(t.String()),
  }),
  token: t.Optional(t.String({ description: 'Bearer token (only for token guard)' })),
})

// ===== Routes =====

export const authRoutes = new Elysia({
  prefix: '/auth',
  tags: ['Auth'],
})

  // ───── Register ─────
  .post('/register', async (ctx) => {
    const { body, set } = ctx

    try {
      const authManager = getAuthManager()
      const guard = authManager.freshGuard(undefined, buildRequestContext(ctx))

      // Resolver provider para criar user
      const config = authManager.getConfig()
      const providerName = config.guards[config.defaults.guard]?.provider ?? config.defaults.provider

      // Acessar provider via guard.attempt com credenciais
      // Alternativa: criar user via provider e depois login
      const guardInstance = authManager.guard()

      // Criar user diretamente via provider registrado
      // O provider é acessível via attempt/validate, mas para register
      // precisamos acessar createUser.
      // Solução: usar o InMemoryProvider diretamente ou o guard.
      // Por segurança, vamos usar attempt após criar o user.

      // Buscar provider do auth manager config
      const providers = (authManager as any).providerInstances as Map<string, any>
      const provider = providers.get(providerName)

      if (!provider) {
        set.status = 500
        return { success: false as const, error: 'ServerError', message: 'Auth provider not available' }
      }

      // Verificar se email já existe
      const existing = await provider.retrieveByCredentials({ email: body.email })
      if (existing) {
        set.status = 422
        return { success: false as const, error: 'ValidationError', message: 'Email already in use' }
      }

      // Criar usuário
      const user = await provider.createUser({
        name: body.name,
        email: body.email,
        password: body.password,
      })

      // Auto-login após registro
      await guard.login(user)

      set.status = 201
      return {
        success: true as const,
        user: user.toJSON() as any,
      }
    } catch (error: any) {
      set.status = 422
      return {
        success: false as const,
        error: 'RegistrationFailed',
        message: error.message ?? 'Failed to register user',
      }
    }
  }, {
    body: RegisterBodySchema,
    response: {
      201: AuthUserResponseSchema,
      422: AuthErrorResponseSchema,
      500: AuthErrorResponseSchema,
    },
    detail: {
      summary: 'Register',
      description: 'Create a new user account and auto-login',
    },
  })

  // ───── Login ─────
  .post('/login', async (ctx) => {
    const { body, set } = ctx

    const rateLimiter = getRateLimiter()
    const requestContext = buildRequestContext(ctx)
    const throttleKey = `${body.email}|${requestContext.ip}`

    // Rate limiting
    const maxAttempts = authConfig.rateLimit.maxAttempts ?? 5
    const decaySeconds = authConfig.rateLimit.decaySeconds ?? 60

    if (await rateLimiter.tooManyAttempts(throttleKey, maxAttempts)) {
      const retryAfter = await rateLimiter.availableIn(throttleKey)
      set.status = 429
      set.headers['Retry-After'] = String(retryAfter)
      return {
        success: false as const,
        error: 'TooManyAttempts',
        message: `Too many login attempts. Try again in ${retryAfter} seconds.`,
      }
    }

    try {
      const authManager = getAuthManager()
      const guard = authManager.freshGuard(undefined, requestContext)

      // Tentar autenticar
      const user = await guard.attempt({
        email: body.email,
        password: body.password,
      })

      if (!user) {
        // Registrar tentativa falha
        await rateLimiter.hit(throttleKey, decaySeconds)
        set.status = 401
        return {
          success: false as const,
          error: 'InvalidCredentials',
          message: 'Invalid email or password.',
        }
      }

      // Sucesso: limpar rate limit
      await rateLimiter.clear(throttleKey)

      // Montar response
      const response: any = {
        success: true as const,
        user: user.toJSON(),
      }

      // Se for token guard, incluir token na response
      if ('getLastGeneratedToken' in guard) {
        const token = (guard as any).getLastGeneratedToken()
        if (token) {
          response.token = token
        }
      }

      return response
    } catch (error: any) {
      set.status = 500
      return {
        success: false as const,
        error: 'LoginFailed',
        message: error.message ?? 'An unexpected error occurred.',
      }
    }
  }, {
    body: LoginBodySchema,
    response: {
      200: LoginResponseSchema,
      401: AuthErrorResponseSchema,
      429: AuthErrorResponseSchema,
      500: AuthErrorResponseSchema,
    },
    detail: {
      summary: 'Login',
      description: 'Authenticate with email and password. Returns user data and session cookie (or token).',
    },
  })

  // ───── Logout ─────
  .use(auth())
  .post('/logout', async (ctx) => {
    const { auth: guard } = ctx as any

    try {
      if (guard) {
        await guard.logout()
      }

      return {
        success: true as const,
        message: 'Logged out successfully.',
      }
    } catch (error: any) {
      (ctx as any).set.status = 500
      return {
        success: false as const,
        error: 'LogoutFailed',
        message: error.message ?? 'Failed to logout.',
      }
    }
  }, {
    response: {
      200: t.Object({
        success: t.Literal(true),
        message: t.String(),
      }),
      500: AuthErrorResponseSchema,
    },
    detail: {
      summary: 'Logout',
      description: 'Destroy the current session and clear the cookie.',
    },
  })

  // ───── Me (current user) ─────
  .get('/me', async (ctx) => {
    const { user } = ctx as any

    return {
      success: true as const,
      user: user.toJSON(),
    }
  }, {
    response: {
      200: AuthUserResponseSchema,
    },
    detail: {
      summary: 'Current User',
      description: 'Returns the currently authenticated user.',
    },
  })
