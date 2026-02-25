/**
 * FluxStack Auth System - Contracts
 *
 * Inspirado no Laravel: Guard + Provider + Authenticatable.
 * - Guard: COMO autenticar (session, token, JWT...)
 * - UserProvider: ONDE buscar os usuários (memória, banco, API...)
 * - Authenticatable: O QUE é um usuário autenticável
 *
 * Adaptado para API-only (sem HTML, sem redirects, sem CSRF).
 */

// ===== Authenticatable =====

/**
 * Interface que define o que é um "usuário autenticável".
 * Qualquer model/entidade que implemente isso pode ser usada com o auth system.
 *
 * Para usar com seu ORM:
 * ```ts
 * class User implements Authenticatable {
 *   getAuthId() { return this.id }
 *   getAuthPassword() { return this.passwordHash }
 *   // ...
 * }
 * ```
 */
export interface Authenticatable {
  /** Retorna o identificador único (ex: id, uuid) */
  getAuthId(): string | number

  /** Retorna o nome do campo identificador (ex: 'id') */
  getAuthIdField(): string

  /** Retorna o hash da password armazenada */
  getAuthPassword(): string

  /** Retorna o token de "remember me" (ou null) */
  getRememberToken(): string | null

  /** Define o token de "remember me" */
  setRememberToken(token: string | null): void

  /** Retorna dados serializáveis do usuário (para response da API) */
  toJSON(): Record<string, unknown>
}

// ===== UserProvider =====

/**
 * Interface para buscar e validar usuários.
 * O provider NÃO sabe como autenticar - apenas onde os dados estão.
 *
 * Para implementar com banco de dados:
 * ```ts
 * class DrizzleUserProvider implements UserProvider {
 *   async retrieveById(id) { return db.select().from(users).where(eq(users.id, id)) }
 *   async retrieveByCredentials({ email }) { return db.select().from(users).where(eq(users.email, email)) }
 *   async validateCredentials(user, { password }) { return Hash.check(password, user.getAuthPassword()) }
 * }
 * ```
 */
export interface UserProvider {
  /** Busca usuário pelo ID */
  retrieveById(id: string | number): Promise<Authenticatable | null>

  /**
   * Busca usuário pelas credenciais (SEM a password).
   * Ex: { email: "user@example.com" } → busca por email.
   * A password é validada separadamente em validateCredentials().
   */
  retrieveByCredentials(credentials: Record<string, unknown>): Promise<Authenticatable | null>

  /**
   * Valida a password contra o hash do usuário.
   * Recebe o user já encontrado + as credenciais originais (com password).
   */
  validateCredentials(user: Authenticatable, credentials: Record<string, unknown>): Promise<boolean>

  /** Busca usuário pelo remember token */
  retrieveByToken(id: string | number, token: string): Promise<Authenticatable | null>

  /** Atualiza o remember token do usuário */
  updateRememberToken(user: Authenticatable, token: string | null): Promise<void>

  /** Cria um novo usuário (para registro) */
  createUser(data: Record<string, unknown>): Promise<Authenticatable>
}

// ===== Guard =====

/**
 * Interface do guard de autenticação.
 * O guard sabe COMO autenticar (session cookie, bearer token, etc).
 *
 * Para criar um guard customizado:
 * ```ts
 * class JWTGuard implements Guard {
 *   async user() { /* decode JWT from header *\/ }
 *   async attempt(creds) { /* validate + generate JWT *\/ }
 * }
 * authManager.extend('jwt', (config) => new JWTGuard(config))
 * ```
 */
export interface Guard {
  /** Nome do guard */
  readonly name: string

  /** Retorna o usuário autenticado ou null */
  user(): Promise<Authenticatable | null>

  /** Retorna o ID do usuário autenticado ou null */
  id(): Promise<string | number | null>

  /** Verifica se há um usuário autenticado */
  check(): Promise<boolean>

  /** Verifica se NÃO há usuário autenticado */
  guest(): Promise<boolean>

  /**
   * Tenta autenticar com credenciais.
   * Retorna o usuário se sucesso, null se falha.
   */
  attempt(credentials: Record<string, unknown>, remember?: boolean): Promise<Authenticatable | null>

  /** Autentica um usuário diretamente (sem validar credenciais) */
  login(user: Authenticatable, remember?: boolean): Promise<void>

  /** Desloga o usuário atual */
  logout(): Promise<void>

  /**
   * Valida credenciais SEM efetuar login.
   * Útil para confirmar password antes de ações sensíveis.
   */
  validate(credentials: Record<string, unknown>): Promise<boolean>

  /**
   * Inicializa o guard com o contexto da request atual.
   * Chamado pelo middleware antes de qualquer operação.
   */
  setRequest(context: RequestContext): void
}

// ===== Request Context =====

/**
 * Contexto da request disponível para os guards.
 * Abstrai o acesso a headers, cookies, etc.
 */
export interface RequestContext {
  /** Headers da request */
  headers: Record<string, string | undefined>

  /** Cookies da request */
  cookie: Record<string, { value: string; set: (opts: CookieOptions) => void } | undefined>

  /** Setter para cookies na response */
  setCookie: (name: string, value: string, options?: CookieOptions) => void

  /** Remove um cookie */
  removeCookie: (name: string) => void

  /** IP da request (para rate limiting) */
  ip: string
}

/** Opções para cookies */
export interface CookieOptions {
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  path?: string
  domain?: string
}

// ===== Guard Factory =====

/** Config de um guard individual */
export interface GuardConfig {
  driver: string
  provider: string
  [key: string]: unknown
}

/** Factory function para criar guards customizados */
export type GuardFactory = (
  name: string,
  config: GuardConfig,
  provider: UserProvider
) => Guard
