import { join } from "path"
import { statSync, existsSync } from "fs"
import type { Plugin, PluginContext } from "@core/plugins"

// Default configuration values
const DEFAULTS = {
  enabled: true,
  publicDir: "./dist/client",
  indexFile: "index.html"
}

export const staticPlugin: Plugin = {
  name: "static",
  version: "2.0.0",
  description: "Simple and efficient static file serving plugin for FluxStack",
  author: "FluxStack Team",
  priority: 200, // Run after all other plugins
  category: "core",
  tags: ["static", "files", "spa"],
  dependencies: [],

  setup: async (context: PluginContext) => {
    if (!DEFAULTS.enabled) {
      context.logger.info('Static files plugin disabled')
      return
    }

    context.logger.info("Static files plugin activated", {
      publicDir: DEFAULTS.publicDir
    })

    // Static fallback handler (runs last)
    const staticFallback = (c: any) => {
      const req = c.request
      if (!req) return

      const url = new URL(req.url)
      let pathname = decodeURIComponent(url.pathname)

      // Determine base directory using path discovery
      const isDev = context.utils.isDevelopment()
      let baseDir: string

      if (isDev && existsSync(DEFAULTS.publicDir)) {
        // Development: use public directory
        baseDir = DEFAULTS.publicDir
      } else {
        // Production: try paths in order of preference
        if (existsSync('client')) {
          // Found client/ in current directory (running from dist/)
          baseDir = 'client'
        } else if (existsSync('dist/client')) {
          // Found dist/client/ (running from project root)
          baseDir = 'dist/client'
        } else {
          // Fallback to configured path
          baseDir = DEFAULTS.publicDir
        }
      }

      // Root or empty path → index.html
      if (pathname === '/' || pathname === '') {
        pathname = `/${DEFAULTS.indexFile}`
      }

      const filePath = join(baseDir, pathname)

      try {
        const info = statSync(filePath)

        // File exists → serve it
        if (info.isFile()) {
          return new Response(Bun.file(filePath))
        }
      } catch (_) {
        // File not found → continue
      }

      // SPA fallback: serve index.html for non-file routes
      const indexPath = join(baseDir, DEFAULTS.indexFile)
      try {
        statSync(indexPath) // Ensure index exists
        return new Response(Bun.file(indexPath))
      } catch (_) {
        // Index not found → let request continue (404)
      }
    }

    // Register as catch-all fallback (runs after all other routes)
    context.app.all('*', staticFallback)
  },

  onServerStart: async (context: PluginContext) => {
    if (DEFAULTS.enabled) {
      context.logger.info(`Static files plugin ready`, {
        publicDir: DEFAULTS.publicDir,
        indexFile: DEFAULTS.indexFile
      })
    }
  }
}

export default staticPlugin