import { useState } from 'react'
import { LiveUploadWidget } from '../components/LiveUploadWidget'
import { useLiveUpload } from '@/core/client'

export function UploadDemo() {
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  const { live } = useLiveUpload({
    onComplete: (response) => setLastUrl(response.fileUrl || null)
  })

  return (
    <div className="flex flex-col gap-4 max-w-xl w-full mx-auto">
      <LiveUploadWidget live={live} />
      {lastUrl && (
        <div className="text-xs text-gray-500 text-center">
          Ultimo arquivo: {lastUrl}
        </div>
      )}
    </div>
  )
}
