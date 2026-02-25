/**
 * Auth Configuration
 *
 * Configuração do sistema de autenticação.
 * Inspirado no config/auth.php do Laravel.
 *
 * Guards: COMO autenticar (session, token, jwt...)
 * Providers: ONDE buscar usuários (memory, database...)
 */

import { defineConfig, defineNestedConfig, config } from '@core/utils/config-schema'

// ===== Defaults =====

const defaultsSchema = {
  guard: config.enum('AUTH_DEFAULT_GUARD', ['session', 'token'] as const, 'session'),
  provider: config.enum('AUTH_DEFAULT_PROVIDER', ['memory', 'database'] as const, 'memory'),
} as const

// ===== Password Hashing =====

const passwordsSchema = {
  hashAlgorithm: config.enum('AUTH_HASH_ALGORITHM', ['bcrypt', 'argon2id'] as const, 'bcrypt'),
  bcryptRounds: config.number('AUTH_BCRYPT_ROUNDS', 10),
} as const

// ===== Rate Limiting =====

const rateLimitSchema = {
  maxAttempts: config.number('AUTH_RATE_LIMIT_MAX_ATTEMPTS', 5),
  decaySeconds: config.number('AUTH_RATE_LIMIT_DECAY_SECONDS', 60),
} as const

// ===== Token Guard =====

const tokenSchema = {
  ttl: config.number('AUTH_TOKEN_TTL', 86400),
} as const

export const authConfig = defineNestedConfig({
  defaults: defaultsSchema,
  passwords: passwordsSchema,
  rateLimit: rateLimitSchema,
  token: tokenSchema,
})

export type AuthConfig = typeof authConfig

export default authConfig
