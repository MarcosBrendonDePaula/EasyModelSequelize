/**
 * Exportações dos componentes do cliente
 */

export { LoginButton } from './LoginButton'
export type { LoginButtonProps } from './LoginButton'

export { AuthProvider, useAuth } from './AuthProvider'
export type { AuthProviderProps, AuthContextValue } from './AuthProvider'

export { ProtectedRoute, withAuth } from './ProtectedRoute'
export type { ProtectedRouteProps } from './ProtectedRoute'