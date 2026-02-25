/**
 * Authentication Hook
 * Core FluxStack authentication utilities
 */

import type { BaseUser, BaseUserStore } from '../state/index'

/**
 * Create authentication hook for a user store
 */
export function createAuthHook(useUserStore: () => BaseUserStore) {
  return function useAuth() {
    const store = useUserStore()
    
    return {
      // State
      currentUser: store.currentUser,
      isAuthenticated: store.isAuthenticated,
      isLoading: store.isLoading,
      error: store.error,
      
      // Computed
      isAdmin: store.currentUser?.role === 'admin',
      
      // Actions
      login: store.login,
      register: store.register,
      logout: store.logout,
      updateProfile: store.updateProfile,
      clearError: store.clearError
    }
  }
}

/**
 * Base auth hook interface
 */
export interface AuthHook {
  currentUser: BaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  isAdmin: boolean
  login: (credentials: { email: string; password: string }) => Promise<void>
  register: (data: { email: string; password: string; name: string }) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<BaseUser>) => Promise<void>
  clearError: () => void
}