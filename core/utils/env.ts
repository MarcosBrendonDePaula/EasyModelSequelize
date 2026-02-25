/**
 * ⚡ FluxStack Unified Environment Loader
 *
 * Single source of truth for environment variables with:
 * - Automatic type casting
 * - Build-safe dynamic access (prevents Bun inlining)
 * - Simple, intuitive API
 * - TypeScript type inference
 *
 * @example
 * ```ts
 * import { env } from '@core/utils/env'
 *
 * const port = env.PORT                    // number (3000)
 * const debug = env.DEBUG                  // boolean (false)
 * const origins = env.CORS_ORIGINS         // string[] (['*'])
 *
 * // Custom vars with smart casting
 * const timeout = env.get('TIMEOUT', 5000)        // number
 * const enabled = env.get('FEATURE_X', false)     // boolean
 * const tags = env.get('TAGS', ['api'])           // string[]
 * ```
 */

/**
 * Smart environment loader with dynamic access
 * Uses Bun.env (runtime) → process.env (fallback) → eval (last resort)
 */
class EnvLoader {
  private cache = new Map<string, any>()
  private accessor: () => Record<string, string | undefined>

  constructor() {
    this.accessor = this.createAccessor()
  }

  /**
   * Create dynamic accessor to prevent build-time inlining
   */
  private createAccessor(): () => Record<string, string | undefined> {
    const global = globalThis as any

    return () => {
      // Try Bun.env first (most reliable in Bun)
      if (global['Bun']?.['env']) {
        return global['Bun']['env']
      }

      // Fallback to process.env
      if (global['process']?.['env']) {
        return global['process']['env']
      }

      return {}
    }
  }

  /**
   * Get environment variable with automatic type casting
   * Type is inferred from defaultValue
   */
  get<T>(key: string, defaultValue?: T): T {
    // Check cache first
    const cacheKey = `${key}:${typeof defaultValue}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    const env = this.accessor()
    const value = env[key]

    if (!value || value === '') {
      this.cache.set(cacheKey, defaultValue as T)
      return defaultValue as T
    }

    // Auto-detect type from defaultValue
    let result: any = value

    if (typeof defaultValue === 'number') {
      const parsed = Number(value)
      result = isNaN(parsed) ? defaultValue : parsed
    } else if (typeof defaultValue === 'boolean') {
      result = ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
    } else if (Array.isArray(defaultValue)) {
      result = value.split(',').map(v => v.trim()).filter(Boolean)
    } else if (typeof defaultValue === 'object' && defaultValue !== null) {
      try {
        result = JSON.parse(value)
      } catch {
        result = defaultValue
      }
    }

    this.cache.set(cacheKey, result)
    return result as T
  }

  /**
   * Check if environment variable exists and has a value
   */
  has(key: string): boolean {
    const env = this.accessor()
    const value = env[key]
    return value !== undefined && value !== ''
  }

  /**
   * Get all environment variables
   */
  all(): Record<string, string> {
    const env = this.accessor()
    const result: Record<string, string> = {}

    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined && value !== '') {
        result[key] = value
      }
    }

    return result
  }

  /**
   * Require specific environment variables (throws if missing)
   */
  require(keys: string[]): void {
    const missing = keys.filter(key => !this.has(key))
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        `Please set them in your .env file or environment.`
      )
    }
  }

  /**
   * Validate environment variable value
   */
  validate(key: string, validValues: string[]): void {
    const value = this.get(key, '')
    if (value && !validValues.includes(value)) {
      throw new Error(
        `Invalid value for ${key}: "${value}"\n` +
        `Valid values are: ${validValues.join(', ')}`
      )
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// Singleton instance
const loader = new EnvLoader()

/**
 * Unified environment variables API
 */
export const env = {
  /**
   * Get environment variable with smart type casting
   * @example env.get('PORT', 3000) → number
   */
  get: <T>(key: string, defaultValue?: T): T => loader.get(key, defaultValue),

  /**
   * Check if environment variable exists
   */
  has: (key: string): boolean => loader.has(key),

  /**
   * Get all environment variables
   */
  all: (): Record<string, string> => loader.all(),

  /**
   * Require environment variables (throws if missing)
   */
  require: (keys: string[]): void => loader.require(keys),

  /**
   * Validate environment variable value
   */
  validate: (key: string, validValues: string[]): void => loader.validate(key, validValues),

  /**
   * Clear cache (for testing)
   */
  clearCache: (): void => loader.clearCache(),

  // Common environment variables with smart defaults
  get NODE_ENV() { return this.get('NODE_ENV', 'development') as 'development' | 'production' | 'test' },
  get PORT() { return this.get('PORT', 3000) },
  get HOST() { return this.get('HOST', 'localhost') },
  get DEBUG() { return this.get('DEBUG', false) },
  get LOG_LEVEL() { return this.get('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error' },
  get LOG_FORMAT() { return this.get('LOG_FORMAT', 'pretty') as 'json' | 'pretty' },

  // API
  get API_PREFIX() { return this.get('API_PREFIX', '/api') },
  get VITE_PORT() { return this.get('VITE_PORT', 5173) },

  // CORS
  get CORS_ORIGINS() { return this.get('CORS_ORIGINS', ['*']) },
  get CORS_METHODS() { return this.get('CORS_METHODS', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) },
  get CORS_HEADERS() { return this.get('CORS_HEADERS', ['Content-Type', 'Authorization']) },
  get CORS_CREDENTIALS() { return this.get('CORS_CREDENTIALS', false) },
  get CORS_MAX_AGE() { return this.get('CORS_MAX_AGE', 86400) },

  // App
  get FLUXSTACK_APP_NAME() { return this.get('FLUXSTACK_APP_NAME', 'FluxStack') },
  get FLUXSTACK_APP_VERSION() { 
    const { FLUXSTACK_VERSION } = require('./version')
    return this.get('FLUXSTACK_APP_VERSION', FLUXSTACK_VERSION) 
  },

  // Features
  get ENABLE_MONITORING() { return this.get('ENABLE_MONITORING', false) },
  get ENABLE_SWAGGER() { return this.get('ENABLE_SWAGGER', true) },
  get ENABLE_METRICS() { return this.get('ENABLE_METRICS', false) },

  // Database
  get DATABASE_URL() { return this.get('DATABASE_URL', '') },
  get DB_HOST() { return this.get('DB_HOST', 'localhost') },
  get DB_PORT() { return this.get('DB_PORT', 5432) },
  get DB_NAME() { return this.get('DB_NAME', '') },
  get DB_USER() { return this.get('DB_USER', '') },
  get DB_PASSWORD() { return this.get('DB_PASSWORD', '') },
  get DB_SSL() { return this.get('DB_SSL', false) },

  // Auth
  get JWT_SECRET() { return this.get('JWT_SECRET', '') },
  get JWT_EXPIRES_IN() { return this.get('JWT_EXPIRES_IN', '24h') },
  get JWT_ALGORITHM() { return this.get('JWT_ALGORITHM', 'HS256') },

  // Email
  get SMTP_HOST() { return this.get('SMTP_HOST', '') },
  get SMTP_PORT() { return this.get('SMTP_PORT', 587) },
  get SMTP_USER() { return this.get('SMTP_USER', '') },
  get SMTP_PASSWORD() { return this.get('SMTP_PASSWORD', '') },
  get SMTP_SECURE() { return this.get('SMTP_SECURE', false) },
}

/**
 * Environment helpers
 */
export const helpers = {
  isDevelopment: (): boolean => env.NODE_ENV === 'development',
  isProduction: (): boolean => env.NODE_ENV === 'production',
  isTest: (): boolean => env.NODE_ENV === 'test',

  getServerUrl: (): string => `http://${env.HOST}:${env.PORT}`,
  getClientUrl: (): string => `http://${env.HOST}:${env.VITE_PORT}`,

  getDatabaseUrl: (): string | null => {
    if (env.DATABASE_URL) return env.DATABASE_URL

    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = env
    if (DB_HOST && DB_NAME) {
      const auth = DB_USER ? `${DB_USER}:${DB_PASSWORD}@` : ''
      return `postgres://${auth}${DB_HOST}:${DB_PORT}/${DB_NAME}`
    }

    return null
  }
}

/**
 * Create namespaced environment access
 * @example
 * const db = createNamespace('DATABASE_')
 * db.get('URL') // reads DATABASE_URL
 */
export function createNamespace(prefix: string) {
  return {
    get: <T>(key: string, defaultValue?: T): T =>
      env.get(`${prefix}${key}`, defaultValue),

    has: (key: string): boolean =>
      env.has(`${prefix}${key}`),

    all: (): Record<string, string> => {
      const allEnv = env.all()
      const namespaced: Record<string, string> = {}

      for (const [key, value] of Object.entries(allEnv)) {
        if (key.startsWith(prefix)) {
          namespaced[key.slice(prefix.length)] = value
        }
      }

      return namespaced
    }
  }
}

// Default export
export default env
