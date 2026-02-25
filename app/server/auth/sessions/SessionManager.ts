/**
 * FluxStack Auth - Session Manager
 *
 * Gerencia sessões de usuários usando o cache system modular.
 * Cada sessão é um registro no cache com TTL automático.
 *
 * ```ts
 * const sessionId = await sessionManager.create({ userId: 1 })
 * const data = await sessionManager.read(sessionId)
 * await sessionManager.destroy(sessionId)
 * ```
 */

import type { CacheDriver } from '@server/cache/contracts'
import { cacheManager } from '@server/cache'

export interface SessionData {
  [key: string]: unknown
}

export interface SessionConfig {
  /** Tempo de vida da sessão em segundos (default: 7200 = 2h) */
  lifetime: number
  /** Nome do cookie (default: 'fluxstack_session') */
  cookieName: string
  /** Cookie httpOnly (default: true) */
  httpOnly: boolean
  /** Cookie secure (default: false em dev, true em prod) */
  secure: boolean
  /** Cookie sameSite (default: 'lax') */
  sameSite: 'strict' | 'lax' | 'none'
  /** Cookie path (default: '/') */
  path: string
  /** Cookie domain (default: undefined = current domain) */
  domain?: string
}

const DEFAULT_CONFIG: SessionConfig = {
  lifetime: 7200,
  cookieName: 'fluxstack_session',
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/',
}

export class SessionManager {
  private cache: CacheDriver
  private config: SessionConfig

  constructor(cache?: CacheDriver, config?: Partial<SessionConfig>) {
    this.cache = cache ?? cacheManager.driver()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Cria uma nova sessão e retorna o ID.
   */
  async create(data: SessionData = {}): Promise<string> {
    const sessionId = this.generateId()
    await this.cache.set(
      this.cacheKey(sessionId),
      { ...data, _createdAt: Date.now() },
      this.config.lifetime
    )
    return sessionId
  }

  /**
   * Lê os dados de uma sessão.
   */
  async read(sessionId: string): Promise<SessionData | null> {
    return this.cache.get<SessionData>(this.cacheKey(sessionId))
  }

  /**
   * Atualiza os dados de uma sessão (merge com dados existentes).
   */
  async update(sessionId: string, data: SessionData): Promise<void> {
    const existing = await this.read(sessionId)
    if (!existing) return

    await this.cache.set(
      this.cacheKey(sessionId),
      { ...existing, ...data },
      this.config.lifetime
    )
  }

  /**
   * Define um valor específico na sessão.
   */
  async put(sessionId: string, key: string, value: unknown): Promise<void> {
    const existing = await this.read(sessionId)
    if (!existing) return

    existing[key] = value
    await this.cache.set(
      this.cacheKey(sessionId),
      existing,
      this.config.lifetime
    )
  }

  /**
   * Remove um valor específico da sessão.
   */
  async forget(sessionId: string, key: string): Promise<void> {
    const existing = await this.read(sessionId)
    if (!existing) return

    delete existing[key]
    await this.cache.set(
      this.cacheKey(sessionId),
      existing,
      this.config.lifetime
    )
  }

  /**
   * Destroi uma sessão.
   */
  async destroy(sessionId: string): Promise<void> {
    await this.cache.delete(this.cacheKey(sessionId))
  }

  /**
   * Regenera o ID da sessão (mantém os dados).
   * Importante após login para prevenir session fixation.
   */
  async regenerate(oldSessionId: string): Promise<string> {
    const data = await this.read(oldSessionId)
    await this.destroy(oldSessionId)

    const newSessionId = this.generateId()
    if (data) {
      await this.cache.set(
        this.cacheKey(newSessionId),
        data,
        this.config.lifetime
      )
    }
    return newSessionId
  }

  /** Retorna a configuração de sessão */
  getConfig(): SessionConfig {
    return this.config
  }

  /** Gera um session ID criptograficamente seguro */
  private generateId(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /** Chave no cache para a sessão */
  private cacheKey(sessionId: string): string {
    return `session:${sessionId}`
  }
}
