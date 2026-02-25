/**
 * FluxStack Crypto Auth Plugin
 * Sistema de autenticação baseado em criptografia Ed25519
 */

import type { FluxStack, PluginContext, RequestContext, ResponseContext } from "@core/plugins/types"

type Plugin = FluxStack.Plugin
import { Elysia, t } from "elysia"
import { CryptoAuthService, AuthMiddleware } from "./server"
import { CryptoAuthLiveProvider } from "./server/CryptoAuthLiveProvider"
import { liveAuthManager } from "@core/server/live/auth"
import { makeProtectedRouteCommand } from "./cli/make-protected-route.command"

// ✅ Plugin carrega sua própria configuração (da pasta config/ do plugin)
import { cryptoAuthConfig } from "./config"

// Response schema for auth info endpoint
const AuthInfoResponseSchema = t.Object({
  name: t.String(),
  description: t.String(),
  version: t.String(),
  mode: t.String(),
  how_it_works: t.Object({
    step1: t.String(),
    step2: t.String(),
    step3: t.String(),
    step4: t.String(),
    step5: t.String()
  }),
  required_headers: t.Object({
    "x-public-key": t.String(),
    "x-timestamp": t.String(),
    "x-nonce": t.String(),
    "x-signature": t.String()
  }),
  admin_keys: t.Number(),
  usage: t.Object({
    required: t.String(),
    admin: t.String(),
    optional: t.String(),
    permissions: t.String()
  })
}, {
  description: 'Crypto Auth plugin information and usage instructions'
})

// Store config globally for hooks to access
let pluginConfig: any = cryptoAuthConfig

export const cryptoAuthPlugin: Plugin = {
  name: "crypto-auth",
  version: "1.0.0",
  description: "Sistema de autenticação baseado em criptografia Ed25519 para FluxStack",
  author: "FluxStack Team",
  priority: 100, // Alta prioridade para autenticação
  category: "auth",
  tags: ["authentication", "ed25519", "cryptography", "security"],
  dependencies: [],

  // ✅ Plugin usa sistema declarativo de configuração (plugins/crypto-auth/config/)
  // ❌ Removido: configSchema e defaultConfig (redundante com nova estrutura)
  // 📖 Configuração gerenciada por defineConfig() com type inference automática

  // CLI Commands
  commands: [
    makeProtectedRouteCommand
  ],

  setup: async (context: PluginContext) => {
    // ✅ Plugin usa sua própria configuração (já importada no topo)
    if (!cryptoAuthConfig.enabled) {
      context.logger.info('Crypto Auth plugin desabilitado por configuração')
      return
    }

    // Inicializar serviço de autenticação (SEM SESSÕES)
    const authService = new CryptoAuthService({
      maxTimeDrift: cryptoAuthConfig.maxTimeDrift ?? 300000,
      adminKeys: cryptoAuthConfig.adminKeys ?? [],
      logger: context.logger
    })

    // Inicializar middleware de autenticação (sem path matching)
    const authMiddleware = new AuthMiddleware(authService, {
      logger: context.logger
    })

    // Armazenar instâncias no contexto global
    ;(global as any).cryptoAuthService = authService
    ;(global as any).cryptoAuthMiddleware = authMiddleware

    // 🔒 Register as LiveAuthProvider for Live Components WebSocket auth
    liveAuthManager.register(new CryptoAuthLiveProvider(authService))
    context.logger.info('🔒 Crypto Auth registered as Live Components auth provider')

    // Store plugin info for table display
    if (!(global as any).__fluxstackPlugins) {
      (global as any).__fluxstackPlugins = []
    }
    (global as any).__fluxstackPlugins.push({
      name: 'Crypto Auth',
      status: 'Active',
      details: `${(cryptoAuthConfig.adminKeys ?? []).length} admin keys`
    })
  },

  // @ts-ignore - plugin property não está no tipo oficial mas é suportada
  plugin: new Elysia({ prefix: "/api/auth", tags: ['Authentication'] })
    .get("/info", () => ({
      name: "FluxStack Crypto Auth",
      description: "Autenticação baseada em assinatura Ed25519",
      version: "1.0.0",
      mode: "middleware-based",
      how_it_works: {
        step1: "Cliente gera par de chaves Ed25519 (pública + privada) localmente",
        step2: "Cliente armazena chave privada no navegador (NUNCA envia ao servidor)",
        step3: "Para cada requisição, cliente assina com chave privada",
        step4: "Cliente envia: chave pública + assinatura + dados",
        step5: "Servidor valida assinatura usando chave pública recebida"
      },
      required_headers: {
        "x-public-key": "Chave pública Ed25519 (hex 64 chars)",
        "x-timestamp": "Timestamp da requisição (milliseconds)",
        "x-nonce": "Nonce aleatório (previne replay)",
        "x-signature": "Assinatura Ed25519 da mensagem (hex)"
      },
      admin_keys: (global as any).cryptoAuthService?.getStats().adminKeys || 0,
      usage: {
        required: "import { cryptoAuthRequired } from '@/plugins/crypto-auth/server'",
        admin: "import { cryptoAuthAdmin } from '@/plugins/crypto-auth/server'",
        optional: "import { cryptoAuthOptional } from '@/plugins/crypto-auth/server'",
        permissions: "import { cryptoAuthPermissions } from '@/plugins/crypto-auth/server'"
      }
    }), {
      detail: {
        summary: 'Crypto Auth Plugin Information',
        description: 'Returns information about the Ed25519-based cryptographic authentication system, including how it works, required headers, and usage examples',
        tags: ['Authentication', 'Security', 'Crypto']
      },
      response: AuthInfoResponseSchema
    }),

  onResponse: async (context: ResponseContext) => {
    if (!cryptoAuthConfig.enableMetrics) return

    // Log métricas de autenticação
    const user = (context as any).user
    const authError = (context as any).authError

    if (user) {
      console.debug("Requisição autenticada", {
        publicKey: user.publicKey?.substring(0, 8) + "...",
        isAdmin: user.isAdmin,
        path: context.path,
        method: context.method,
        duration: context.duration
      })
    } else if (authError) {
      console.warn("Falha na autenticação", {
        error: authError,
        path: context.path,
        method: context.method
      })
    }
  },

  onServerStart: async (context: PluginContext) => {
    // Silent - plugin is already initialized
  }
}

export default cryptoAuthPlugin