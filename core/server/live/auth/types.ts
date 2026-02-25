// 🔒 FluxStack Live Components - Authentication Types
//
// Sistema declarativo de autenticação para Live Components.
// Permite que devs configurem auth por componente e por action.
//
// Uso no componente:
//   class AdminChat extends LiveComponent<State> {
//     static auth: LiveComponentAuth = {
//       required: true,
//       roles: ['admin', 'moderator'],
//     }
//
//     static actionAuth: LiveActionAuthMap = {
//       deleteMessage: { permissions: ['chat.admin'] },
//       sendMessage: { permissions: ['chat.write'] },
//     }
//   }

// ===== Credenciais enviadas pelo cliente =====

/**
 * Credenciais enviadas pelo cliente durante a autenticação WebSocket.
 * Extensível para suportar qualquer estratégia de auth (JWT, API key, crypto, etc.)
 */
export interface LiveAuthCredentials {
  /** JWT ou token opaco */
  token?: string
  /** Chave pública (para crypto-auth) */
  publicKey?: string
  /** Assinatura (para crypto-auth) */
  signature?: string
  /** Timestamp da assinatura */
  timestamp?: number
  /** Nonce anti-replay */
  nonce?: string
  /** Campos adicionais para providers customizados */
  [key: string]: unknown
}

// ===== Usuário autenticado =====

/**
 * Informações do usuário autenticado.
 * Retornado pelo LiveAuthProvider após validação.
 */
export interface LiveAuthUser {
  /** Identificador único do usuário */
  id: string
  /** Roles atribuídas ao usuário (ex: 'admin', 'moderator') */
  roles?: string[]
  /** Permissões granulares (ex: 'chat.write', 'chat.admin') */
  permissions?: string[]
  /** Campos adicionais (nome, email, etc.) */
  [key: string]: unknown
}

// ===== Contexto de autenticação =====

/**
 * Contexto de autenticação disponível dentro do LiveComponent via this.$auth.
 * Fornece helpers para verificação de roles e permissões.
 */
export interface LiveAuthContext {
  /** Se o usuário está autenticado */
  readonly authenticated: boolean
  /** Dados do usuário (undefined se não autenticado) */
  readonly user?: LiveAuthUser
  /** Token original usado para autenticação */
  readonly token?: string
  /** Timestamp de quando a autenticação ocorreu */
  readonly authenticatedAt?: number

  /** Verifica se o usuário possui uma role específica */
  hasRole(role: string): boolean
  /** Verifica se o usuário possui QUALQUER uma das roles */
  hasAnyRole(roles: string[]): boolean
  /** Verifica se o usuário possui TODAS as roles */
  hasAllRoles(roles: string[]): boolean
  /** Verifica se o usuário possui uma permissão específica */
  hasPermission(permission: string): boolean
  /** Verifica se o usuário possui TODAS as permissões */
  hasAllPermissions(permissions: string[]): boolean
  /** Verifica se o usuário possui QUALQUER uma das permissões */
  hasAnyPermission(permissions: string[]): boolean
}

// ===== Provider de autenticação =====

/**
 * Interface para implementação de estratégias de autenticação.
 * Cada provider implementa sua própria lógica de validação.
 *
 * Exemplos: JWTAuthProvider, CryptoAuthProvider, SessionAuthProvider
 */
export interface LiveAuthProvider {
  /** Nome único do provider (ex: 'jwt', 'crypto', 'session') */
  readonly name: string

  /**
   * Valida credenciais e retorna contexto de autenticação.
   * Retorna null se as credenciais forem inválidas.
   */
  authenticate(credentials: LiveAuthCredentials): Promise<LiveAuthContext | null>

  /**
   * (Opcional) Autorização customizada por action.
   * Retorna true se o usuário pode executar a action.
   * Se não implementado, usa a lógica padrão de roles/permissions.
   */
  authorizeAction?(
    context: LiveAuthContext,
    componentName: string,
    action: string
  ): Promise<boolean>

  /**
   * (Opcional) Autorização customizada por sala.
   * Retorna true se o usuário pode entrar na sala.
   */
  authorizeRoom?(
    context: LiveAuthContext,
    roomId: string
  ): Promise<boolean>
}

// ===== Configuração de auth no componente =====

/**
 * Configuração de autenticação declarativa no LiveComponent.
 * Definida como propriedade estática na classe.
 *
 * @example
 * class ProtectedChat extends LiveComponent<State> {
 *   static auth: LiveComponentAuth = {
 *     required: true,
 *     roles: ['user'],
 *     permissions: ['chat.read'],
 *   }
 * }
 */
export interface LiveComponentAuth {
  /** Se autenticação é obrigatória para montar o componente. Default: false */
  required?: boolean
  /** Roles necessárias (lógica OR - qualquer uma das roles basta) */
  roles?: string[]
  /** Permissões necessárias (lógica AND - todas devem estar presentes) */
  permissions?: string[]
}

/**
 * Configuração de auth por action individual.
 *
 * @example
 * static actionAuth: LiveActionAuthMap = {
 *   deleteMessage: { permissions: ['chat.admin'] },
 *   banUser: { roles: ['admin'] },
 * }
 */
export interface LiveActionAuth {
  /** Roles necessárias para esta action (lógica OR) */
  roles?: string[]
  /** Permissões necessárias para esta action (lógica AND) */
  permissions?: string[]
}

/** Mapa de action name → configuração de auth */
export type LiveActionAuthMap = Record<string, LiveActionAuth>

// ===== Resultado de autorização =====

/**
 * Resultado de uma verificação de autorização.
 */
export interface LiveAuthResult {
  /** Se a autorização foi bem-sucedida */
  allowed: boolean
  /** Motivo da negação (se allowed === false) */
  reason?: string
}
