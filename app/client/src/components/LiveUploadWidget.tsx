import { useEffect, useMemo, useState } from 'react'
import { useLiveChunkedUpload } from '@/core/client'
import type { LiveChunkedUploadOptions } from '@/core/client'
import type { FileUploadCompleteResponse } from '@core/types/types'
type LiveUploadActions = {
  $componentId: string | null
  $connected: boolean
  $state: {
    status: 'idle' | 'uploading' | 'complete' | 'error'
    progress: number
    fileName: string
    fileSize: number
    fileType: string
    fileUrl: string
    bytesUploaded: number
    totalBytes: number
    error: string | null
  }
  $error?: string | null
  startUpload: (payload: { fileName: string; fileSize: number; fileType: string }) => Promise<any>
  updateProgress: (payload: { progress: number; bytesUploaded: number; totalBytes: number }) => Promise<any>
  completeUpload: (payload: { fileUrl: string }) => Promise<any>
  failUpload: (payload: { error: string }) => Promise<any>
  reset: () => Promise<any>
}

export interface LiveUploadWidgetProps {
  live: LiveUploadActions
  title?: string
  description?: string
  allowPreview?: boolean
  options?: LiveChunkedUploadOptions
  onComplete?: (response: FileUploadCompleteResponse) => void
}

export function LiveUploadWidget({
  live,
  title = 'Upload em Chunks',
  description = 'Envio via WebSocket com Live Components e reatividade server-side.',
  allowPreview = true,
  options,
  onComplete
}: LiveUploadWidgetProps) {
  // live is expected to be a LiveUpload-compatible component
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const mergedOptions = useMemo<LiveChunkedUploadOptions>(() => {
    return {
      allowedTypes: [],
      maxFileSize: 500 * 1024 * 1024,
      adaptiveChunking: true,
      fileUrlResolver: (fileUrl) => fileUrl.startsWith('/uploads/') ? `/api${fileUrl}` : fileUrl,
      onComplete,
      ...options
    }
  }, [options, onComplete])

  const {
    uploading,
    bytesUploaded,
    totalBytes,
    uploadFile,
    cancelUpload,
    reset
  } = useLiveChunkedUpload(live, mergedOptions)

  const canUpload = live.$connected && !!live.$componentId && !uploading

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setLocalError(null)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }

    if (allowPreview && file && file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleStartUpload = async () => {
    if (!selectedFile) {
      setLocalError('Selecione um arquivo primeiro.')
      return
    }

    if (!live.$connected || !live.$componentId) {
      setLocalError('WebSocket ainda nao conectou. Tente novamente em alguns segundos.')
      return
    }

    setLocalError(null)
    await uploadFile(selectedFile)
  }

  const handleReset = async () => {
    setSelectedFile(null)
    setLocalError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    await reset()
  }

  const resolvedUrl = live.$state.fileUrl

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-xl w-full mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2 text-center">
        {title}
      </h2>

      <p className="text-gray-400 text-sm text-center mb-6">
        {description}
      </p>

      <div className="space-y-4">
        <input
          type="file"
          onChange={handleSelectFile}
          className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/20"
          disabled={!live.$connected}
        />

        <div className="flex gap-3">
          <button
            onClick={handleStartUpload}
            disabled={!canUpload || !selectedFile}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
          >
            Iniciar Upload
          </button>
          <button
            onClick={cancelUpload}
            disabled={!uploading}
            className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
          >
            Reset
          </button>
        </div>

        {(localError || live.$state.error || live.$error) && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {localError || live.$state.error || live.$error}
          </div>
        )}

        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Status: {live.$state.status}</span>
            <span>{Math.round(live.$state.progress)}%</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
              style={{ width: `${live.$state.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{live.$state.fileName || 'Nenhum arquivo selecionado'}</span>
            <span>{bytesUploaded > 0 ? `${Math.round(bytesUploaded / 1024)} KB` : ''}{totalBytes > 0 ? ` / ${Math.round(totalBytes / 1024)} KB` : ''}</span>
          </div>
        </div>

        {previewUrl && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">Preview</div>
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-48 w-full object-contain rounded-lg border border-white/10"
            />
          </div>
        )}

        {resolvedUrl && live.$state.status === 'complete' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm text-emerald-200">
            Upload concluido: <a className="underline" href={resolvedUrl} target="_blank" rel="noopener noreferrer">abrir arquivo</a>
          </div>
        )}
      </div>
    </div>
  )
}
