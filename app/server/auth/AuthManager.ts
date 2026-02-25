/**
 * FluxStack Auth - Auth Manager
 *
 * Orquestrador central do sistema de autenticação.
 * Factory pattern com lazy resolution e cache de guards.
 *
 * Inspirado no AuthManager do Laravel:
 * - Resolve guards por nome (ou default)
 * - Extensível com extend() para guards customizados
 * - Resolve providers automaticamente da config
 *
 * ```ts
 * // Usar guard padrão
 * const user = await auth.guard().user()
 *
 * // Usar guard específico
 * const apiUser = await auth.guard('api').user()
 *
 * // Registrar guard customizado
 * auth.extend('jwt', (name, config, provider) => new JWTGuard(...))
 * ```
 */

import type {
  Guard,
  UserProvider,
  GuardConfig,
  GuardFactory,
  RequestContext,
} from './contracts'
import { SessionGuard } from './guards/SessionGuard'
import { TokenGuard } from './guards/TokenGuard'
import { SessionManager } from './sessions/SessionManager'
import { cacheManager } from '@server/cache'

export interface AuthManagerConfig {
  defaults: {
    guard: string
    provider: string
  }
  guards: Record<string, GuardConfig>
  providers: Record<string, ProviderConfig>
}

export interface ProviderConfig {
  driver: string
  [key: string]: unknown
}

export class AuthManager {
  private config: AuthManagerConfig
  private guards = new Map<string, Guard>()
  private customGuardFactories = new Map<string, GuardFactory>()
  private providerInstances = new Map<string, UserProvider>()
  private customProviderFactories = new Map<string, (config: ProviderConfig) => UserProvider>()
  private sessionManager: SessionManager

  constructor(config: AuthManagerConfig, sessionManager: SessionManager) {
    this.config = config
    this.sessionManager = sessionManager
  }

  /**
   * Retorna um guard por nome (ou o default).
   * Guards são criados uma vez e reutilizados.
   */
  guard(name?: string): Guard {
    const guardName = name ?? this.config.defaults.guard

    if (this.guards.has(guardName)) {
      return this.guards.get(guardName)!
    }

    const guard = this.resolve(guardName)
    this.guards.set(guardName, guard)
    return guard
  }

  /**
   * Inicializa todos os guards com o contexto da request.
   * Deve ser chamado no middleware, antes de qualquer uso.
   */
  setRequest(context: RequestContext): void {
    for (const guard of this.guards.values()) {
      guard.setRequest(context)
    }
    // Também resetar guards não-instanciados para forçar re-resolve com novo context
  }

  /**
   * Cria um guard novo (sem cache) com o context da request.
   * Útil quando precisa de um guard fresco para cada request.
   */
  freshGuard(name?: string, context?: RequestContext): Guard {
    const guardName = name ?? this.config.defaults.guard
    const guard = this.resolve(guardName)
    if (context) {
      guard.setRequest(context)
    }
    return guard
  }

  /**
   * Registra um guard driver customizado.
   *
   * ```ts
   * auth.extend('jwt', (name, config, provider) => {
   *   return new JWTGuard(name, provider, config.secret)
   * })
   * ```
   */
  extend(driver: string, factory: GuardFactory): void {
    this.customGuardFactories.set(driver, factory)
  }

  /**
   * Registra um provider customizado.
   *
   * ```ts
   * auth.extendProvider('drizzle', (config) => {
   *   return new DrizzleUserProvider(db, config.table)
   * })
   * ```
   */
  extendProvider(driver: string, factory: (config: ProviderConfig) => UserProvider): void {
    this.customProviderFactories.set(driver, factory)
  }

  /**
   * Registra uma instância de provider diretamente.
   */
  registerProvider(name: string, provider: UserProvider): void {
    this.providerInstances.set(name, provider)
  }

  /** Retorna o nome do guard padrão */
  getDefaultGuardName(): string {
    return this.config.defaults.guard
  }

  /** Retorna a config */
  getConfig(): AuthManagerConfig {
    return this.config
  }

  /** Resolve um guard por nome */
  private resolve(name: string): Guard {
    const guardConfig = this.config.guards[name]
    if (!guardConfig) {
      throw new Error(
        `Auth guard '${name}' not configured. ` +
        `Available: ${Object.keys(this.config.guards).join(', ')}`
      )
    }

    // Resolver provider
    const provider = this.resolveProvider(guardConfig.provider)

    // Verificar custom factory primeiro
    if (this.customGuardFactories.has(guardConfig.driver)) {
      return this.customGuardFactories.get(guardConfig.driver)!(name, guardConfig, provider)
    }

    // Built-in drivers
    switch (guardConfig.driver) {
      case 'session':
        return new SessionGuard(name, provider, this.sessionManager)

      case 'token':
        return new TokenGuard(
          name,
          provider,
          cacheManager.driver(),
          guardConfig.tokenTtl as number | undefined
        )

      default:
        throw new Error(
          `Auth guard driver '${guardConfig.driver}' not supported. ` +
          `Use auth.extend('${guardConfig.driver}', factory) to register it.`
        )
    }
  }

  /** Resolve um provider por nome */
  private resolveProvider(name: string): UserProvider {
    // Cache de instâncias
    if (this.providerInstances.has(name)) {
      return this.providerInstances.get(name)!
    }

    const providerConfig = this.config.providers[name]
    if (!providerConfig) {
      throw new Error(
        `Auth provider '${name}' not configured. ` +
        `Available: ${Object.keys(this.config.providers).join(', ')}`
      )
    }

    // Custom factory
    if (this.customProviderFactories.has(providerConfig.driver)) {
      const provider = this.customProviderFactories.get(providerConfig.driver)!(providerConfig)
      this.providerInstances.set(name, provider)
      return provider
    }

    throw new Error(
      `Auth provider driver '${providerConfig.driver}' not supported. ` +
      `Use auth.extendProvider('${providerConfig.driver}', factory) to register it, ` +
      `or use auth.registerProvider('${name}', providerInstance) to register directly.`
    )
  }
}
