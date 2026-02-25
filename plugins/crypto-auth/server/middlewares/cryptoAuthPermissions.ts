/**
 * Middleware que REQUER permissões específicas
 * Bloqueia requisições sem as permissões necessárias (403)
 */

import { Elysia } from 'elysia'
import { createGuard } from '@core/server/middleware/elysia-helpers'
import type { Logger } from '@core/utils/logger'
import { validateAuthSync, type CryptoAuthUser } from './helpers'

export interface CryptoAuthMiddlewareOptions {
  logger?: Logger
}

export const cryptoAuthPermissions = (
  requiredPermissions: string[],
  options: CryptoAuthMiddlewareOptions = {}
) => {
  return new Elysia({ name: 'crypto-auth-permissions' })
    .derive(async ({ request }) => {
      const result = await validateAuthSync(request as Request, options.logger)

      if (result.success && result.user) {
        ;(request as any).user = result.user
      }

      return {}
    })
    .use(
      createGuard({
        name: 'crypto-auth-permissions-check',
        check: ({ request }) => {
          const user = (request as any).user as CryptoAuthUser | undefined

          if (!user) return false

          const userPermissions = user.permissions
          return requiredPermissions.every(
            perm => userPermissions.includes(perm) || userPermissions.includes('admin')
          )
        },
        onFail: (set, { request }) => {
          const user = (request as any).user as CryptoAuthUser | undefined

          if (!user) {
            set.status = 401
            return {
              error: {
                message: 'Authentication required',
                code: 'CRYPTO_AUTH_REQUIRED',
                statusCode: 401
              }
            }
          }

          options.logger?.warn('Permission denied', {
            publicKey: user.publicKey.substring(0, 8) + '...',
            required: requiredPermissions,
            has: user.permissions
          })

          set.status = 403
          return {
            error: {
              message: 'Insufficient permissions',
              code: 'PERMISSION_DENIED',
              statusCode: 403,
              required: requiredPermissions,
              yours: user.permissions
            }
          }
        }
      })
    )

}
