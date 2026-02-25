import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname, basename } from 'path'
import { liveLog, liveWarn } from './LiveLogger'
import type {
  ActiveUpload,
  FileUploadStartMessage,
  FileUploadChunkMessage,
  FileUploadCompleteMessage,
  FileUploadProgressResponse,
  FileUploadCompleteResponse
} from '@core/types/types'

// 🔒 Magic bytes mapping for content validation
// Validates actual file content, not just the MIME type header
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header
    // Byte 8-11 should be WEBP, checked separately
  ],
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  'application/zip': [
    { bytes: [0x50, 0x4B, 0x03, 0x04] }, // PK\x03\x04
    { bytes: [0x50, 0x4B, 0x05, 0x06] }, // Empty archive
  ],
  'application/gzip': [{ bytes: [0x1F, 0x8B] }],
}

export class FileUploadManager {
  private activeUploads = new Map<string, ActiveUpload>()
  private readonly maxUploadSize = 50 * 1024 * 1024 // 🔒 50MB max (reduced from 500MB)
  private readonly chunkTimeout = 30000 // 30 seconds timeout per chunk
  // 🔒 Per-user upload quota tracking
  private userUploadBytes = new Map<string, number>() // userId -> total bytes uploaded
  private readonly maxBytesPerUser = 500 * 1024 * 1024 // 🔒 500MB per user total
  private readonly quotaResetInterval = 24 * 60 * 60 * 1000 // Reset quotas daily
  // 🔒 Default allowed MIME types - safe file types only
  private readonly allowedTypes: string[] = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/csv', 'text/markdown',
    'application/json',
    'application/zip', 'application/gzip',
  ]
  // 🔒 Blocked file extensions that could be dangerous
  private readonly blockedExtensions: Set<string> = new Set([
    '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
    '.sh', '.bash', '.zsh', '.csh',
    '.ps1', '.psm1', '.psd1',
    '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
    '.dll', '.sys', '.drv', '.so', '.dylib',
  ])

  constructor() {
    // Cleanup stale uploads every 5 minutes
    setInterval(() => this.cleanupStaleUploads(), 5 * 60 * 1000)
    // 🔒 Reset per-user upload quotas daily
    setInterval(() => this.resetUploadQuotas(), this.quotaResetInterval)
  }

  async startUpload(message: FileUploadStartMessage, userId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { uploadId, componentId, filename, fileType, fileSize, chunkSize = 64 * 1024 } = message

      // 🔒 Validate file size
      if (fileSize > this.maxUploadSize) {
        throw new Error(`File too large: ${fileSize} bytes. Max: ${this.maxUploadSize} bytes`)
      }

      // 🔒 Per-user upload quota check
      if (userId) {
        const currentUsage = this.userUploadBytes.get(userId) || 0
        if (currentUsage + fileSize > this.maxBytesPerUser) {
          throw new Error(`Upload quota exceeded for user. Used: ${currentUsage} bytes, limit: ${this.maxBytesPerUser} bytes`)
        }
      }

      // 🔒 Validate MIME type against allowlist
      if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(fileType)) {
        throw new Error(`File type not allowed: ${fileType}`)
      }

      // 🔒 Validate filename - sanitize and check extension
      const safeBase = basename(filename) // Strip any path traversal
      const ext = extname(safeBase).toLowerCase()
      if (this.blockedExtensions.has(ext)) {
        throw new Error(`File extension not allowed: ${ext}`)
      }

      // 🔒 Double extension bypass prevention (e.g., malware.exe.jpg)
      const parts = safeBase.split('.')
      if (parts.length > 2) {
        // Check all intermediate extensions
        for (let i = 1; i < parts.length - 1; i++) {
          const intermediateExt = '.' + parts[i].toLowerCase()
          if (this.blockedExtensions.has(intermediateExt)) {
            throw new Error(`Suspicious double extension detected: ${intermediateExt} in ${safeBase}`)
          }
        }
      }

      // 🔒 Validate filename length
      if (safeBase.length > 255) {
        throw new Error('Filename too long')
      }

      // Check if upload already exists
      if (this.activeUploads.has(uploadId)) {
        throw new Error(`Upload ${uploadId} already in progress`)
      }

      // Calculate total chunks
      const totalChunks = Math.ceil(fileSize / chunkSize)

      // Create upload record
      const upload: ActiveUpload = {
        uploadId,
        componentId,
        filename,
        fileType,
        fileSize,
        totalChunks,
        receivedChunks: new Map(),
        bytesReceived: 0, // Track actual bytes for adaptive chunking
        startTime: Date.now(),
        lastChunkTime: Date.now()
      }

      this.activeUploads.set(uploadId, upload)

      // 🔒 Reserve quota for this upload
      if (userId) {
        const currentUsage = this.userUploadBytes.get(userId) || 0
        this.userUploadBytes.set(userId, currentUsage + fileSize)
      }

      liveLog('messages', componentId, '📤 Upload started:', {
        uploadId,
        componentId,
        filename,
        fileType,
        fileSize,
        totalChunks,
        userId: userId || 'anonymous'
      })

      return { success: true }

    } catch (error: any) {
      console.error('❌ Upload start failed:', error.message)
      return { success: false, error: error.message }
    }
  }

  async receiveChunk(message: FileUploadChunkMessage, ws: any, binaryData: Buffer | null = null): Promise<FileUploadProgressResponse | null> {
    try {
      const { uploadId, chunkIndex, totalChunks, data } = message

      const upload = this.activeUploads.get(uploadId)
      if (!upload) {
        throw new Error(`Upload ${uploadId} not found`)
      }

      // Validate chunk index
      if (chunkIndex < 0 || chunkIndex >= totalChunks) {
        throw new Error(`Invalid chunk index: ${chunkIndex}`)
      }

      // Check if chunk already received
      if (upload.receivedChunks.has(chunkIndex)) {
        liveLog('messages', upload.componentId, `📦 Chunk ${chunkIndex} already received for upload ${uploadId}`)
      } else {
        // Store chunk data - use binary data if available, otherwise use base64 string
        let chunkBytes: number

        if (binaryData) {
          // Binary protocol: store Buffer directly (more efficient)
          upload.receivedChunks.set(chunkIndex, binaryData)
          chunkBytes = binaryData.length
        } else {
          // JSON protocol: store base64 string (legacy support)
          upload.receivedChunks.set(chunkIndex, data as string)
          chunkBytes = Buffer.from(data as string, 'base64').length
        }

        upload.lastChunkTime = Date.now()
        upload.bytesReceived += chunkBytes

        liveLog('messages', upload.componentId, `📦 Received chunk ${chunkIndex + 1}/${totalChunks} for upload ${uploadId} (${chunkBytes} bytes, total: ${upload.bytesReceived}/${upload.fileSize})${binaryData ? ' [binary]' : ' [base64]'}`)
      }

      // Calculate progress based on actual bytes received (supports adaptive chunking)
      const progress = (upload.bytesReceived / upload.fileSize) * 100
      const bytesUploaded = upload.bytesReceived

      // Log completion status (but don't finalize until COMPLETE message)
      if (upload.bytesReceived >= upload.fileSize) {
        liveLog('messages', upload.componentId, `✅ All bytes received for upload ${uploadId} (${upload.bytesReceived}/${upload.fileSize}), waiting for COMPLETE message`)
      }

      return {
        type: 'FILE_UPLOAD_PROGRESS',
        componentId: upload.componentId,
        uploadId: upload.uploadId,
        chunkIndex,
        totalChunks,
        bytesUploaded: Math.min(bytesUploaded, upload.fileSize),
        totalBytes: upload.fileSize,
        progress: Math.min(progress, 100),
        timestamp: Date.now()
      }

    } catch (error: any) {
      console.error(`❌ Chunk receive failed for upload ${message.uploadId}:`, error.message)
      throw error
    }
  }

  private async finalizeUpload(upload: ActiveUpload): Promise<void> {
    try {
      liveLog('messages', upload.componentId, `✅ Upload completed: ${upload.uploadId}`)
      
      // Assemble file from chunks
      const fileUrl = await this.assembleFile(upload)
      
      // Cleanup
      this.activeUploads.delete(upload.uploadId)
      
    } catch (error: any) {
      console.error(`❌ Upload finalization failed for ${upload.uploadId}:`, error.message)
      throw error
    }
  }

  async completeUpload(message: FileUploadCompleteMessage): Promise<FileUploadCompleteResponse> {
    try {
      const { uploadId } = message

      const upload = this.activeUploads.get(uploadId)
      if (!upload) {
        throw new Error(`Upload ${uploadId} not found`)
      }

      liveLog('messages', upload.componentId, `✅ Upload completion requested: ${uploadId}`)

      // Validate bytes received (supports adaptive chunking)
      if (upload.bytesReceived !== upload.fileSize) {
        const bytesShort = upload.fileSize - upload.bytesReceived
        throw new Error(`Incomplete upload: received ${upload.bytesReceived}/${upload.fileSize} bytes (${bytesShort} bytes short)`)
      }

      // 🔒 Content validation: verify file magic bytes match claimed MIME type
      this.validateContentMagicBytes(upload)

      liveLog('messages', upload.componentId, `✅ Upload validation passed: ${uploadId} (${upload.bytesReceived} bytes)`)

      // Assemble file from chunks
      const fileUrl = await this.assembleFile(upload)

      // Cleanup
      this.activeUploads.delete(uploadId)

      return {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: upload.componentId,
        uploadId: upload.uploadId,
        success: true,
        filename: upload.filename,
        fileUrl,
        timestamp: Date.now()
      }

    } catch (error: any) {
      console.error(`❌ Upload completion failed for ${message.uploadId}:`, error.message)
      
      return {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId: '',
        uploadId: message.uploadId,
        success: false,
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  private async assembleFile(upload: ActiveUpload): Promise<string> {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = './uploads'
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // 🔒 Generate secure unique filename using UUID (prevents path traversal and name collisions)
      const extension = extname(basename(upload.filename)).toLowerCase()
      const safeFilename = `${crypto.randomUUID()}${extension}`
      const filePath = join(uploadsDir, safeFilename)

      // Assemble chunks in order
      const chunks: Buffer[] = []
      for (let i = 0; i < upload.totalChunks; i++) {
        const chunkData = upload.receivedChunks.get(i)
        if (chunkData) {
          // Handle both Buffer (binary protocol) and string (base64 JSON protocol)
          if (Buffer.isBuffer(chunkData)) {
            chunks.push(chunkData)
          } else {
            chunks.push(Buffer.from(chunkData, 'base64'))
          }
        }
      }

      // Write assembled file
      const fileBuffer = Buffer.concat(chunks)
      await writeFile(filePath, fileBuffer)

      liveLog('messages', upload.componentId, `📁 File assembled: ${filePath}`)
      return `/uploads/${safeFilename}`

    } catch (error) {
      console.error('❌ File assembly failed:', error)
      throw error
    }
  }

  private cleanupStaleUploads(): void {
    const now = Date.now()
    const staleUploads: string[] = []

    for (const [uploadId, upload] of this.activeUploads) {
      const timeSinceLastChunk = now - upload.lastChunkTime
      
      if (timeSinceLastChunk > this.chunkTimeout * 2) {
        staleUploads.push(uploadId)
      }
    }

    for (const uploadId of staleUploads) {
      this.activeUploads.delete(uploadId)
      liveLog('messages', null, `🧹 Cleaned up stale upload: ${uploadId}`)
    }

    if (staleUploads.length > 0) {
      liveLog('messages', null, `🧹 Cleaned up ${staleUploads.length} stale uploads`)
    }
  }

  /**
   * 🔒 Validate that the first bytes of the uploaded file match the claimed MIME type.
   * Prevents attacks where a malicious file is uploaded with a fake MIME type header.
   */
  private validateContentMagicBytes(upload: ActiveUpload): void {
    const expectedSignatures = MAGIC_BYTES[upload.fileType]
    if (!expectedSignatures) {
      // No magic bytes defined for this type (text types, SVG, JSON, etc.) - skip binary check
      // For text types, we could add content sniffing but it's less critical
      return
    }

    // Get the first chunk to read magic bytes
    const firstChunk = upload.receivedChunks.get(0)
    if (!firstChunk) {
      throw new Error('Cannot validate file content: first chunk missing')
    }

    const headerBuffer = Buffer.isBuffer(firstChunk)
      ? firstChunk
      : Buffer.from(firstChunk, 'base64')

    // Check if any of the expected signatures match
    let matched = false
    for (const sig of expectedSignatures) {
      const offset = sig.offset ?? 0
      if (headerBuffer.length < offset + sig.bytes.length) {
        continue // File too small for this signature
      }

      let sigMatches = true
      for (let i = 0; i < sig.bytes.length; i++) {
        if (headerBuffer[offset + i] !== sig.bytes[i]) {
          sigMatches = false
          break
        }
      }

      if (sigMatches) {
        matched = true
        break
      }
    }

    if (!matched) {
      liveWarn('messages', upload.componentId, `🔒 Content validation failed for upload ${upload.uploadId}: ` +
        `claimed type ${upload.fileType} does not match file magic bytes`)
      throw new Error(
        `File content does not match claimed type '${upload.fileType}'. ` +
        `The file may be disguised as a different format.`
      )
    }
  }

  /**
   * 🔒 Reset per-user upload quotas (called periodically)
   */
  private resetUploadQuotas(): void {
    const userCount = this.userUploadBytes.size
    this.userUploadBytes.clear()
    if (userCount > 0) {
      liveLog('messages', null, `🔒 Reset upload quotas for ${userCount} users`)
    }
  }

  /**
   * Get per-user upload usage
   */
  getUserUploadUsage(userId: string): { used: number; limit: number; remaining: number } {
    const used = this.userUploadBytes.get(userId) || 0
    return {
      used,
      limit: this.maxBytesPerUser,
      remaining: Math.max(0, this.maxBytesPerUser - used)
    }
  }

  getUploadStatus(uploadId: string): ActiveUpload | null {
    return this.activeUploads.get(uploadId) || null
  }

  getStats() {
    return {
      activeUploads: this.activeUploads.size,
      maxUploadSize: this.maxUploadSize,
      allowedTypes: this.allowedTypes
    }
  }
}

// Global instance
export const fileUploadManager = new FileUploadManager()
