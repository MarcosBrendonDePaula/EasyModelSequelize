// 🔒 FluxStack Live Components - Auth Manager
//
// Gerencia providers de autenticação e executa verificações de auth.
// Singleton global usado pelo ComponentRegistry e WebSocket plugin.

import type {
  LiveAuthProvider,
  LiveAuthCredentials,
  LiveAuthContext,
  LiveComponentAuth,
  LiveActionAuth,
  LiveAuthResult,
} from './types'
import { AuthenticatedContext, ANONYMOUS_CONTEXT } from './LiveAuthContext'

export class LiveAuthManager {
  private providers = new Map<string, LiveAuthProvider>()
  private defaultProviderName?: string

  /**
   * Registra um provider de autenticação.
   *
   * @example
   * liveAuthManager.register(new JWTAuthProvider({ secret: 'my-secret' }))
   * liveAuthManager.register(new CryptoAuthProvider())
   */
  register(provider: LiveAuthProvider): void {
    this.providers.set(provider.name, provider)

    // Primeiro provider registrado é o default
    if (!this.defaultProviderName) {
      this.defaultProviderName = provider.name
    }

    console.log(`🔒 Live Auth provider registered: ${provider.name}`)
  }

  /**
   * Remove um provider de autenticação.
   */
  unregister(name: string): void {
    this.providers.delete(name)
    if (this.defaultProviderName === name) {
      this.defaultProviderName = this.providers.keys().next().value
    }
  }

  /**
   * Define o provider padrão para autenticação.
   */
  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Auth provider '${name}' not registered`)
    }
    this.defaultProviderName = name
  }

  /**
   * Retorna true se há pelo menos um provider registrado.
   */
  hasProviders(): boolean {
    return this.providers.size > 0
  }

  /**
   * Retorna o provider padrão ou undefined se nenhum registrado.
   */
  getDefaultProvider(): LiveAuthProvider | undefined {
    if (!this.defaultProviderName) return undefined
    return this.providers.get(this.defaultProviderName)
  }

  /**
   * Autentica credenciais usando o provider especificado, ou tenta todos os providers.
   * Retorna ANONYMOUS_CONTEXT se nenhuma credencial é fornecida ou nenhum provider existe.
   */
  async authenticate(
    credentials: LiveAuthCredentials,
    providerName?: string
  ): Promise<LiveAuthContext> {
    // Sem credenciais = anônimo
    if (!credentials || Object.keys(credentials).every(k => !credentials[k])) {
      return ANONYMOUS_CONTEXT
    }

    // Sem providers = anônimo (auth não está configurada)
    if (this.providers.size === 0) {
      return ANONYMOUS_CONTEXT
    }

    // Se provider específico solicitado, usar apenas ele
    if (providerName) {
      const provider = this.providers.get(providerName)
      if (!provider) {
        console.warn(`🔒 Auth provider '${providerName}' not found`)
        return ANONYMOUS_CONTEXT
      }
      try {
        const context = await provider.authenticate(credentials)
        return context || ANONYMOUS_CONTEXT
      } catch (error: any) {
        console.error(`🔒 Auth failed via '${providerName}':`, error.message)
        return ANONYMOUS_CONTEXT
      }
    }

    // Tentar todos os providers (default primeiro, depois os outros)
    const providersToTry: LiveAuthProvider[] = []

    // Default provider primeiro
    if (this.defaultProviderName) {
      const defaultProvider = this.providers.get(this.defaultProviderName)
      if (defaultProvider) providersToTry.push(defaultProvider)
    }

    // Adicionar outros providers
    for (const [name, provider] of this.providers) {
      if (name !== this.defaultProviderName) {
        providersToTry.push(provider)
      }
    }

    // Tentar cada provider
    for (const provider of providersToTry) {
      try {
        const context = await provider.authenticate(credentials)
        if (context && context.authenticated) {
          console.log(`🔒 Authenticated via provider: ${provider.name}`)
          return context
        }
      } catch (error: any) {
        // Silently continue to next provider
      }
    }

    return ANONYMOUS_CONTEXT
  }

  /**
   * Verifica se o contexto de auth atende aos requisitos do componente.
   * Usado pelo ComponentRegistry antes de montar um componente.
   */
  authorizeComponent(
    authContext: LiveAuthContext,
    authConfig: LiveComponentAuth | undefined
  ): LiveAuthResult {
    // Sem config de auth = permitido
    if (!authConfig) {
      return { allowed: true }
    }

    // Auth required?
    if (authConfig.required && !authContext.authenticated) {
      return {
        allowed: false,
        reason: 'Authentication required'
      }
    }

    // Verificar roles (OR logic - qualquer role basta)
    if (authConfig.roles?.length) {
      if (!authContext.authenticated) {
        return {
          allowed: false,
          reason: `Authentication required. Roles needed: ${authConfig.roles.join(', ')}`
        }
      }
      if (!authContext.hasAnyRole(authConfig.roles)) {
        return {
          allowed: false,
          reason: `Insufficient roles. Required one of: ${authConfig.roles.join(', ')}`
        }
      }
    }

    // Verificar permissions (AND logic - todas devem estar presentes)
    if (authConfig.permissions?.length) {
      if (!authContext.authenticated) {
        return {
          allowed: false,
          reason: `Authentication required. Permissions needed: ${authConfig.permissions.join(', ')}`
        }
      }
      if (!authContext.hasAllPermissions(authConfig.permissions)) {
        return {
          allowed: false,
          reason: `Insufficient permissions. Required all: ${authConfig.permissions.join(', ')}`
        }
      }
    }

    return { allowed: true }
  }

  /**
   * Verifica se o contexto de auth permite executar uma action específica.
   * Usado pelo ComponentRegistry antes de executar uma action.
   */
  async authorizeAction(
    authContext: LiveAuthContext,
    componentName: string,
    action: string,
    actionAuth: LiveActionAuth | undefined,
    providerName?: string
  ): Promise<LiveAuthResult> {
    // Sem config de auth para esta action = permitido
    if (!actionAuth) {
      return { allowed: true }
    }

    // Verificar roles (OR logic)
    if (actionAuth.roles?.length) {
      if (!authContext.authenticated) {
        return {
          allowed: false,
          reason: `Authentication required for action '${action}'`
        }
      }
      if (!authContext.hasAnyRole(actionAuth.roles)) {
        return {
          allowed: false,
          reason: `Insufficient roles for action '${action}'. Required one of: ${actionAuth.roles.join(', ')}`
        }
      }
    }

    // Verificar permissions (AND logic)
    if (actionAuth.permissions?.length) {
      if (!authContext.authenticated) {
        return {
          allowed: false,
          reason: `Authentication required for action '${action}'`
        }
      }
      if (!authContext.hasAllPermissions(actionAuth.permissions)) {
        return {
          allowed: false,
          reason: `Insufficient permissions for action '${action}'. Required all: ${actionAuth.permissions.join(', ')}`
        }
      }
    }

    // Verificar via provider customizado (se implementado)
    const name = providerName || this.defaultProviderName
    if (name) {
      const provider = this.providers.get(name)
      if (provider?.authorizeAction) {
        const allowed = await provider.authorizeAction(authContext, componentName, action)
        if (!allowed) {
          return {
            allowed: false,
            reason: `Action '${action}' denied by auth provider '${name}'`
          }
        }
      }
    }

    return { allowed: true }
  }

  /**
   * Verifica se o contexto de auth permite entrar em uma sala.
   */
  async authorizeRoom(
    authContext: LiveAuthContext,
    roomId: string,
    providerName?: string
  ): Promise<LiveAuthResult> {
    const name = providerName || this.defaultProviderName
    if (!name) return { allowed: true }

    const provider = this.providers.get(name)
    if (!provider?.authorizeRoom) return { allowed: true }

    try {
      const allowed = await provider.authorizeRoom(authContext, roomId)
      if (!allowed) {
        return {
          allowed: false,
          reason: `Access to room '${roomId}' denied by auth provider '${name}'`
        }
      }
      return { allowed: true }
    } catch (error: any) {
      return {
        allowed: false,
        reason: `Room authorization error: ${error.message}`
      }
    }
  }

  /**
   * Retorna informações sobre os providers registrados.
   */
  getInfo(): { providers: string[]; defaultProvider?: string } {
    return {
      providers: Array.from(this.providers.keys()),
      defaultProvider: this.defaultProviderName,
    }
  }
}

/** Instância global do auth manager */
export const liveAuthManager = new LiveAuthManager()
