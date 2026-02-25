/**
 * FluxStack Auth - Session Guard
 *
 * Guard baseado em session cookie. Padrão para SPAs que se comunicam
 * com a API via fetch/axios (mesma origem ou CORS com credentials).
 *
 * Fluxo:
 * 1. POST /login → attempt() → valida credenciais → cria sessão → seta cookie
 * 2. Requests seguintes → cookie enviado automaticamente → user() resolve da sessão
 * 3. POST /logout → logout() → destroi sessão → remove cookie
 */

import type {
  Guard,
  Authenticatable,
  UserProvider,
  RequestContext,
} from '../contracts'
import type { SessionManager } from '../sessions/SessionManager'

export class SessionGuard implements Guard {
  readonly name: string
  private provider: UserProvider
  private sessions: SessionManager
  private request: RequestContext | null = null

  /** Cache do usuário para a request atual (evita múltiplas queries) */
  private resolvedUser: Authenticatable | null | undefined = undefined

  constructor(name: string, provider: UserProvider, sessions: SessionManager) {
    this.name = name
    this.provider = provider
    this.sessions = sessions
  }

  setRequest(context: RequestContext): void {
    this.request = context
    // Reset cache para nova request
    this.resolvedUser = undefined
  }

  async user(): Promise<Authenticatable | null> {
    // Cache per-request
    if (this.resolvedUser !== undefined) {
      return this.resolvedUser
    }

    this.resolvedUser = null

    if (!this.request) return null

    // 1. Ler session ID do cookie
    const sessionId = this.getSessionId()
    if (!sessionId) return null

    // 2. Buscar dados da sessão
    const sessionData = await this.sessions.read(sessionId)
    if (!sessionData?.userId) return null

    // 3. Buscar usuário pelo ID
    const user = await this.provider.retrieveById(sessionData.userId as string | number)
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

  async attempt(
    credentials: Record<string, unknown>,
    _remember?: boolean
  ): Promise<Authenticatable | null> {
    // 1. Buscar usuário pelas credenciais (SEM password)
    const user = await this.provider.retrieveByCredentials(credentials)
    if (!user) return null

    // 2. Validar password
    const valid = await this.provider.validateCredentials(user, credentials)
    if (!valid) return null

    // 3. Login
    await this.login(user)

    return user
  }

  async login(user: Authenticatable, _remember?: boolean): Promise<void> {
    if (!this.request) {
      throw new Error('SessionGuard: request context not set. Call setRequest() first.')
    }

    const config = this.sessions.getConfig()

    // 1. Regenerar sessão (ou criar nova) para prevenir session fixation
    const existingSessionId = this.getSessionId()
    let sessionId: string

    if (existingSessionId) {
      sessionId = await this.sessions.regenerate(existingSessionId)
    } else {
      sessionId = await this.sessions.create({})
    }

    // 2. Salvar userId na sessão
    await this.sessions.put(sessionId, 'userId', user.getAuthId())
    await this.sessions.put(sessionId, '_loginAt', Date.now())

    // 3. Setar cookie
    this.request.setCookie(config.cookieName, sessionId, {
      maxAge: config.lifetime,
      httpOnly: config.httpOnly,
      secure: config.secure,
      sameSite: config.sameSite,
      path: config.path,
      domain: config.domain,
    })

    // 4. Cache do usuário para esta request
    this.resolvedUser = user
  }

  async logout(): Promise<void> {
    if (!this.request) return

    const config = this.sessions.getConfig()
    const sessionId = this.getSessionId()

    // 1. Destroir sessão
    if (sessionId) {
      await this.sessions.destroy(sessionId)
    }

    // 2. Remover cookie
    this.request.removeCookie(config.cookieName)

    // 3. Limpar cache
    this.resolvedUser = null
  }

  async validate(credentials: Record<string, unknown>): Promise<boolean> {
    const user = await this.provider.retrieveByCredentials(credentials)
    if (!user) return false
    return this.provider.validateCredentials(user, credentials)
  }

  /** Lê o session ID do cookie */
  private getSessionId(): string | null {
    if (!this.request) return null

    const config = this.sessions.getConfig()
    const cookie = this.request.cookie[config.cookieName]
    return cookie?.value || null
  }
}
