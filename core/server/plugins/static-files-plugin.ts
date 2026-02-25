// FluxStack Static Files Plugin - Serve Public Files & Uploads

import { mkdir } from 'fs/promises'
import { resolve, extname, basename } from 'path'
import type { Plugin, PluginContext } from '../../plugins/types'
import { pluginsConfig } from '@config'

/** MIME types that should force a download instead of rendering inline */
const DANGEROUS_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-executable',
  'application/x-sharedlib',
  'application/x-mach-binary',
  'application/x-dosexec',
  'application/x-httpd-php',
  'application/java-archive',
  'application/x-sh',
  'application/x-csh',
  'application/x-bat',
])

/** File extensions that should always force a download */
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.msi',
  '.sh', '.csh', '.bash', '.ps1', '.vbs', '.wsf',
  '.php', '.jsp', '.asp', '.aspx', '.py', '.rb', '.pl',
  '.jar', '.war', '.class',
  '.scr', '.pif', '.hta',
  '.svg', // SVG can contain embedded scripts
])

/** Extensions that carry a content hash in their filename (immutable) */
const HASHED_EXT = /\.[0-9a-f]{8,}\.\w+$/

/**
 * Generate a weak ETag from Bun.file() metadata.
 * Uses file.lastModified (ms timestamp) which is available without reading the file.
 * Size comes from stat() since BunFile.size is unreliable until contents are read.
 */
function generateETag(size: number, lastModified: number): string {
  return `W/"${size.toString(16)}-${lastModified.toString(16)}"`
}

/** Sanitize a filename for use in Content-Disposition header */
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:\0\x01-\x1f\x7f]/g, '_').replace(/"/g, '\\"')
}

/** Check if a MIME type or extension should force download */
function shouldForceDownload(filePath: string, mimeType: string | undefined): boolean {
  const ext = extname(filePath).toLowerCase()
  if (DANGEROUS_EXTENSIONS.has(ext)) return true
  if (mimeType && DANGEROUS_MIME_TYPES.has(mimeType)) return true
  return false
}

export const staticFilesPlugin: Plugin = {
  name: 'static-files',
  description: 'Serve static files and uploads',
  author: 'FluxStack Team',
  priority: 'normal',
  category: 'core',
  tags: ['static', 'files', 'uploads'],

  setup: async (context: PluginContext) => {
    if (!pluginsConfig.staticFilesEnabled) {
      context.logger.debug('Static files plugin disabled')
      return
    }

    const projectRoot = process.cwd()
    const publicDir = resolve(projectRoot, pluginsConfig.staticPublicDir ?? 'public')
    const uploadsDir = resolve(projectRoot, pluginsConfig.staticUploadsDir ?? 'uploads')
    const cacheMaxAge = pluginsConfig.staticCacheMaxAge
    const enablePublic = pluginsConfig.staticEnablePublic
    const enableUploads = pluginsConfig.staticEnableUploads

    // Async handler — uses Bun.file() APIs instead of Node fs
    const serveFile = (baseDir: string, isUpload: boolean) => async ({ params, set, request }: any) => {
      const requestedPath: string = params['*'] || ''

      // Reject null bytes early — prevents filesystem confusion
      if (requestedPath.includes('\0')) {
        set.status = 400
        return { error: 'Invalid path' }
      }

      const filePath = resolve(baseDir, requestedPath)

      // Path traversal protection
      if (!filePath.startsWith(baseDir)) {
        set.status = 400
        return { error: 'Invalid path' }
      }

      const file = Bun.file(filePath)

      // Bun.file().stat() — single async call, no Node fs import needed.
      // Returns size, isFile(), ctime etc. without reading file contents.
      let stat: Awaited<ReturnType<typeof file.stat>>
      try {
        stat = await file.stat()
        if (!stat.isFile()) {
          set.status = 404
          return { error: 'Not a file' }
        }
      } catch {
        set.status = 404
        return { error: 'File not found' }
      }

      // ETag from stat.size (reliable) + file.lastModified (Bun-native, no extra syscall)
      const etag = generateETag(stat.size, file.lastModified)
      const lastModified = new Date(file.lastModified).toUTCString()

      // Conditional request: If-None-Match takes priority over If-Modified-Since
      const ifNoneMatch = request?.headers?.get?.('if-none-match')
      if (ifNoneMatch && ifNoneMatch === etag) {
        set.status = 304
        return null
      }

      const ifModifiedSince = request?.headers?.get?.('if-modified-since')
      if (!ifNoneMatch && ifModifiedSince) {
        const clientDate = new Date(ifModifiedSince).getTime()
        if (!isNaN(clientDate) && file.lastModified <= clientDate) {
          set.status = 304
          return null
        }
      }

      // Security headers
      set.headers['x-content-type-options'] = 'nosniff'
      set.headers['etag'] = etag
      set.headers['last-modified'] = lastModified

      // Cache strategy: hashed assets are immutable, uploads get short cache
      if (!isUpload && HASHED_EXT.test(requestedPath)) {
        set.headers['cache-control'] = `public, max-age=${cacheMaxAge}, immutable`
      } else if (isUpload) {
        set.headers['cache-control'] = 'public, max-age=3600, must-revalidate'
      } else {
        set.headers['cache-control'] = `public, max-age=${cacheMaxAge}`
      }

      // Force download for dangerous MIME types
      // file.type is resolved from extension by Bun — no disk I/O
      if (shouldForceDownload(filePath, file.type)) {
        const fileName = sanitizeFilename(basename(requestedPath) || 'download')
        set.headers['content-disposition'] = `attachment; filename="${fileName}"`
      }

      // Returning Bun.file() directly lets Bun use sendfile(2) for zero-copy transfer
      return file
    }

    // Register routes based on config flags
    if (enablePublic) {
      await mkdir(publicDir, { recursive: true })
      context.app.get('/api/static/*', serveFile(publicDir, false))
      context.logger.debug('Static public files route registered: /api/static/*')
    }

    if (enableUploads) {
      await mkdir(uploadsDir, { recursive: true })
      context.app.get('/api/uploads/*', serveFile(uploadsDir, true))
      context.logger.debug('Static uploads route registered: /api/uploads/*')
    }

    const routes = [
      ...(enablePublic ? ['/api/static/*'] : []),
      ...(enableUploads ? ['/api/uploads/*'] : [])
    ]

    if (routes.length > 0) {
      context.logger.debug('Static files plugin ready', { routes })
    }
  }
}
