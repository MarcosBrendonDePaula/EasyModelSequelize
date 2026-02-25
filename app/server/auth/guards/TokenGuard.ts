/**
 * FluxStack Auth - Token Guard
 *
 * Guard baseado em Bearer token (header Authorization).
 * Para APIs consumidas por mobile apps, CLIs, integrações.
 *
 * Fluxo:
 * 1. Client envia: Authorization: Bearer <token>
 * 2. Guard busca user pelo token no provider
 * 3. Se válido, user está autenticado
 *
 * Tokens são armazenados no cache com referência ao userId.
 */

import type {
  Guard,
  Authenticatable,
  UserProvider,
  RequestContext,
} from '../contracts'
import type { CacheDriver } from '@server/cache/contracts'

interface StoredToken {
  userId: string | number
  createdAt: number
  expiresAt: number | null
}

export class TokenGuard implements Guard {
  readonly name: string
  private provider: UserProvider
  private cache: CacheDriver
  private request: RequestContext | null = null
  private tokenTtl: number

  /** Cache do usuário para a request atual */
  private resolvedUser: Authenticatable | null | undefined = undefined

  constructor(
    name: string,
    provider: UserProvider,
    cache: CacheDriver,
    tokenTtlSeconds: number = 86400 // 24h default
  ) {
    this.name = name
    this.provider = provider
    this.cache = cache
    this.tokenTtl = tokenTtlSeconds
  }

  setRequest(context: RequestContext): void {
    this.request = context
    this.resolvedUser = undefined
  }

  async user(): Promise<Authenticatable | null> {
    if (this.resolvedUser !== undefined) {
      return this.resolvedUser
    }

    this.resolvedUser = null

    if (!this.request) return null

    // 1. Extrair token do header Authorization
    const token = this.getBearerToken()
    if (!token) return null

    // 2. Buscar token no cache
    const tokenData = await this.cache.get<StoredToken>(`auth_token:${this.hashToken(token)}`)
    if (!tokenData) return null

    // 3. Verificar expiração
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
      await this.cache.delete(`auth_token:${this.hashToken(token)}`)
      return null
    }

    // 4. Buscar usuário
    const user = await this.provider.retrieveById(tokenData.userId)
    if (user) {
      this.resolvedUser = user
    }

    return this.resolvedUser
  }

  async id(): Promise<string | number | null> {
    const user = await this.user()
    return user?.getAuthId() ?? null
  }

  async check(): Promise<boolean> {
    return (await this.user()) !== null
  }

  async guest(): Promise<boolean> {
    return (await this.user()) === null
  }

  async attempt(credentials: Record<string, unknown>): Promise<Authenticatable | null> {
    // 1. Buscar user
    const user = await this.provider.retrieveByCredentials(credentials)
    if (!user) return null

    // 2. Validar password
    const valid = await this.provider.validateCredentials(user, credentials)
    if (!valid) return null

    // 3. Gerar e armazenar token
    await this.login(user)

    return user
  }

  async login(user: Authenticatable): Promise<void> {
    // Gerar token
    const token = this.generateToken()
    const hashedToken = this.hashToken(token)

    // Armazenar no cache
    const tokenData: StoredToken = {
      userId: user.getAuthId(),
      createdAt: Date.now(),
      expiresAt: this.tokenTtl > 0 ? Date.now() + (this.tokenTtl * 1000) : null,
    }
    await this.cache.set(`auth_token:${hashedToken}`, tokenData, this.tokenTtl || undefined)

    // Armazenar lista de tokens do user (para revogação em massa)
    const userTokensKey = `user_tokens:${user.getAuthId()}`
    const existingTokens = await this.cache.get<string[]>(userTokensKey) ?? []
    existingTokens.push(hashedToken)
    await this.cache.set(userTokensKey, existingTokens)

    // Cache do user
    this.resolvedUser = user

    // Salvar token plain-text temporariamente para a response poder retorná-lo
    ;(this as any)._lastGeneratedToken = token
  }

  async logout(): Promise<void> {
    if (!this.request) return

    const token = this.getBearerToken()
    if (token) {
      await this.cache.delete(`auth_token:${this.hashToken(token)}`)
    }

    this.resolvedUser = null
  }

  async validate(credentials: Record<string, unknown>): Promise<boolean> {
    const user = await this.provider.retrieveByCredentials(credentials)
    if (!user) return false
    return this.provider.validateCredentials(user, credentials)
  }

  /**
   * Revoga todos os tokens de um usuário.
   */
  async revokeAllTokens(userId: string | number): Promise<void> {
    const userTokensKey = `user_tokens:${userId}`
    const tokens = await this.cache.get<string[]>(userTokensKey) ?? []

    for (const hashedToken of tokens) {
      await this.cache.delete(`auth_token:${hashedToken}`)
    }
    await this.cache.delete(userTokensKey)
  }

  /** Retorna o último token gerado (para a response após login) */
  getLastGeneratedToken(): string | null {
    return (this as any)._lastGeneratedToken ?? null
  }

  /** Extrai Bearer token do header Authorization */
  private getBearerToken(): string | null {
    if (!this.request) return null

    const authHeader = this.request.headers['authorization'] ?? this.request.headers['Authorization']
    if (!authHeader?.startsWith('Bearer ')) return null

    return authHeader.slice(7)
  }

  /** Gera um token criptograficamente seguro */
  private generateToken(): string {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /** Hash do token para armazenamento (nunca guardar plain-text) */
  private hashToken(token: string): string {
    const hasher = new Bun.CryptoHasher('sha256')
    hasher.update(token)
    return hasher.digest('hex')
  }
}
