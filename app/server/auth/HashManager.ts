/**
 * FluxStack Auth - Hash Manager
 *
 * Abstração de password hashing usando APIs nativas do Bun.
 * Suporta bcrypt e argon2id. Inclui needsRehash() para
 * migração transparente de algoritmos.
 *
 * ```ts
 * const hash = await Hash.make('my-password')
 * const valid = await Hash.check('my-password', hash)
 * ```
 */

export type HashAlgorithm = 'bcrypt' | 'argon2id'

export interface HashOptions {
  algorithm?: HashAlgorithm
  /** Cost/rounds para bcrypt (default: 10) */
  bcryptRounds?: number
  /** Memory cost para argon2 em KiB (default: 65536) */
  argon2MemoryCost?: number
  /** Time cost para argon2 (default: 2) */
  argon2TimeCost?: number
}

export class HashManager {
  private algorithm: HashAlgorithm
  private bcryptRounds: number
  private argon2MemoryCost: number
  private argon2TimeCost: number

  constructor(options: HashOptions = {}) {
    this.algorithm = options.algorithm ?? 'bcrypt'
    this.bcryptRounds = options.bcryptRounds ?? 10
    this.argon2MemoryCost = options.argon2MemoryCost ?? 65536
    this.argon2TimeCost = options.argon2TimeCost ?? 2
  }

  /**
   * Cria hash de uma password.
   */
  async make(plaintext: string): Promise<string> {
    if (this.algorithm === 'argon2id') {
      return Bun.password.hash(plaintext, {
        algorithm: 'argon2id',
        memoryCost: this.argon2MemoryCost,
        timeCost: this.argon2TimeCost,
      })
    }

    return Bun.password.hash(plaintext, {
      algorithm: 'bcrypt',
      cost: this.bcryptRounds,
    })
  }

  /**
   * Verifica se plaintext corresponde ao hash.
   */
  async check(plaintext: string, hash: string): Promise<boolean> {
    return Bun.password.verify(plaintext, hash)
  }

  /**
   * Verifica se o hash precisa ser re-gerado.
   * Útil para migrar de bcrypt → argon2 ou mudar rounds.
   *
   * Uso típico: após login bem-sucedido, verificar e re-hash se necessário.
   */
  needsRehash(hash: string): boolean {
    if (this.algorithm === 'bcrypt') {
      // bcrypt hashes começam com $2b$ ou $2a$
      if (!hash.startsWith('$2b$') && !hash.startsWith('$2a$')) {
        return true // Hash não é bcrypt, precisa migrar
      }
      // Verificar rounds: $2b$10$ → rounds = 10
      const roundsMatch = hash.match(/^\$2[ab]\$(\d+)\$/)
      if (roundsMatch) {
        const currentRounds = parseInt(roundsMatch[1], 10)
        return currentRounds !== this.bcryptRounds
      }
      return false
    }

    if (this.algorithm === 'argon2id') {
      return !hash.startsWith('$argon2id$')
    }

    return false
  }

  /** Retorna o algoritmo atual */
  getAlgorithm(): HashAlgorithm {
    return this.algorithm
  }
}

/** Instância global do hash manager (configurada no boot) */
let hashInstance: HashManager | null = null

export function getHashManager(): HashManager {
  if (!hashInstance) {
    hashInstance = new HashManager()
  }
  return hashInstance
}

export function setHashManager(manager: HashManager): void {
  hashInstance = manager
}

/** Atalho para uso direto */
export const Hash = {
  async make(plaintext: string): Promise<string> {
    return getHashManager().make(plaintext)
  },
  async check(plaintext: string, hash: string): Promise<boolean> {
    return getHashManager().check(plaintext, hash)
  },
  needsRehash(hash: string): boolean {
    return getHashManager().needsRehash(hash)
  },
}
