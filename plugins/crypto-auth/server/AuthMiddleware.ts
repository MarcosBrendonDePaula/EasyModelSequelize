/**
 * Middleware de Autenticação Simplificado
 * Apenas valida autenticação - routing é feito pelos middlewares Elysia
 */

import type { RequestContext } from '@core/plugins/types'
import type { CryptoAuthService } from './CryptoAuthService'

export interface Logger {
    debug(message: string, meta?: any): void
    info(message: string, meta?: any): void
    warn(message: string, meta?: any): void
    error(message: string, meta?: any): void
}

export interface AuthMiddlewareConfig {
    logger?: Logger
}

export interface AuthMiddlewareResult {
    success: boolean
    error?: string
    user?: {
        publicKey: string
        isAdmin: boolean
        permissions: string[]
    }
}

export class AuthMiddleware {
    private authService: CryptoAuthService
    private logger?: Logger

    constructor(authService: CryptoAuthService, config: AuthMiddlewareConfig = {}) {
        this.authService = authService
        this.logger = config.logger
    }

    /**
     * Autenticar requisição (sem path matching - é responsabilidade dos middlewares Elysia)
     */
    async authenticate(context: RequestContext): Promise<AuthMiddlewareResult> {
        const path = context.path
        const method = context.method

        // Extrair headers de autenticação
        const authHeaders = this.extractAuthHeaders(context.headers)
        if (!authHeaders) {
            this.logger?.warn("Headers de autenticação ausentes", {
                path,
                method,
                headers: Object.keys(context.headers)
            })

            return {
                success: false,
                error: "Headers de autenticação obrigatórios"
            }
        }

        // Validar assinatura da requisição
        try {
            const validationResult = await this.authService.validateRequest({
                publicKey: authHeaders.publicKey,
                timestamp: authHeaders.timestamp,
                nonce: authHeaders.nonce,
                signature: authHeaders.signature,
                message: this.buildMessage(context)
            })

            if (!validationResult.success) {
                this.logger?.warn("Falha na validação da assinatura", {
                    path,
                    method,
                    publicKey: authHeaders.publicKey.substring(0, 8) + "...",
                    error: validationResult.error
                })

                return {
                    success: false,
                    error: validationResult.error
                }
            }

            this.logger?.debug("Requisição autenticada com sucesso", {
                path,
                method,
                publicKey: authHeaders.publicKey.substring(0, 8) + "...",
                isAdmin: validationResult.user?.isAdmin
            })

            return {
                success: true,
                user: validationResult.user
            }
        } catch (error) {
            this.logger?.error("Erro durante autenticação", {
                path,
                method,
                error
            })

            return {
                success: false,
                error: "Erro interno de autenticação"
            }
        }
    }

    /**
     * Extrair headers de autenticação
     */
    private extractAuthHeaders(headers: Record<string, string>): {
        publicKey: string
        timestamp: number
        nonce: string
        signature: string
    } | null {
        const publicKey = headers['x-public-key']
        const timestampStr = headers['x-timestamp']
        const nonce = headers['x-nonce']
        const signature = headers['x-signature']

        if (!publicKey || !timestampStr || !nonce || !signature) {
            return null
        }

        const timestamp = parseInt(timestampStr, 10)
        if (isNaN(timestamp)) {
            return null
        }

        return {
            publicKey,
            timestamp,
            nonce,
            signature
        }
    }

    /**
     * Construir mensagem para assinatura
     */
    private buildMessage(context: RequestContext): string {
        // Incluir método, path e body (se houver) na mensagem
        let message = `${context.method}:${context.path}`

        if (context.body && typeof context.body === 'string') {
            message += `:${context.body}`
        } else if (context.body && typeof context.body === 'object') {
            message += `:${JSON.stringify(context.body)}`
        }

        return message
    }

    /**
     * Verificar se usuário tem permissão
     */
    hasPermission(user: any, requiredPermission: string): boolean {
        if (!user || !user.permissions) {
            return false
        }

        return user.permissions.includes(requiredPermission) || user.permissions.includes('admin')
    }

    /**
     * Verificar se usuário é admin
     */
    isAdmin(user: any): boolean {
        return user && user.isAdmin === true
    }

    /**
     * Obter estatísticas do serviço de autenticação
     */
    getStats() {
        return this.authService.getStats()
    }
}
