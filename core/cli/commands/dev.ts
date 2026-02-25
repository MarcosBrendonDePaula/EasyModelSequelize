/**
 * FluxStack CLI - Dev Command
 * Start full-stack development server with hot reload
 */

import type { CLICommand } from '../command-registry'
import { serverConfig, clientConfig } from '@config'

export const devCommand: CLICommand = {
  name: 'dev',
  description: 'Start full-stack development server',
  category: 'Development',
  usage: 'flux dev [options]',
  examples: [
    'flux dev                    # Start full-stack development',
    'flux dev --port 4000        # Start on custom port',
    'flux dev --frontend-only    # Start only frontend (Vite)',
    'flux dev --backend-only     # Start only backend (Elysia)'
  ],
  options: [
    {
      name: 'port',
      short: 'p',
      description: 'Port for backend server',
      type: 'number',
      default: serverConfig.server.port
    },
    {
      name: 'frontend-port',
      description: 'Port for frontend server',
      type: 'number',
      default: clientConfig.vite.port
    },
    {
      name: 'frontend-only',
      short: 'f',
      description: 'Start only the frontend (Vite dev server)',
      type: 'boolean',
      default: false
    },
    {
      name: 'backend-only',
      short: 'b',
      description: 'Start only the backend (Elysia server)',
      type: 'boolean',
      default: false
    }
  ],
  handler: async (args, options, context) => {
    const { spawn } = await import("child_process")

    const frontendOnly = options['frontend-only'] === true
    const backendOnly = options['backend-only'] === true

    if (frontendOnly && backendOnly) {
      console.error('❌ Cannot use --frontend-only and --backend-only together')
      process.exit(1)
    }

    // Determine mode and entry point
    const mode = frontendOnly ? 'Frontend only' : backendOnly ? 'Backend only' : 'Full-stack'

    // Frontend-only: roda direto do core (não passa pelo app/server/index.ts)
    const entryPoint = frontendOnly
      ? 'core/client/standalone-entry.ts'
      : 'app/server/index.ts'

    const fluxstackMode = backendOnly ? 'backend-only' : 'full-stack'

    console.log(`⚡ Starting ${mode} development server...`)

    const devProcess = spawn("bun", ["--watch", entryPoint], {
      stdio: "inherit",
      cwd: process.cwd(),
      env: {
        ...process.env,
        FRONTEND_PORT: options['frontend-port'].toString(),
        BACKEND_PORT: options.port.toString(),
        FLUXSTACK_MODE: fluxstackMode
      }
    })

    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down gracefully...')
      devProcess.kill('SIGTERM')
      setTimeout(() => {
        devProcess.kill('SIGKILL')
        process.exit(0)
      }, 5000)
    })

    devProcess.on('close', (code) => {
      process.exit(code || 0)
    })

    // Keep the CLI running until the child process exits
    return new Promise((resolve) => {
      devProcess.on('exit', resolve)
    })
  }
}
