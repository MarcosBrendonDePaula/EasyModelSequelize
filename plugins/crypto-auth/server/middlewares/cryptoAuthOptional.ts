/**
 * Middleware OPCIONAL - adiciona user se autenticado, mas não requer
 * Não bloqueia requisições não autenticadas - permite acesso público
 */

import { Elysia } from 'elysia'
import type { Logger } from '@core/utils/logger'
import { validateAuthSync } from './helpers'

export interface CryptoAuthMiddlewareOptions {
  logger?: Logger
}

export const cryptoAuthOptional = (options: CryptoAuthMiddlewareOptions = {}) => {
  return new Elysia({ name: 'crypto-auth-optional' })
    .derive(async ({ request }) => {
      const result = await validateAuthSync(request as Request, options.logger)

      if (result.success && result.user) {
        ;(request as any).user = result.user
      }

      return {}
    })

}
