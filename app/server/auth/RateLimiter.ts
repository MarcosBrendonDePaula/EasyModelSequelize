/**
 * FluxStack Auth - Rate Limiter
 *
 * Proteção contra brute-force. Usa o cache system modular.
 * Inspirado no RateLimiter do Laravel (por chave: email+ip).
 *
 * ```ts
 * const key = `login:${email}|${ip}`
 * if (await rateLimiter.tooManyAttempts(key, 5)) {
 *   const seconds = await rateLimiter.availableIn(key)
 *   return { error: `Too many attempts. Try again in ${seconds}s` }
 * }
 * ```
 */

import type { CacheDriver } from '@server/cache/contracts'

interface RateLimitEntry {
  count: number
  expiresAt: number
}

export class RateLimiter {
  private cache: CacheDriver

  constructor(cache: CacheDriver) {
    this.cache = cache
  }

  /**
   * Registra uma tentativa para a chave.
   * @param key Chave identificadora (ex: 'login:user@email.com|127.0.0.1')
   * @param decaySeconds Tempo em segundos até o contador resetar
   */
  async hit(key: string, decaySeconds: number = 60): Promise<number> {
    const cacheKey = `rate_limit:${key}`
    const entry = await this.cache.get<RateLimitEntry>(cacheKey)
    const now = Date.now()

    if (entry && entry.expiresAt > now) {
      // Incrementar contador existente
      const updated: RateLimitEntry = {
        count: entry.count + 1,
        expiresAt: entry.expiresAt,
      }
      const remainingTtl = Math.ceil((entry.expiresAt - now) / 1000)
      await this.cache.set(cacheKey, updated, remainingTtl)
      return updated.count
    }

    // Nova entrada
    const newEntry: RateLimitEntry = {
      count: 1,
      expiresAt: now + (decaySeconds * 1000),
    }
    await this.cache.set(cacheKey, newEntry, decaySeconds)
    return 1
  }

  /**
   * Verifica se a chave excedeu o limite de tentativas.
   */
  async tooManyAttempts(key: string, maxAttempts: number): Promise<boolean> {
    const attempts = await this.attempts(key)
    return attempts >= maxAttempts
  }

  /**
   * Retorna o número atual de tentativas para a chave.
   */
  async attempts(key: string): Promise<number> {
    const cacheKey = `rate_limit:${key}`
    const entry = await this.cache.get<RateLimitEntry>(cacheKey)

    if (!entry) return 0
    if (entry.expiresAt < Date.now()) return 0

    return entry.count
  }

  /**
   * Retorna quantos segundos até o rate limit expirar.
   */
  async availableIn(key: string): Promise<number> {
    const cacheKey = `rate_limit:${key}`
    const entry = await this.cache.get<RateLimitEntry>(cacheKey)

    if (!entry) return 0
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000))
  }

  /**
   * Retorna quantas tentativas restam.
   */
  async remainingAttempts(key: string, maxAttempts: number): Promise<number> {
    const attempts = await this.attempts(key)
    return Math.max(0, maxAttempts - attempts)
  }

  /**
   * Limpa o rate limit para a chave (após login bem-sucedido).
   */
  async clear(key: string): Promise<void> {
    await this.cache.delete(`rate_limit:${key}`)
  }
}
