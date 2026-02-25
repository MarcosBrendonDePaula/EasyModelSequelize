/**
 * FluxStack Application Server Entry Point
 *
 * Modos (via FLUXSTACK_MODE ou appConfig.mode):
 * - full-stack: Backend + Vite + LiveComponents (padrão)
 * - backend-only: Backend + LiveComponents (sem Vite)
 *
 * Frontend-only roda direto do core (core/client/standalone-entry.ts)
 *
 * 📖 Docs: ai-context/reference/plugin-security.md
 */

import { FluxStackFramework } from "@core/server"
import { vitePlugin } from "@core/plugins/built-in/vite"
import { swaggerPlugin } from "@core/plugins/built-in/swagger"
import { liveComponentsPlugin } from "@core/server/live/websocket-plugin"
import { appInstance } from "@server/app"
import { appConfig } from "@config"

// 🔒 Auth provider para Live Components
import { liveAuthManager } from "@core/server/live/auth"
import { DevAuthProvider } from "./auth/DevAuthProvider"

// 🔐 Auth system (Guard + Provider, Laravel-inspired)
import { initAuth } from "@server/auth"

// Registrar provider de desenvolvimento (tokens simples para testes)
liveAuthManager.register(new DevAuthProvider())
console.log('🔓 DevAuthProvider registered')

// Inicializar sistema de autenticação
initAuth()

const framework = new FluxStackFramework()
  .use(swaggerPlugin)
  .use(liveComponentsPlugin)

// Vite apenas em full-stack
if (appConfig.mode !== 'backend-only') {
  framework.use(vitePlugin)
}

framework.routes(appInstance)
await framework.listen()

export const app = framework
