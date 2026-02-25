// 🔐 FluxStack Enhanced State Signature System - Advanced cryptographic validation with key rotation and compression

import { createHmac, randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto'
import { promisify } from 'util'
import { gzip, gunzip } from 'zlib'
import { liveLog, liveWarn } from './LiveLogger'

const scryptAsync = promisify(scrypt)
const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

export interface SignedState<T = any> {
  data: T
  signature: string
  timestamp: number
  componentId: string
  version: number
  keyId?: string // For key rotation
  compressed?: boolean // For state compression
  encrypted?: boolean // For sensitive data
  nonce?: string // 🔒 Anti-replay: unique per signed state
}

export interface StateValidationResult {
  valid: boolean
  error?: string
  tampered?: boolean
  expired?: boolean
  keyRotated?: boolean
  replayed?: boolean // 🔒 Anti-replay: nonce was already consumed
}

export interface StateBackup<T = any> {
  componentId: string
  state: T
  timestamp: number
  version: number
  checksum: string
}

export interface KeyRotationConfig {
  rotationInterval: number // milliseconds
  maxKeyAge: number // milliseconds
  keyRetentionCount: number // number of old keys to keep
}

export interface CompressionConfig {
  enabled: boolean
  threshold: number // bytes - compress if state is larger than this
  level: number // compression level 1-9
}

export class StateSignature {
  private static instance: StateSignature
  private currentKey: string
  private keyHistory: Map<string, { key: string; createdAt: number }> = new Map()
  private readonly maxAge = 24 * 60 * 60 * 1000 // 24 hours default
  private keyRotationConfig: KeyRotationConfig
  private compressionConfig: CompressionConfig
  private backups = new Map<string, StateBackup[]>() // componentId -> backups
  private migrationFunctions = new Map<string, (state: any) => any>() // version -> migration function
  // 🔒 Anti-replay: track consumed nonces to prevent state replay attacks
  private consumedNonces = new Set<string>()
  private readonly nonceMaxAge = 24 * 60 * 60 * 1000 // Nonces expire with the state (24h)
  private nonceTimestamps = new Map<string, number>() // nonce -> timestamp for cleanup

  constructor(secretKey?: string, options?: {
    keyRotation?: Partial<KeyRotationConfig>
    compression?: Partial<CompressionConfig>
  }) {
    this.currentKey = secretKey || this.generateSecretKey()
    this.keyHistory.set(this.getCurrentKeyId(), {
      key: this.currentKey,
      createdAt: Date.now()
    })
    
    this.keyRotationConfig = {
      rotationInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxKeyAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      keyRetentionCount: 5,
      ...options?.keyRotation
    }
    
    this.compressionConfig = {
      enabled: true,
      threshold: 1024, // 1KB
      level: 6,
      ...options?.compression
    }
    
    this.setupKeyRotation()
  }

  public static getInstance(secretKey?: string, options?: {
    keyRotation?: Partial<KeyRotationConfig>
    compression?: Partial<CompressionConfig>
  }): StateSignature {
    if (!StateSignature.instance) {
      StateSignature.instance = new StateSignature(secretKey, options)
    }
    return StateSignature.instance
  }

  private generateSecretKey(): string {
    return randomBytes(32).toString('hex')
  }

  private getCurrentKeyId(): string {
    return createHmac('sha256', this.currentKey).update('keyid').digest('hex').substring(0, 8)
  }

  private setupKeyRotation(): void {
    // Rotate keys periodically
    setInterval(() => {
      this.rotateKey()
    }, this.keyRotationConfig.rotationInterval)

    // Cleanup old keys and expired nonces
    setInterval(() => {
      this.cleanupOldKeys()
      this.cleanupExpiredNonces()
    }, 24 * 60 * 60 * 1000) // Daily cleanup
  }

  private rotateKey(): void {
    const oldKeyId = this.getCurrentKeyId()
    this.currentKey = this.generateSecretKey()
    const newKeyId = this.getCurrentKeyId()
    
    this.keyHistory.set(newKeyId, {
      key: this.currentKey,
      createdAt: Date.now()
    })
    
    liveLog('state', null, `🔄 Key rotated from ${oldKeyId} to ${newKeyId}`)
  }

  private cleanupOldKeys(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [keyId, keyData] of this.keyHistory) {
      const keyAge = now - keyData.createdAt
      if (keyAge > this.keyRotationConfig.maxKeyAge) {
        keysToDelete.push(keyId)
      }
    }
    
    // Keep at least the retention count of keys
    const sortedKeys = Array.from(this.keyHistory.entries())
      .sort((a, b) => b[1].createdAt - a[1].createdAt)
    
    if (sortedKeys.length > this.keyRotationConfig.keyRetentionCount) {
      const excessKeys = sortedKeys.slice(this.keyRotationConfig.keyRetentionCount)
      for (const [keyId] of excessKeys) {
        keysToDelete.push(keyId)
      }
    }
    
    for (const keyId of keysToDelete) {
      this.keyHistory.delete(keyId)
    }
    
    if (keysToDelete.length > 0) {
      liveLog('state', null, `🧹 Cleaned up ${keysToDelete.length} old keys`)
    }
  }

  /**
   * 🔒 Remove expired nonces to prevent unbounded memory growth
   */
  private cleanupExpiredNonces(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [nonce, timestamp] of this.nonceTimestamps) {
      if (now - timestamp > this.nonceMaxAge) {
        this.consumedNonces.delete(nonce)
        this.nonceTimestamps.delete(nonce)
        cleaned++
      }
    }

    if (cleaned > 0) {
      liveLog('state', null, `🧹 Cleaned up ${cleaned} expired nonces (${this.consumedNonces.size} active)`)
    }
  }

  private getKeyById(keyId: string): string | null {
    const keyData = this.keyHistory.get(keyId)
    return keyData ? keyData.key : null
  }

  /**
   * Sign component state with enhanced security, compression, and encryption
   */
  public async signState<T>(
    componentId: string, 
    data: T, 
    version: number = 1,
    options?: {
      compress?: boolean
      encrypt?: boolean
      backup?: boolean
    }
  ): Promise<SignedState<T>> {
    const timestamp = Date.now()
    const keyId = this.getCurrentKeyId()
    const nonce = randomBytes(16).toString('hex') // 🔒 Anti-replay nonce

    let processedData = data
    let compressed = false
    let encrypted = false

    try {
      // Serialize data for processing
      const serializedData = JSON.stringify(data)

      // Compress if enabled and data is large enough
      if (this.compressionConfig.enabled &&
          (options?.compress !== false) &&
          Buffer.byteLength(serializedData, 'utf8') > this.compressionConfig.threshold) {

        const compressedBuffer = await gzipAsync(Buffer.from(serializedData, 'utf8'))
        processedData = compressedBuffer.toString('base64') as any
        compressed = true

        liveLog('state', componentId, `🗜️ State compressed: ${Buffer.byteLength(serializedData, 'utf8')} -> ${compressedBuffer.length} bytes`)
      }

      // Encrypt sensitive data if requested
      if (options?.encrypt) {
        const encryptedData = await this.encryptData(processedData)
        processedData = encryptedData as any
        encrypted = true

        liveLog('state', componentId, `🔒 State encrypted for component: ${componentId}`)
      }

      // Create payload for signing (includes nonce for anti-replay)
      const payload = {
        data: processedData,
        componentId,
        timestamp,
        version,
        keyId,
        compressed,
        encrypted,
        nonce
      }

      // Generate signature with current key
      const signature = this.createSignature(payload)
      
      // Create backup if requested
      if (options?.backup) {
        await this.createStateBackup(componentId, data, version)
      }
      
      liveLog('state', componentId, '🔐 State signed:', {
        componentId,
        timestamp,
        version,
        keyId,
        compressed,
        encrypted,
        nonce: nonce.substring(0, 8) + '...',
        signature: signature.substring(0, 16) + '...'
      })

      return {
        data: processedData,
        signature,
        timestamp,
        componentId,
        version,
        keyId,
        compressed,
        encrypted,
        nonce
      }
      
    } catch (error) {
      console.error('❌ Failed to sign state:', error)
      throw new Error(`State signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate signed state integrity with enhanced security checks
   */
  /**
   * Validate signed state integrity with enhanced security checks.
   * @param consumeNonce If true (default), the nonce is consumed and the same signed state cannot be reused.
   *                     Set to false for read-only validation without consuming the nonce.
   */
  public async validateState<T>(signedState: SignedState<T>, maxAge?: number, consumeNonce = true): Promise<StateValidationResult> {
    const { data, signature, timestamp, componentId, version, keyId, compressed, encrypted, nonce } = signedState

    try {
      // Check timestamp (prevent replay attacks)
      const age = Date.now() - timestamp
      const ageLimit = maxAge || this.maxAge

      if (age > ageLimit) {
        return {
          valid: false,
          error: 'State signature expired',
          expired: true
        }
      }

      // 🔒 Anti-replay: check if this nonce was already consumed
      if (nonce && consumeNonce && this.consumedNonces.has(nonce)) {
        liveWarn('state', componentId, '⚠️ Replay attack detected - nonce already consumed:', {
          componentId,
          nonce: nonce.substring(0, 8) + '...'
        })
        return {
          valid: false,
          error: 'State already consumed - replay attack detected',
          replayed: true
        }
      }

      // Determine which key to use for validation
      let validationKey = this.currentKey
      let keyRotated = false

      if (keyId) {
        const historicalKey = this.getKeyById(keyId)
        if (historicalKey) {
          validationKey = historicalKey
          keyRotated = keyId !== this.getCurrentKeyId()
        } else {
          return {
            valid: false,
            error: 'Signing key not found or expired',
            keyRotated: true
          }
        }
      }

      // Recreate payload for verification (must include nonce if present)
      const payload: Record<string, unknown> = {
        data,
        componentId,
        timestamp,
        version,
        keyId,
        compressed,
        encrypted,
      }
      if (nonce !== undefined) {
        payload.nonce = nonce
      }

      // Verify signature with appropriate key
      const expectedSignature = this.createSignature(payload, validationKey)

      if (!this.constantTimeEquals(signature, expectedSignature)) {
        liveWarn('state', componentId, '⚠️ State signature mismatch:', {
          componentId,
          expected: expectedSignature.substring(0, 16) + '...',
          received: signature.substring(0, 16) + '...'
        })

        return {
          valid: false,
          error: 'State signature invalid - possible tampering',
          tampered: true
        }
      }

      // 🔒 Anti-replay: consume the nonce so it cannot be reused
      if (nonce && consumeNonce) {
        this.consumedNonces.add(nonce)
        this.nonceTimestamps.set(nonce, Date.now())
      }

      liveLog('state', componentId, '✅ State signature valid:', {
        componentId,
        age: `${Math.round(age / 1000)}s`,
        version,
        nonceConsumed: !!(nonce && consumeNonce)
      })

      return { valid: true }

    } catch (error: any) {
      return {
        valid: false,
        error: `Validation error: ${error.message}`
      }
    }
  }

  /**
   * Create HMAC signature for payload using specified key
   */
  private createSignature(payload: any, key?: string): string {
    // Stringify deterministically (sorted keys)
    const normalizedPayload = JSON.stringify(payload, Object.keys(payload).sort())
    
    return createHmac('sha256', key || this.currentKey)
      .update(normalizedPayload)
      .digest('hex')
  }

  /**
   * Encrypt sensitive data
   */
  private async encryptData<T>(data: T): Promise<string> {
    try {
      const serializedData = JSON.stringify(data)
      const key = await scryptAsync(this.currentKey, 'salt', 32) as Buffer
      const iv = randomBytes(16)
      const cipher = createCipheriv('aes-256-cbc', key, iv)
      
      let encrypted = cipher.update(serializedData, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      return iv.toString('hex') + ':' + encrypted
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Decrypt sensitive data
   */
  private async decryptData(encryptedData: string, key?: string): Promise<any> {
    try {
      const [ivHex, encrypted] = encryptedData.split(':')
      const iv = Buffer.from(ivHex, 'hex')
      const derivedKey = await scryptAsync(key || this.currentKey, 'salt', 32) as Buffer
      const decipher = createDecipheriv('aes-256-cbc', derivedKey, iv)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return JSON.parse(decrypted)
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Decompress state data
   */
  private async decompressData(compressedData: string): Promise<any> {
    try {
      const compressedBuffer = Buffer.from(compressedData, 'base64')
      const decompressedBuffer = await gunzipAsync(compressedBuffer)
      return JSON.parse(decompressedBuffer.toString('utf8'))
    } catch (error) {
      throw new Error(`Decompression failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create state backup
   */
  private async createStateBackup<T>(componentId: string, state: T, version: number): Promise<void> {
    try {
      const backup: StateBackup<T> = {
        componentId,
        state,
        timestamp: Date.now(),
        version,
        checksum: createHmac('sha256', this.currentKey).update(JSON.stringify(state)).digest('hex')
      }
      
      let backups = this.backups.get(componentId) || []
      backups.push(backup)
      
      // Keep only last 10 backups per component
      if (backups.length > 10) {
        backups = backups.slice(-10)
      }
      
      this.backups.set(componentId, backups)
      
      liveLog('state', componentId, `💾 State backup created for component ${componentId} v${version}`)
    } catch (error) {
      console.error(`❌ Failed to create backup for component ${componentId}:`, error)
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Extract and process signed state data (decompression, decryption)
   */
  public async extractData<T>(signedState: SignedState<T>): Promise<T> {
    let data = signedState.data
    
    try {
      // Decrypt if encrypted
      if (signedState.encrypted) {
        const keyToUse = signedState.keyId ? this.getKeyById(signedState.keyId) : this.currentKey
        if (!keyToUse) {
          throw new Error('Decryption key not available')
        }
        data = await this.decryptData(data as string, keyToUse)
      }
      
      // Decompress if compressed
      if (signedState.compressed) {
        data = await this.decompressData(data as string)
      }
      
      return data
    } catch (error) {
      console.error('❌ Failed to extract state data:', error)
      throw error
    }
  }

  /**
   * Update signature for new state version with enhanced options
   */
  public async updateSignature<T>(
    signedState: SignedState<T>, 
    newData: T,
    options?: {
      compress?: boolean
      encrypt?: boolean
      backup?: boolean
    }
  ): Promise<SignedState<T>> {
    return this.signState(
      signedState.componentId,
      newData,
      signedState.version + 1,
      options
    )
  }

  /**
   * Register state migration function
   */
  public registerMigration(fromVersion: string, toVersion: string, migrationFn: (state: any) => any): void {
    const key = `${fromVersion}->${toVersion}`
    this.migrationFunctions.set(key, migrationFn)
    liveLog('state', null, `📋 Registered migration: ${key}`)
  }

  /**
   * Migrate state to new version
   */
  public async migrateState<T>(signedState: SignedState<T>, targetVersion: string): Promise<SignedState<T> | null> {
    const currentVersion = signedState.version.toString()
    const migrationKey = `${currentVersion}->${targetVersion}`
    
    const migrationFn = this.migrationFunctions.get(migrationKey)
    if (!migrationFn) {
      liveWarn('state', null, `⚠️ No migration function found for ${migrationKey}`)
      return null
    }
    
    try {
      // Extract current data
      const currentData = await this.extractData(signedState)
      
      // Apply migration
      const migratedData = migrationFn(currentData)
      
      // Create new signed state
      const newSignedState = await this.signState(
        signedState.componentId,
        migratedData,
        parseInt(targetVersion),
        {
          compress: signedState.compressed,
          encrypt: signedState.encrypted,
          backup: true
        }
      )
      
      liveLog('state', signedState.componentId, `✅ State migrated from v${currentVersion} to v${targetVersion} for component ${signedState.componentId}`)
      return newSignedState
      
    } catch (error) {
      console.error(`❌ State migration failed for ${migrationKey}:`, error)
      return null
    }
  }

  /**
   * Recover state from backup
   */
  public recoverStateFromBackup<T>(componentId: string, version?: number): StateBackup<T> | null {
    const backups = this.backups.get(componentId)
    if (!backups || backups.length === 0) {
      return null
    }
    
    if (version !== undefined) {
      // Find specific version
      return backups.find(backup => backup.version === version) || null
    } else {
      // Return latest backup
      return backups[backups.length - 1] || null
    }
  }

  /**
   * Get all backups for a component
   */
  public getComponentBackups(componentId: string): StateBackup[] {
    return this.backups.get(componentId) || []
  }

  /**
   * Verify backup integrity
   */
  public verifyBackup<T>(backup: StateBackup<T>): boolean {
    try {
      const expectedChecksum = createHmac('sha256', this.currentKey)
        .update(JSON.stringify(backup.state))
        .digest('hex')
      
      return this.constantTimeEquals(backup.checksum, expectedChecksum)
    } catch {
      return false
    }
  }

  /**
   * Clean up old backups
   */
  public cleanupBackups(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    let totalCleaned = 0
    
    for (const [componentId, backups] of this.backups) {
      const validBackups = backups.filter(backup => {
        const age = now - backup.timestamp
        return age <= maxAge
      })
      
      const cleaned = backups.length - validBackups.length
      totalCleaned += cleaned
      
      if (validBackups.length === 0) {
        this.backups.delete(componentId)
      } else {
        this.backups.set(componentId, validBackups)
      }
    }
    
    if (totalCleaned > 0) {
      liveLog('state', null, `🧹 Cleaned up ${totalCleaned} old state backups`)
    }
  }

  /**
   * Get server's signature info for debugging
   */
  public getSignatureInfo() {
    return {
      algorithm: 'HMAC-SHA256',
      keyLength: this.currentKey.length,
      maxAge: this.maxAge,
      keyPreview: this.currentKey.substring(0, 8) + '...',
      currentKeyId: this.getCurrentKeyId(),
      keyHistoryCount: this.keyHistory.size,
      compressionEnabled: this.compressionConfig.enabled,
      rotationInterval: this.keyRotationConfig.rotationInterval,
      activeNonces: this.consumedNonces.size // 🔒 Anti-replay tracking
    }
  }
}

// Global instance with enhanced configuration
export const stateSignature = StateSignature.getInstance(
  process.env.FLUXSTACK_STATE_SECRET || undefined,
  {
    keyRotation: {
      rotationInterval: parseInt(process.env.FLUXSTACK_KEY_ROTATION_INTERVAL || '604800000'), // 7 days
      maxKeyAge: parseInt(process.env.FLUXSTACK_MAX_KEY_AGE || '2592000000'), // 30 days
      keyRetentionCount: parseInt(process.env.FLUXSTACK_KEY_RETENTION_COUNT || '5')
    },
    compression: {
      enabled: process.env.FLUXSTACK_COMPRESSION_ENABLED !== 'false',
      threshold: parseInt(process.env.FLUXSTACK_COMPRESSION_THRESHOLD || '1024'), // 1KB
      level: parseInt(process.env.FLUXSTACK_COMPRESSION_LEVEL || '6')
    }
  }
)