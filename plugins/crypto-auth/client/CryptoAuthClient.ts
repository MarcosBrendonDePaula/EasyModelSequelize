/**
 * Cliente de Autenticação Criptográfica
 * Sistema baseado em assinatura Ed25519 SEM sessões no servidor
 *
 * Funcionamento:
 * 1. Cliente gera par de chaves Ed25519 localmente
 * 2. Chave privada NUNCA sai do navegador
 * 3. Cada requisição é assinada automaticamente
 * 4. Servidor valida assinatura usando chave pública recebida
 */

import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

export interface KeyPair {
  publicKey: string
  privateKey: string
  createdAt: Date
}

export interface AuthConfig {
  storage?: 'localStorage' | 'sessionStorage' | 'memory'
  autoInit?: boolean
}

export interface SignedRequestOptions extends RequestInit {
  skipAuth?: boolean
}

export class CryptoAuthClient {
  private keys: KeyPair | null = null
  private config: AuthConfig
  private storage: Storage | Map<string, string>
  private readonly STORAGE_KEY = 'fluxstack_crypto_keys'

  constructor(config: AuthConfig = {}) {
    this.config = {
      storage: 'localStorage',
      autoInit: true,
      ...config
    }

    // Configurar storage
    if (this.config.storage === 'localStorage' && typeof localStorage !== 'undefined') {
      this.storage = localStorage
    } else if (this.config.storage === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
      this.storage = sessionStorage
    } else {
      this.storage = new Map<string, string>()
    }

    // Auto-inicializar se configurado
    if (this.config.autoInit) {
      this.initialize()
    }
  }

  /**
   * Inicializar (gerar ou carregar chaves)
   */
  initialize(): KeyPair {
    // Tentar carregar chaves existentes
    const existingKeys = this.loadKeys()
    if (existingKeys) {
      this.keys = existingKeys
      return existingKeys
    }

    // Criar novo par de chaves
    return this.createNewKeys()
  }

  /**
   * Criar novo par de chaves
   * NUNCA envia chave privada ao servidor!
   */
  createNewKeys(): KeyPair {
    // Gerar par de chaves Ed25519
    const privateKey = ed25519.utils.randomPrivateKey()
    const publicKey = ed25519.getPublicKey(privateKey)

    const keys: KeyPair = {
      publicKey: bytesToHex(publicKey),
      privateKey: bytesToHex(privateKey),
      createdAt: new Date()
    }

    this.keys = keys
    this.saveKeys(keys)

    return keys
  }

  /**
   * Fazer requisição autenticada com assinatura
   */
  async fetch(url: string, options: SignedRequestOptions = {}): Promise<Response> {
    const { skipAuth = false, ...fetchOptions } = options

    if (skipAuth) {
      return fetch(url, fetchOptions)
    }

    if (!this.keys) {
      this.initialize()
    }

    if (!this.keys) {
      throw new Error('Chaves não inicializadas')
    }

    // Preparar dados de autenticação
    const timestamp = Date.now()
    const nonce = this.generateNonce()
    const message = this.buildMessage(fetchOptions.method || 'GET', url, fetchOptions.body)
    const signature = this.signMessage(message, timestamp, nonce)

    // Adicionar headers de autenticação
    const headers = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
      'x-public-key': this.keys.publicKey,
      'x-timestamp': timestamp.toString(),
      'x-nonce': nonce,
      'x-signature': signature
    }

    return fetch(url, {
      ...fetchOptions,
      headers
    })
  }

  /**
   * Obter chaves atuais
   */
  getKeys(): KeyPair | null {
    return this.keys
  }

  /**
   * Verificar se tem chaves
   */
  isInitialized(): boolean {
    return this.keys !== null
  }

  /**
   * Limpar chaves (logout)
   */
  clearKeys(): void {
    this.keys = null
    if (this.storage instanceof Map) {
      this.storage.delete(this.STORAGE_KEY)
    } else {
      this.storage.removeItem(this.STORAGE_KEY)
    }
  }

  /**
   * Importar chave privada existente
   * @param privateKeyHex - Chave privada em formato hexadecimal (64 caracteres)
   * @returns KeyPair com as chaves importadas
   * @throws Error se a chave privada for inválida
   */
  importPrivateKey(privateKeyHex: string): KeyPair {
    // Validar formato
    if (!/^[a-fA-F0-9]{64}$/.test(privateKeyHex)) {
      throw new Error('Chave privada inválida. Deve ter 64 caracteres hexadecimais.')
    }

    try {
      // Converter hex para bytes
      const privateKeyBytes = hexToBytes(privateKeyHex)

      // Derivar chave pública da privada
      const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes)

      const keys: KeyPair = {
        publicKey: bytesToHex(publicKeyBytes),
        privateKey: privateKeyHex.toLowerCase(),
        createdAt: new Date()
      }

      this.keys = keys
      this.saveKeys(keys)

      return keys
    } catch (error) {
      throw new Error('Erro ao importar chave privada: ' + (error as Error).message)
    }
  }

  /**
   * Exportar chave privada (para backup)
   * @returns Chave privada em formato hexadecimal
   * @throws Error se não houver chaves inicializadas
   */
  exportPrivateKey(): string {
    if (!this.keys) {
      throw new Error('Nenhuma chave inicializada para exportar')
    }

    return this.keys.privateKey
  }

  /**
   * Assinar mensagem
   */
  private signMessage(message: string, timestamp: number, nonce: string): string {
    if (!this.keys) {
      throw new Error('Chaves não inicializadas')
    }

    // Construir mensagem completa: publicKey:timestamp:nonce:message
    const fullMessage = `${this.keys.publicKey}:${timestamp}:${nonce}:${message}`
    const messageHash = sha256(new TextEncoder().encode(fullMessage))

    const privateKeyBytes = hexToBytes(this.keys.privateKey)
    const signature = ed25519.sign(messageHash, privateKeyBytes)

    return bytesToHex(signature)
  }

  /**
   * Construir mensagem para assinatura
   */
  private buildMessage(method: string, url: string, body?: BodyInit | null): string {
    let message = `${method}:${url}`

    if (body) {
      if (typeof body === 'string') {
        message += `:${body}`
      } else {
        message += `:${JSON.stringify(body)}`
      }
    }

    return message
  }

  /**
   * Gerar nonce aleatório
   */
  private generateNonce(): string {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return bytesToHex(bytes)
  }

  /**
   * Carregar chaves do storage
   */
  private loadKeys(): KeyPair | null {
    try {
      let data: string | null

      if (this.storage instanceof Map) {
        data = this.storage.get(this.STORAGE_KEY) || null
      } else {
        data = this.storage.getItem(this.STORAGE_KEY)
      }

      if (!data) {
        return null
      }

      const parsed = JSON.parse(data)

      return {
        publicKey: parsed.publicKey,
        privateKey: parsed.privateKey,
        createdAt: new Date(parsed.createdAt)
      }
    } catch (error) {
      console.error('Erro ao carregar chaves:', error)
      return null
    }
  }

  /**
   * Salvar chaves no storage
   */
  private saveKeys(keys: KeyPair): void {
    try {
      const data = JSON.stringify({
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
        createdAt: keys.createdAt.toISOString()
      })

      if (this.storage instanceof Map) {
        this.storage.set(this.STORAGE_KEY, data)
      } else {
        this.storage.setItem(this.STORAGE_KEY, data)
      }
    } catch (error) {
      console.error('Erro ao salvar chaves:', error)
    }
  }
}
