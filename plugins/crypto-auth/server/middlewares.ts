/**
 * Crypto Auth Middlewares
 * Middlewares Elysia para autenticação criptográfica
 *
 * Uso:
 * ```typescript
 * import { cryptoAuthRequired, cryptoAuthAdmin } from '@/plugins/crypto-auth/server'
 *
 * export const myRoutes = new Elysia()
 *   .use(cryptoAuthRequired())
 *   .get('/protected', ({ request }) => {
 *     const user = getCryptoAuthUser(request)
 *     return { user }
 *   })
 * ```
 */

// Re-export tudo do módulo middlewares
export * from './middlewares/index'
