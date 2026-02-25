/**
 * FluxStack Cache - Memory Driver
 *
 * Armazena cache na memória do processo.
 * Ideal para desenvolvimento e testes.
 *
 * Para produção, troque por Redis, Memcached, etc.
 */

import type { CacheDriver } from './contracts'

interface CacheEntry<T = unknown> {
  value: T
  expiresAt: number | null // null = sem expiração
}

export class MemoryCacheDriver implements CacheDriver {
  private store = new Map<string, CacheEntry>()
  private gcInterval: ReturnType<typeof setInterval> | null = null

  constructor(gcIntervalMs: number = 60_000) {
    // GC periódico para limpar entradas expiradas
    this.gcInterval = setInterval(() => this.gc(), gcIntervalMs)
    if (this.gcInterval.unref) {
      this.gcInterval.unref()
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    // Verificar expiração
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.value as T
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds && ttlSeconds > 0
      ? Date.now() + (ttlSeconds * 1000)
      : null

    this.store.set(key, { value, expiresAt })
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key)
  }

  async flush(): Promise<void> {
    this.store.clear()
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const current = await this.get<number>(key)
    const newValue = (current ?? 0) + amount

    // Preservar TTL original se existir
    const entry = this.store.get(key)
    const remainingTtl = entry?.expiresAt
      ? Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000))
      : undefined

    await this.set(key, newValue, remainingTtl)
    return newValue
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount)
  }

  async remember<T = unknown>(key: string, ttlSeconds: number, callback: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached

    const value = await callback()
    await this.set(key, value, ttlSeconds)
    return value
  }

  async gc(): Promise<void> {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }

  /** Para testes: retorna quantidade de itens no cache */
  get size(): number {
    return this.store.size
  }

  /** Cleanup ao destruir */
  destroy(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval)
      this.gcInterval = null
    }
    this.store.clear()
  }
}
