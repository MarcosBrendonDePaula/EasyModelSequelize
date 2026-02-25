// 🔒 CryptoAuth → LiveAuthProvider Adapter
//
// Integra o plugin crypto-auth com o sistema de autenticação de Live Components.
// Permite usar autenticação Ed25519 em componentes real-time.
//
// Uso:
//   import { CryptoAuthLiveProvider } from '@plugins/crypto-auth/server/CryptoAuthLiveProvider'
//   import { liveAuthManager } from '@core/server/live/auth'
//
//   liveAuthManager.register(new CryptoAuthLiveProvider(cryptoAuthService))

import type { CryptoAuthService } from './CryptoAuthService'
import type {
  LiveAuthProvider,
  LiveAuthCredentials,
  LiveAuthContext,
} from '@core/server/live/auth/types'
import { AuthenticatedContext, ANONYMOUS_CONTEXT } from '@core/server/live/auth/LiveAuthContext'

export class CryptoAuthLiveProvider implements LiveAuthProvider {
  readonly name = 'crypto-auth'
  private authService: CryptoAuthService

  constructor(authService: CryptoAuthService) {
    this.authService = authService
  }

  async authenticate(credentials: LiveAuthCredentials): Promise<LiveAuthContext | null> {
    const { publicKey, signature, timestamp, nonce } = credentials

    // Sem credenciais crypto = não autenticado
    if (!publicKey || !signature) {
      return null
    }

    const result = await this.authService.validateRequest({
      publicKey: publicKey as string,
      timestamp: (timestamp as number) || Date.now(),
      nonce: (nonce as string) || '',
      signature: signature as string,
    })

    if (!result.success || !result.user) {
      return null
    }

    return new AuthenticatedContext(
      {
        id: result.user.publicKey,
        roles: result.user.isAdmin ? ['admin'] : ['user'],
        permissions: result.user.permissions,
        publicKey: result.user.publicKey,
        isAdmin: result.user.isAdmin,
      },
      publicKey as string // token = publicKey
    )
  }
}
