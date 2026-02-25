/**
 * FluxStack Client Framework Utilities
 * Provides client-side utilities and integrations
 */

import type { FluxStackConfig } from "../types"

export interface ClientFrameworkOptions {
  config: FluxStackConfig
  baseUrl?: string
  timeout?: number
  retries?: number
}

export class FluxStackClient {
  private config: FluxStackConfig
  private baseUrl: string
  private timeout: number
  private retries: number

  constructor(options: ClientFrameworkOptions) {
    this.config = options.config
    this.baseUrl = options.baseUrl || `http://localhost:${options.config.server.port}`
    this.timeout = options.timeout || 10000
    this.retries = options.retries || 3
  }

  // Create a configured fetch client
  createFetchClient() {
    return async (url: string, options: RequestInit = {}) => {
      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`
      
      const requestOptions: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      }

      // Add timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)
      requestOptions.signal = controller.signal

      try {
        const response = await fetch(fullUrl, requestOptions)
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        return response
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    }
  }

  // Create API client with retry logic
  createApiClient() {
    const fetchClient = this.createFetchClient()
    
    return {
      get: async <T>(url: string): Promise<T> => {
        return this.withRetry(async () => {
          const response = await fetchClient(url, { method: 'GET' })
          return response.json()
        })
      },
      
      post: async <T>(url: string, data: any): Promise<T> => {
        return this.withRetry(async () => {
          const response = await fetchClient(url, {
            method: 'POST',
            body: JSON.stringify(data)
          })
          return response.json()
        })
      },
      
      put: async <T>(url: string, data: any): Promise<T> => {
        return this.withRetry(async () => {
          const response = await fetchClient(url, {
            method: 'PUT',
            body: JSON.stringify(data)
          })
          return response.json()
        })
      },
      
      delete: async <T>(url: string): Promise<T> => {
        return this.withRetry(async () => {
          const response = await fetchClient(url, { method: 'DELETE' })
          return response.json()
        })
      }
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === this.retries) {
          throw lastError
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }

  getConfig(): FluxStackConfig {
    return this.config
  }

  getBaseUrl(): string {
    return this.baseUrl
  }
}