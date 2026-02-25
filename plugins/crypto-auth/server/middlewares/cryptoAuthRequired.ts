/**
 * Middleware que REQUER autenticação
 * Bloqueia requisições não autenticadas com 401
 */

import { Elysia } from 'elysia'
import { createGuard } from '@core/server/middleware/elysia-helpers'
import type { Logger } from '@core/utils/logger'
import { validateAuthSync } from './helpers'

export interface CryptoAuthMiddlewareOptions {
  logger?: Logger
}

export const cryptoAuthRequired = (options: CryptoAuthMiddlewareOptions = {}) => {
  return new Elysia({ name: 'crypto-auth-required' })
    .derive(async ({ request }) => {
      const result = await validateAuthSync(request as Request, options.logger)

      if (result.success && result.user) {
        ;(request as any).user = result.user
      }

      return {}
    })
    .use(
      createGuard({
        name: 'crypto-auth-check',
        check: ({ request }) => {
          return !!(request as any).user
        },
        onFail: (set) => {
          set.status = 401
          return {
            error: {
              message: 'Authentication required',
              code: 'CRYPTO_AUTH_REQUIRED',
              statusCode: 401
            }
          }
        }
      })
    )

}
