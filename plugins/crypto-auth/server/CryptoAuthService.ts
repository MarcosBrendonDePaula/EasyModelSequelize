/**
 * Serviço de Autenticação Criptográfica
 * Implementa autenticação baseada em Ed25519 - SEM SESSÕES
 * Cada requisição é validada pela assinatura da chave pública
 */

import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { hexToBytes } from '@noble/hashes/utils'

export interface Logger {
  debug(message: string, meta?: any): void
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
}

export interface AuthResult {
  success: boolean
  error?: string
  user?: {
    publicKey: string
    isAdmin: boolean
    permissions: string[]
  }
}

export interface CryptoAuthConfig {
  maxTimeDrift: number
  adminKeys: string[]
  logger?: Logger
}

export class CryptoAuthService {
  private config: CryptoAuthConfig
  private logger?: Logger
  private usedNonces: Map<string, number> = new Map() // Para prevenir replay attacks

  constructor(config: CryptoAuthConfig) {
    this.config = config
    this.logger = config.logger

    // Limpar nonces antigos a cada 5 minutos
    setInterval(() => {
      this.cleanupOldNonces()
    }, 5 * 60 * 1000)
  }

  /**
   * Validar assinatura de requisição
   * PRINCIPAL: Valida se assinatura é válida para a chave pública fornecida
   */
  async validateRequest(data: {
    publicKey: string
    timestamp: number
    nonce: string
    signature: string
    message?: string
  }): Promise<AuthResult> {
    try {
      const { publicKey, timestamp, nonce, signature, message = "" } = data

      // Validar chave pública
      if (!this.isValidPublicKey(publicKey)) {
        return {
          success: false,
          error: "Chave pública inválida"
        }
      }

      // Verificar drift de tempo (previne replay de requisições antigas)
      const now = Date.now()
      const timeDrift = Math.abs(now - timestamp)
      if (timeDrift > this.config.maxTimeDrift) {
        return {
          success: false,
          error: "Timestamp inválido ou expirado"
        }
      }

      // Verificar nonce (previne replay attacks)
      const nonceKey = `${publicKey}:${nonce}`
      if (this.usedNonces.has(nonceKey)) {
        return {
          success: false,
          error: "Nonce já utilizado (possível replay attack)"
        }
      }

      // Construir mensagem para verificação
      const messageToVerify = `${publicKey}:${timestamp}:${nonce}:${message}`
      const messageHash = sha256(new TextEncoder().encode(messageToVerify))

      // Verificar assinatura usando chave pública
      const publicKeyBytes = hexToBytes(publicKey)
      const signatureBytes = hexToBytes(signature)

      const isValidSignature = ed25519.verify(signatureBytes, messageHash, publicKeyBytes)

      if (!isValidSignature) {
        this.logger?.warn("Assinatura inválida", {
          publicKey: publicKey.substring(0, 8) + "..."
        })
        return {
          success: false,
          error: "Assinatura inválida"
        }
      }

      // Marcar nonce como usado
      this.usedNonces.set(nonceKey, timestamp)

      // Verificar se é admin
      const isAdmin = this.config.adminKeys.includes(publicKey)
      const permissions = isAdmin ? ['admin', 'read', 'write', 'delete'] : ['read']

      this.logger?.debug("Requisição autenticada", {
        publicKey: publicKey.substring(0, 8) + "...",
        isAdmin,
        permissions
      })

      return {
        success: true,
        user: {
          publicKey,
          isAdmin,
          permissions
        }
      }
    } catch (error) {
      this.logger?.error("Erro ao validar requisição", { error })
      return {
        success: false,
        error: "Erro interno ao validar requisição"
      }
    }
  }

  /**
   * Verificar se uma chave pública é válida
   */
  private isValidPublicKey(publicKey: string): boolean {
    try {
      if (publicKey.length !== 64) {
        return false
      }
      
      const bytes = hexToBytes(publicKey)
      return bytes.length === 32
    } catch {
      return false
    }
  }

  /**
   * Limpar nonces antigos (previne crescimento infinito da memória)
   */
  private cleanupOldNonces(): void {
    const now = Date.now()
    const maxAge = this.config.maxTimeDrift * 2 // Dobro do tempo máximo permitido
    let cleanedCount = 0

    for (const [nonceKey, timestamp] of this.usedNonces.entries()) {
      if (now - timestamp > maxAge) {
        this.usedNonces.delete(nonceKey)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger?.debug(`Limpeza de nonces: ${cleanedCount} nonces antigos removidos`)
    }
  }

  /**
   * Obter estatísticas do serviço
   */
  getStats() {
    return {
      usedNoncesCount: this.usedNonces.size,
      adminKeys: this.config.adminKeys.length,
      maxTimeDrift: this.config.maxTimeDrift
    }
  }
}