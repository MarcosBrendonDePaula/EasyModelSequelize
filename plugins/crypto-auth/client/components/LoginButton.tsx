/**
 * Componente de Botão de Login
 * Componente React para autenticação criptográfica baseada em keypair
 */

import React, { useState, useEffect } from 'react'
import { CryptoAuthClient, type KeyPair } from '../CryptoAuthClient'

export interface LoginButtonProps {
  onLogin?: (keys: KeyPair) => void
  onLogout?: () => void
  onError?: (error: string) => void
  className?: string
  loginText?: string
  logoutText?: string
  loadingText?: string
  authClient?: CryptoAuthClient
}

export const LoginButton: React.FC<LoginButtonProps> = ({
  onLogin,
  onLogout,
  onError,
  className = '',
  loginText = 'Gerar Chaves',
  logoutText = 'Limpar Chaves',
  loadingText = 'Carregando...',
  authClient
}) => {
  const [client] = useState(() => authClient || new CryptoAuthClient({ autoInit: false }))
  const [hasKeys, setHasKeys] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [keys, setKeys] = useState<KeyPair | null>(null)

  useEffect(() => {
    checkKeysStatus()
  }, [])

  const checkKeysStatus = () => {
    try {
      const existingKeys = client.getKeys()
      if (existingKeys) {
        setHasKeys(true)
        setKeys(existingKeys)
      } else {
        setHasKeys(false)
        setKeys(null)
      }
    } catch (error) {
      console.error('Erro ao verificar chaves:', error)
      setHasKeys(false)
      setKeys(null)
    }
  }

  const handleLogin = () => {
    setIsLoading(true)
    try {
      const newKeys = client.createNewKeys()
      setHasKeys(true)
      setKeys(newKeys)
      onLogin?.(newKeys)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('Erro ao gerar chaves:', error)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setIsLoading(true)
    try {
      client.clearKeys()
      setHasKeys(false)
      setKeys(null)
      onLogout?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      console.error('Erro ao limpar chaves:', error)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const baseClassName = `
    px-4 py-2 rounded-md font-medium transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `.trim()

  if (isLoading) {
    return (
      <button
        disabled
        className={`${baseClassName} bg-gray-400 text-white cursor-not-allowed ${className}`}
      >
        {loadingText}
      </button>
    )
  }

  if (hasKeys && keys) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">
            Autenticado
          </span>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {keys.publicKey.substring(0, 16)}...
          </code>
        </div>

        <button
          onClick={handleLogout}
          className={`${baseClassName} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 ${className}`}
        >
          {logoutText}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleLogin}
      className={`${baseClassName} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 ${className}`}
    >
      {loginText}
    </button>
  )
}

export default LoginButton
