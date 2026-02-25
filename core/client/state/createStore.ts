/**
 * Store Factory
 * Core FluxStack state management utilities
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface StoreOptions<T> {
  name?: string
  persist?: boolean
  storage?: 'localStorage' | 'sessionStorage'
  version?: number
  migrate?: (persistedState: unknown, version: number) => T
}

/**
 * Create a Zustand store with FluxStack conventions
 */
export function createFluxStore<T>(
  storeFactory: (set: any, get: any) => T,
  options: StoreOptions<T> = {}
) {
  const { name, persist: shouldPersist = false, storage = 'localStorage', version = 1, migrate } = options

  if (shouldPersist && name) {
    return create<T>()(
      persist(
        storeFactory,
        {
          name,
          storage: createJSONStorage(() => 
            storage === 'localStorage' ? localStorage : sessionStorage
          ),
          version,
          migrate: migrate as any,
          onRehydrateStorage: () => (state) => {
            console.log('FluxStack: Store rehydrated', name, state)
          }
        }
      )
    )
  }

  return create<T>()(storeFactory)
}

/**
 * Base user store interface
 */
export interface BaseUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

export interface BaseUserStore {
  currentUser: BaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (credentials: { email: string; password: string }) => Promise<void>
  register: (data: { email: string; password: string; name: string }) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<BaseUser>) => Promise<void>
  clearError: () => void
  setLoading: (loading: boolean) => void
}

/**
 * Create user store with FluxStack conventions
 */
export function createUserStore(options: StoreOptions<BaseUserStore> = {}) {
  return createFluxStore<BaseUserStore>(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Login failed')
          }

          const { user } = await response.json()
          set({ 
            currentUser: user, 
            isAuthenticated: true, 
            isLoading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Login failed', 
            isLoading: false 
          })
          throw error
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Registration failed')
          }

          const { user } = await response.json()
          set({ 
            currentUser: user, 
            isAuthenticated: true, 
            isLoading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Registration failed', 
            isLoading: false 
          })
          throw error
        }
      },

      logout: () => {
        // Call logout API
        fetch('/api/auth/logout', { method: 'POST' }).catch(console.error)
        
        set({ 
          currentUser: null, 
          isAuthenticated: false, 
          error: null 
        })
      },

      updateProfile: async (data) => {
        const { currentUser } = get()
        if (!currentUser) {
          throw new Error('No user logged in')
        }

        set({ isLoading: true, error: null })
        try {
          const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Profile update failed')
          }

          const { user } = await response.json()
          set({ 
            currentUser: user, 
            isLoading: false 
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Profile update failed', 
            isLoading: false 
          })
          throw error
        }
      },

      clearError: () => set({ error: null }),
      setLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: 'user-store',
      persist: true,
      ...options
    }
  )
}