import { useMemo } from 'react'
import { Live } from '../components/Live'
import { useLiveChunkedUpload } from './useLiveChunkedUpload'
import type { LiveChunkedUploadOptions } from './useLiveChunkedUpload'
import type { FileUploadCompleteResponse } from '@core/types/types'
import { LiveUpload } from '@server/live/LiveUpload'

export interface UseLiveUploadOptions {
  live?: {
    room?: string
    userId?: string
    autoMount?: boolean
    debug?: boolean
  }
  upload?: LiveChunkedUploadOptions
  onProgress?: (progress: number, bytesUploaded: number, totalBytes: number) => void
  onComplete?: (response: FileUploadCompleteResponse) => void
  onError?: (error: string) => void
}

export function useLiveUpload(options: UseLiveUploadOptions = {}) {
  const { live: liveOptions, upload: uploadOptions, onProgress, onComplete, onError } = options

  const live = Live.use(LiveUpload, {
    initialState: LiveUpload.defaultState,
    ...liveOptions
  })

  const mergedUploadOptions = useMemo<LiveChunkedUploadOptions>(() => {
    return {
      allowedTypes: [],
      maxFileSize: 500 * 1024 * 1024,
      adaptiveChunking: true,
      fileUrlResolver: (fileUrl) => fileUrl.startsWith('/uploads/') ? `/api${fileUrl}` : fileUrl,
      onProgress,
      onComplete,
      onError,
      ...uploadOptions
    }
  }, [onProgress, onComplete, onError, uploadOptions])

  const upload = useLiveChunkedUpload(live, mergedUploadOptions)

  const startUpload = useMemo(() => {
    return async (file: File) => {
      if (!live.$connected || !live.$componentId) {
        const msg = 'WebSocket nao conectado. Tente novamente.'
        onError?.(msg)
        await live.failUpload({ error: msg })
        return
      }
      await upload.uploadFile(file)
    }
  }, [live, upload, onError])

  return {
    live,
    state: live.$state,
    status: live.$state.status,
    connected: live.$connected,
    componentId: live.$componentId,
    uploading: upload.uploading,
    progress: upload.progress,
    bytesUploaded: upload.bytesUploaded,
    totalBytes: upload.totalBytes,
    error: live.$state.error,
    startUpload,
    cancelUpload: upload.cancelUpload,
    reset: upload.reset
  }
}
