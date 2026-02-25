import { useState, useCallback, useRef } from 'react'
import { AdaptiveChunkSizer, type AdaptiveChunkConfig } from './AdaptiveChunkSizer'
import type {
  FileUploadStartMessage,
  FileUploadChunkMessage,
  FileUploadCompleteMessage,
  FileUploadProgressResponse,
  FileUploadCompleteResponse,
  BinaryChunkHeader
} from '@core/types/types'

export interface ChunkedUploadOptions {
  chunkSize?: number // Default 64KB (used as initial if adaptive is enabled)
  maxFileSize?: number // Default 50MB
  allowedTypes?: string[]
  sendMessageAndWait?: (message: any, timeout?: number) => Promise<any> // WebSocket send function for JSON
  sendBinaryAndWait?: (data: ArrayBuffer, requestId: string, timeout?: number) => Promise<any> // WebSocket send function for binary
  onProgress?: (progress: number, bytesUploaded: number, totalBytes: number) => void
  onComplete?: (response: FileUploadCompleteResponse) => void
  onError?: (error: string) => void
  // Adaptive chunking options
  adaptiveChunking?: boolean // Enable adaptive chunk sizing (default: false)
  adaptiveConfig?: Partial<AdaptiveChunkConfig> // Adaptive chunking configuration
  // Binary protocol (more efficient, ~33% less data)
  useBinaryProtocol?: boolean // Enable binary chunk protocol (default: true)
}

/**
 * Creates a binary message with header + data
 * Format: [4 bytes header length][JSON header][binary data]
 */
function createBinaryChunkMessage(header: BinaryChunkHeader, chunkData: Uint8Array): ArrayBuffer {
  const headerJson = JSON.stringify(header)
  const headerBytes = new TextEncoder().encode(headerJson)

  // Total size: 4 bytes (header length) + header + data
  const totalSize = 4 + headerBytes.length + chunkData.length
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const uint8View = new Uint8Array(buffer)

  // Write header length (little-endian)
  view.setUint32(0, headerBytes.length, true)

  // Write header
  uint8View.set(headerBytes, 4)

  // Write chunk data
  uint8View.set(chunkData, 4 + headerBytes.length)

  return buffer
}

export interface ChunkedUploadState {
  uploading: boolean
  progress: number
  error: string | null
  uploadId: string | null
  bytesUploaded: number
  totalBytes: number
}

export function useChunkedUpload(componentId: string, options: ChunkedUploadOptions = {}) {

  const [state, setState] = useState<ChunkedUploadState>({
    uploading: false,
    progress: 0,
    error: null,
    uploadId: null,
    bytesUploaded: 0,
    totalBytes: 0
  })

  const {
    chunkSize = 64 * 1024, // 64KB default
    maxFileSize = 50 * 1024 * 1024, // 50MB default
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    sendMessageAndWait,
    sendBinaryAndWait,
    onProgress,
    onComplete,
    onError,
    adaptiveChunking = false,
    adaptiveConfig,
    useBinaryProtocol = true // Default to binary for efficiency
  } = options

  // Determine if we can use binary protocol
  const canUseBinary = useBinaryProtocol && sendBinaryAndWait

  const abortControllerRef = useRef<AbortController | null>(null)
  const adaptiveSizerRef = useRef<AdaptiveChunkSizer | null>(null)

  // Initialize adaptive chunk sizer if enabled
  if (adaptiveChunking && !adaptiveSizerRef.current) {
    adaptiveSizerRef.current = new AdaptiveChunkSizer({
      initialChunkSize: chunkSize,
      minChunkSize: chunkSize,  // Do not go below initial chunk size by default
      maxChunkSize: 1024 * 1024, // 1MB max
      ...adaptiveConfig
    })
  }

  // Start chunked upload
  const uploadFile = useCallback(async (file: File) => {
    if (!sendMessageAndWait) {
      const error = 'No sendMessageAndWait function provided'
      setState(prev => ({ ...prev, error }))
      onError?.(error)
      return
    }

    // Validate file type (skip if allowedTypes is empty = accept all)
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      const error = `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`
      setState(prev => ({ ...prev, error }))
      onError?.(error)
      return
    }

    if (file.size > maxFileSize) {
      const error = `File too large: ${file.size} bytes. Max: ${maxFileSize} bytes`
      setState(prev => ({ ...prev, error }))
      onError?.(error)
      return
    }

    try {
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      
      // Create abort controller for this upload
      abortControllerRef.current = new AbortController()
      
      setState({
        uploading: true,
        progress: 0,
        error: null,
        uploadId,
        bytesUploaded: 0,
        totalBytes: file.size
      })

      console.log('🚀 Starting chunked upload:', {
        uploadId,
        filename: file.name,
        size: file.size,
        adaptiveChunking,
        protocol: canUseBinary ? 'binary' : 'base64'
      })

      // Reset adaptive sizer for new upload
      if (adaptiveSizerRef.current) {
        adaptiveSizerRef.current.reset()
      }

      // Get initial chunk size (adaptive or fixed)
      const initialChunkSize = adaptiveSizerRef.current?.getChunkSize() ?? chunkSize

      console.log(`📦 Initial chunk size: ${initialChunkSize} bytes${adaptiveChunking ? ' (adaptive)' : ''}`)

      // Start upload
      const startMessage: FileUploadStartMessage = {
        type: 'FILE_UPLOAD_START',
        componentId,
        uploadId,
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        chunkSize,
        requestId: `start-${uploadId}`
      }

      const startResponse = await sendMessageAndWait(startMessage, 10000)
      if (!startResponse?.success) {
        throw new Error(startResponse?.error || 'Failed to start upload')
      }

      console.log('✅ Upload started successfully')

      let offset = 0
      let chunkIndex = 0
      const estimatedTotalChunks = Math.ceil(file.size / initialChunkSize)

      // Send chunks dynamically with adaptive sizing (read slice per chunk)
      while (offset < file.size) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Upload cancelled')
        }

        // Get current chunk size (adaptive or fixed)
        const currentChunkSize = adaptiveSizerRef.current?.getChunkSize() ?? chunkSize
        const chunkEnd = Math.min(offset + currentChunkSize, file.size)
        const sliceBuffer = await file.slice(offset, chunkEnd).arrayBuffer()
        const chunkBytes = new Uint8Array(sliceBuffer)

        // Record chunk start time for adaptive sizing
        const chunkStartTime = adaptiveSizerRef.current?.recordChunkStart(chunkIndex) ?? 0
        const requestId = `chunk-${uploadId}-${chunkIndex}`

        console.log(`📤 Sending chunk ${chunkIndex + 1} (size: ${chunkBytes.length} bytes)${canUseBinary ? ' [binary]' : ' [base64]'}`)

        try {
          let progressResponse: FileUploadProgressResponse | undefined

          if (canUseBinary) {
            // Binary protocol: Send header + raw bytes (more efficient)
            const header: BinaryChunkHeader = {
              type: 'FILE_UPLOAD_CHUNK',
              componentId,
              uploadId,
              chunkIndex,
              totalChunks: estimatedTotalChunks,
              requestId
            }

            const binaryMessage = createBinaryChunkMessage(header, chunkBytes)
            progressResponse = await sendBinaryAndWait!(binaryMessage, requestId, 10000) as FileUploadProgressResponse
          } else {
            // JSON protocol: Convert to base64 (legacy/fallback)
            let binary = ''
            for (let j = 0; j < chunkBytes.length; j++) {
              binary += String.fromCharCode(chunkBytes[j])
            }
            const base64Chunk = btoa(binary)

            const chunkMessage: FileUploadChunkMessage = {
              type: 'FILE_UPLOAD_CHUNK',
              componentId,
              uploadId,
              chunkIndex,
              totalChunks: estimatedTotalChunks,
              data: base64Chunk,
              requestId
            }

            progressResponse = await sendMessageAndWait!(chunkMessage, 10000) as FileUploadProgressResponse
          }

          if (progressResponse) {
            const { progress, bytesUploaded } = progressResponse
            setState(prev => ({ ...prev, progress, bytesUploaded }))
            onProgress?.(progress, bytesUploaded, file.size)
          }

          // Record successful chunk upload for adaptive sizing
          if (adaptiveSizerRef.current) {
            adaptiveSizerRef.current.recordChunkComplete(
              chunkIndex,
              chunkBytes.length,
              chunkStartTime,
              true
            )
          }
        } catch (error) {
          // Record failed chunk for adaptive sizing
          if (adaptiveSizerRef.current) {
            adaptiveSizerRef.current.recordChunkComplete(
              chunkIndex,
              chunkBytes.length,
              chunkStartTime,
              false
            )
          }
          throw error
        }

        offset += chunkBytes.length
        chunkIndex++

        // Small delay to prevent overwhelming the server (only for fixed chunking)
        if (!adaptiveChunking) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      // Log final adaptive stats
      if (adaptiveSizerRef.current) {
        const stats = adaptiveSizerRef.current.getStats()
        console.log('📊 Final Adaptive Chunking Stats:', stats)
      }

      // Complete upload
      const completeMessage: FileUploadCompleteMessage = {
        type: 'FILE_UPLOAD_COMPLETE',
        componentId,
        uploadId,
        requestId: `complete-${uploadId}`
      }

      console.log('🏁 Completing upload...')

      const completeResponse = await sendMessageAndWait(completeMessage, 10000) as FileUploadCompleteResponse

      if (completeResponse?.success) {
        setState(prev => ({ 
          ...prev, 
          uploading: false, 
          progress: 100,
          bytesUploaded: file.size
        }))
        
        console.log('🎉 Upload completed successfully:', completeResponse.fileUrl)
        onComplete?.(completeResponse)
      } else {
        throw new Error(completeResponse?.error || 'Upload completion failed')
      }

    } catch (error: any) {
      console.error('❌ Chunked upload failed:', error.message)
      setState(prev => ({ 
        ...prev, 
        uploading: false, 
        error: error.message 
      }))
      onError?.(error.message)
    }
  }, [
    componentId,
    allowedTypes,
    maxFileSize,
    chunkSize,
    sendMessageAndWait,
    onProgress,
    onComplete,
    onError,
    adaptiveChunking
  ])

  // Cancel upload
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setState(prev => ({ 
        ...prev, 
        uploading: false, 
        error: 'Upload cancelled' 
      }))
    }
  }, [])

  // Reset state
  const reset = useCallback(() => {
    setState({
      uploading: false,
      progress: 0,
      error: null,
      uploadId: null,
      bytesUploaded: 0,
      totalBytes: 0
    })
  }, [])

  return {
    ...state,
    uploadFile,
    cancelUpload,
    reset
  }
}
