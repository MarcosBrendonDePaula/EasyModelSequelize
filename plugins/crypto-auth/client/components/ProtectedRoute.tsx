/**
 * Componente de Rota Protegida
 * Protege componentes que requerem chaves criptográficas no client-side
 *
 * NOTA: Este componente apenas verifica se há chaves locais.
 * A autenticação real acontece no backend via validação de assinatura.
 */

import React, { type ReactNode } from 'react'
import { useAuth } from './AuthProvider'

export interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
  loadingComponent?: ReactNode
  unauthorizedComponent?: ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback,
  loadingComponent,
  unauthorizedComponent
}) => {
  const { hasKeys, isLoading, error } = useAuth()

  // Componente de loading padrão
  const defaultLoadingComponent = (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-600">Verificando chaves...</span>
    </div>
  )

  // Componente de não autorizado padrão
  const defaultUnauthorizedComponent = (
    <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
      <div className="text-red-600 mb-4">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-red-800 mb-2">Chaves Não Encontradas</h3>
      <p className="text-red-600 text-center">
        Você precisa gerar chaves criptográficas para acessar esta página.
      </p>
      {error && (
        <p className="text-red-500 text-sm mt-2">
          Erro: {error}
        </p>
      )}
    </div>
  )

  // Mostrar loading enquanto verifica
  if (isLoading) {
    return <>{loadingComponent || defaultLoadingComponent}</>
  }

  // Verificar se tem chaves
  if (!hasKeys) {
    return <>{unauthorizedComponent || fallback || defaultUnauthorizedComponent}</>
  }

  // Tem chaves, renderizar children
  // NOTA: Isso não garante autenticação no backend!
  // O backend ainda validará a assinatura em cada requisição.
  return <>{children}</>
}

/**
 * HOC para proteger componentes
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ProtectedRouteProps, 'children'> = {}
) {
  const WrappedComponent = (props: P) => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  )

  WrappedComponent.displayName = `withAuth(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default ProtectedRoute
