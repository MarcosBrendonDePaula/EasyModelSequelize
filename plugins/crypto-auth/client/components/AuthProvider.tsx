/**
 * Provedor de Contexto de Autenticação
 * Context Provider React para gerenciar chaves criptográficas
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CryptoAuthClient, type KeyPair, type AuthConfig } from '../CryptoAuthClient'

export interface AuthContextValue {
  client: CryptoAuthClient
  keys: KeyPair | null
  hasKeys: boolean
  isLoading: boolean
  error: string | null
  createKeys: () => void
  clearKeys: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export interface AuthProviderProps {
  children: ReactNode
  config?: AuthConfig
  onKeysChange?: (hasKeys: boolean, keys: KeyPair | null) => void
  onError?: (error: string) => void
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  config = {},
  onKeysChange,
  onError
}) => {
  const [client] = useState(() => new CryptoAuthClient({ ...config, autoInit: false }))
  const [keys, setKeys] = useState<KeyPair | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasKeys = keys !== null

  useEffect(() => {
    initializeKeys()
  }, [])

  useEffect(() => {
    onKeysChange?.(hasKeys, keys)
  }, [hasKeys, keys, onKeysChange])

  const initializeKeys = () => {
    setIsLoading(true)
    setError(null)

    try {
      const existingKeys = client.getKeys()
      if (existingKeys) {
        setKeys(existingKeys)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Erro ao inicializar chaves:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const createKeys = () => {
    setIsLoading(true)
    setError(null)

    try {
      const newKeys = client.createNewKeys()
      setKeys(newKeys)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar chaves'
      setError(errorMessage)
      onError?.(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const clearKeys = () => {
    setIsLoading(true)
    setError(null)

    try {
      client.clearKeys()
      setKeys(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao limpar chaves'
      setError(errorMessage)
      onError?.(errorMessage)
      // Mesmo com erro, limpar as chaves locais
      setKeys(null)
    } finally {
      setIsLoading(false)
    }
  }

  const contextValue: AuthContextValue = {
    client,
    keys,
    hasKeys,
    isLoading,
    error,
    createKeys,
    clearKeys
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook para usar o contexto de autenticação
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

export default AuthProvider