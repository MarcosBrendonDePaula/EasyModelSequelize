/**
 * Crypto Auth Middleware Helpers
 * Funções compartilhadas para validação de autenticação
 */

import type { Logger } from '@core/utils/logger'

/**
 * Helper to safely parse request.url which might be relative or absolute
 */
function parseRequestURL(request: Request): URL {
  try {
    // Try parsing as absolute URL first
    return new URL(request.url)
  } catch {
    // If relative, use host from headers or default to localhost
    const host = request.headers.get('host') || 'localhost'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    return new URL(request.url, `${protocol}://${host}`)
  }
}

export interface CryptoAuthUser {
  publicKey: string
  isAdmin: boolean
  permissions: string[]
}

/**
 * Get auth service from global
 */
export function getAuthService() {
  const service = (global as any).cryptoAuthService
  if (!service) {
    throw new Error('CryptoAuthService not initialized. Make sure crypto-auth plugin is loaded.')
  }
  return service
}

/**
 * Get auth middleware from global
 */
export function getAuthMiddleware() {
  const middleware = (global as any).cryptoAuthMiddleware
  if (!middleware) {
    throw new Error('AuthMiddleware not initialized. Make sure crypto-auth plugin is loaded.')
  }
  return middleware
}

/**
 * Extract and validate authentication from request
 * Versão SÍNCRONA para evitar problemas com Elysia
 */
export function extractAuthHeaders(request: Request): {
  publicKey: string
  timestamp: number
  nonce: string
  signature: string
} | null {
  const headers = request.headers
  const publicKey = headers.get('x-public-key')
  const timestampStr = headers.get('x-timestamp')
  const nonce = headers.get('x-nonce')
  const signature = headers.get('x-signature')

  if (!publicKey || !timestampStr || !nonce || !signature) {
    return null
  }

  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return null
  }

  return { publicKey, timestamp, nonce, signature }
}

/**
 * Build message for signature verification
 */
export function buildMessage(request: Request): string {
  const url = parseRequestURL(request)
  return `${request.method}:${url.pathname}`
}

/**
 * Validate authentication synchronously
 */
export async function validateAuthSync(request: Request, logger?: Logger): Promise<{
  success: boolean
  user?: CryptoAuthUser
  error?: string
}> {
  try {
    const authHeaders = extractAuthHeaders(request)

    if (!authHeaders) {
      return {
        success: false,
        error: 'Missing authentication headers'
      }
    }

    const authService = getAuthService()
    const message = buildMessage(request)

    const result = await authService.validateRequest({
      publicKey: authHeaders.publicKey,
      timestamp: authHeaders.timestamp,
      nonce: authHeaders.nonce,
      signature: authHeaders.signature,
      message
    })

    return result
  } catch (error) {
    logger?.error('Auth validation error', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Helper: Obter usuário autenticado do request
 */
export function getCryptoAuthUser(request: Request): CryptoAuthUser | null {
  return (request as any).user || null
}

/**
 * Helper: Verificar se request está autenticado
 */
export function isCryptoAuthAuthenticated(request: Request): boolean {
  return !!(request as any).user
}

/**
 * Helper: Verificar se usuário é admin
 */
export function isCryptoAuthAdmin(request: Request): boolean {
  const user = getCryptoAuthUser(request)
  return user?.isAdmin || false
}

/**
 * Helper: Verificar se usuário tem permissão específica
 */
export function hasCryptoAuthPermission(request: Request, permission: string): boolean {
  const user = getCryptoAuthUser(request)
  if (!user) return false
  return user.permissions.includes(permission) || user.permissions.includes('admin')
}
