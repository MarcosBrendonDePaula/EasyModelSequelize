/**
 * Standalone Frontend Development
 * Starts Vite dev server directly without Elysia backend
 */

import { clientConfig } from '@config'
import type { LogLevel } from 'vite'

type ViteDevServer = Awaited<ReturnType<typeof import('vite')['createServer']>>

let viteServer: ViteDevServer | null = null

export const startFrontendOnly = async (config: any = {}) => {
  const port = config.vitePort || clientConfig.vite.port || 5173
  const host = config.viteHost || clientConfig.vite.host || 'localhost'
  const logLevel = (config.logLevel || clientConfig.vite.logLevel || 'info') as LogLevel

  console.log(`⚛️  FluxStack Frontend Only`)
  console.log(`🌐 http://${host}:${port}`)
  console.log()

  try {
    // Dynamic import of vite
    const { createServer } = await import('vite')

    // Start Vite dev server programmatically
    viteServer = await createServer({
      configFile: './vite.config.ts',
      server: {
        port,
        host,
        strictPort: clientConfig.vite.strictPort
      },
      logLevel
    })

    await viteServer.listen()

    console.log(`✅ Frontend server ready!`)
    console.log()

    // Setup cleanup on process exit
    const cleanup = async () => {
      if (viteServer) {
        console.log('\n🛑 Stopping frontend...')
        await viteServer.close()
        viteServer = null
        process.exit(0)
      }
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('exit', cleanup)

    return viteServer

  } catch (error) {
    // Check if error is related to port already in use
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isPortInUse = errorMessage.includes('EADDRINUSE') ||
      errorMessage.includes('address already in use') ||
      (errorMessage.includes('Port') && errorMessage.includes('is in use'))

    if (isPortInUse) {
      console.error(`❌ Failed to start Vite: Port ${port} is already in use`)
      console.log(`💡 Try one of these solutions:`)
      console.log(`   1. Stop the process using port ${port}`)
      console.log(`   2. Change VITE_PORT in your .env file`)
      console.log(`   3. Kill the process: ${process.platform === 'win32' ? `netstat -ano | findstr :${port}` : `lsof -ti:${port} | xargs kill -9`}`)
      process.exit(1)
    } else {
      console.error('❌ Failed to start Vite server:', errorMessage)
      console.error('Full error:', error)
      process.exit(1)
    }
  }
}
