# Live Upload (Chunked Upload via WebSocket)

**Version:** 1.14.0 | **Updated:** 2025-02-21

## Overview

FluxStack supports chunked file upload over the Live Components WebSocket. The
server tracks progress and assembles the file in `uploads/`. The client streams
chunks without loading the entire file into memory.

## Security Features

The upload system includes multiple layers of security:

- **MIME type allowlist** - Only safe file types accepted (images, PDF, text, JSON, archives)
- **Extension blocklist** - 31 dangerous extensions blocked (.exe, .bat, .sh, .dll, etc.)
- **Double extension prevention** - Detects `malware.exe.jpg` style attacks
- **Magic bytes validation** - Verifies actual file content matches claimed MIME type
- **Per-user upload quota** - 500MB/day per user to prevent disk exhaustion
- **File size limit** - 50MB max per file
- **Filename sanitization** - Path traversal prevention via `path.basename()`
- **Stale upload cleanup** - Abandoned uploads removed after 60 seconds

## Server: LiveUpload Component

```typescript
// app/server/live/LiveUpload.ts
import { LiveComponent } from '@core/types/types'
import { liveUploadDefaultState, type LiveUploadState } from '@app/shared'

export const defaultState: LiveUploadState = liveUploadDefaultState

export class LiveUpload extends LiveComponent<LiveUploadState> {
  static componentName = 'LiveUpload'
  static publicActions = ['startUpload', 'updateProgress', 'completeUpload', 'failUpload', 'reset'] as const
  static defaultState = defaultState

  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
  }

  async startUpload(payload: { fileName: string; fileSize: number; fileType: string }) {
    const normalized = payload.fileName.toLowerCase()
    if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
      throw new Error('Invalid file name')
    }

    const ext = normalized.includes('.') ? normalized.split('.').pop() || '' : ''
    const blocked = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'jar']
    if (ext && blocked.includes(ext)) {
      throw new Error(`File extension not allowed: .${ext}`)
    }

    this.setState({
      status: 'uploading',
      progress: 0,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.fileType,
      fileUrl: '',
      bytesUploaded: 0,
      totalBytes: payload.fileSize,
      error: null
    })

    return { success: true }
  }

  async updateProgress(payload: { progress: number; bytesUploaded: number; totalBytes: number }) {
    const progress = Math.max(0, Math.min(100, payload.progress))
    this.setState({
      progress,
      bytesUploaded: payload.bytesUploaded,
      totalBytes: payload.totalBytes
    })

    return { success: true, progress }
  }

  async completeUpload(payload: { fileUrl: string }) {
    this.setState({
      status: 'complete',
      progress: 100,
      fileUrl: payload.fileUrl,
      error: null
    })

    return { success: true }
  }

  async failUpload(payload: { error: string }) {
    this.setState({
      status: 'error',
      error: payload.error || 'Upload failed'
    })

    return { success: true }
  }

  async reset() {
    this.setState({ ...defaultState })
    return { success: true }
  }
}
```

## Client: useLiveUpload + Widget

```typescript
// app/client/src/live/UploadDemo.tsx
import { useLiveUpload } from './useLiveUpload'
import { LiveUploadWidget } from '../components/LiveUploadWidget'

export function UploadDemo() {
  const { live } = useLiveUpload()

  return (
    <LiveUploadWidget live={live} />
  )
}
```

## Chunked Upload Flow

1. Client calls `startUpload()` (Live Component action).
2. Client streams file chunks over WebSocket with `useChunkedUpload`.
3. Server receives chunks and validates size/count.
4. On completion, server validates **magic bytes** against claimed MIME type.
5. Server assembles file in `uploads/` with UUID filename and returns `/uploads/...`.
6. Client maps to `/api/uploads/...` for access.

## Magic Bytes Validation

The server validates actual file content against known magic byte signatures before assembling:

| MIME Type | Magic Bytes |
|-----------|-------------|
| `image/jpeg` | `FF D8 FF` |
| `image/png` | `89 50 4E 47 0D 0A 1A 0A` |
| `image/gif` | `47 49 46 38 37 61` or `47 49 46 38 39 61` |
| `image/webp` | `52 49 46 46` (RIFF header) |
| `application/pdf` | `25 50 44 46` (%PDF) |
| `application/zip` | `50 4B 03 04` or `50 4B 05 06` |
| `application/gzip` | `1F 8B` |

Text-based types (text/plain, text/csv, application/json, image/svg+xml) skip binary validation.

## Per-User Upload Quotas

Each authenticated user has a daily upload quota (default: 500MB/day):

- Quota is checked before upload starts
- Quota is reserved when upload begins (even if upload doesn't complete)
- Quotas reset daily
- Anonymous uploads (no userId) bypass quota checks

```typescript
// Check user's remaining quota
const usage = fileUploadManager.getUserUploadUsage(userId)
// { used: 104857600, limit: 524288000, remaining: 419430400 }
```

## Error Handling

- If an action throws, the error surfaces in `live.$error` on the client.
- The widget shows `localError || state.error || $error`.
- Magic bytes validation failure: `"File content does not match claimed type 'image/jpeg'"`
- Quota exceeded: `"Upload quota exceeded for user"`
- Double extension: `"Suspicious double extension detected: .exe in malware.exe.jpg"`

## Files Involved

**Server**
- `app/server/live/LiveUpload.ts`
- `core/server/live/FileUploadManager.ts` (chunk handling, magic bytes, quotas, file assembly)
- `core/server/live/websocket-plugin.ts` (upload message routing, userId passthrough)

**Client**
- `core/client/hooks/useChunkedUpload.ts` (streaming chunks)
- `core/client/hooks/useLiveUpload.ts` (Live Component wrapper)
- `app/client/src/components/LiveUploadWidget.tsx` (UI)
