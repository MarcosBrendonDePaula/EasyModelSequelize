/**
 * FluxStack Cache System - Contracts
 *
 * Interface modular para cache. Hoje usa memória do processo,
 * amanhã pode trocar para Redis, Memcached, SQLite, etc.
 *
 * Inspirado no Cache do Laravel: driver swappable via config.
 */

/**
 * Interface que todo driver de cache deve implementar.
 *
 * Para criar um driver customizado (ex: Redis):
 * ```ts
 * class RedisCacheDriver implements CacheDriver {
 *   async get(key) { return redis.get(key) }
 *   async set(key, value, ttl) { redis.setex(key, ttl, value) }
 *   // ...
 * }
 * ```
 */
export interface CacheDriver {
  /** Busca valor do cache. Retorna null se não existe ou expirou. */
  get<T = unknown>(key: string): Promise<T | null>

  /** Armazena valor no cache. TTL em segundos (0 = sem expiração). */
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>

  /** Verifica se a chave existe no cache. */
  has(key: string): Promise<boolean>

  /** Remove uma chave do cache. */
  delete(key: string): Promise<boolean>

  /** Remove todas as chaves do cache. */
  flush(): Promise<void>

  /** Incrementa um valor numérico. Retorna o novo valor. */
  increment(key: string, amount?: number): Promise<number>

  /** Decrementa um valor numérico. Retorna o novo valor. */
  decrement(key: string, amount?: number): Promise<number>

  /** Busca ou armazena: se não existe, executa callback e salva. */
  remember<T = unknown>(key: string, ttlSeconds: number, callback: () => Promise<T>): Promise<T>

  /** Remove entradas expiradas (garbage collection). */
  gc(): Promise<void>
}
