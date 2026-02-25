/**
 * ⚡ FluxStack Config Schema System
 *
 * Laravel-inspired declarative configuration system with:
 * - Schema-based config declaration
 * - Automatic validation
 * - Type casting
 * - Default values
 * - Environment variable mapping
 *
 * @example
 * ```ts
 * const appConfig = defineConfig({
 *   name: {
 *     type: 'string',
 *     env: 'APP_NAME',
 *     default: 'MyApp',
 *     required: true
 *   },
 *   port: {
 *     type: 'number',
 *     env: 'PORT',
 *     default: 3000,
 *     validate: (value) => value > 0 && value < 65536
 *   },
 *   env: config.enum('NODE_ENV', ['development', 'production', 'test'] as const, 'development', true)
 * })
 *
 * // Access with full type safety
 * appConfig.name   // string
 * appConfig.port   // number
 * appConfig.env    // "development" | "production" | "test"
 * ```
 */

import { env } from './env'

/**
 * Config field types
 */
export type ConfigFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum'

/**
 * Config field definition
 */
export interface ConfigField<T = any> {
  /** Field type */
  type: ConfigFieldType

  /** Environment variable name */
  env?: string

  /** Default value */
  default?: T

  /** Is field required? */
  required?: boolean

  /** Custom validation function */
  validate?: (value: T) => boolean | string

  /** For enum type: allowed values */
  values?: readonly T[]

  /** Field description (for documentation) */
  description?: string

  /** Custom transformer function */
  transform?: (value: any) => T
}

/**
 * Config schema definition
 */
export type ConfigSchema = Record<string, ConfigField>

/**
 * Infer TypeScript type from config schema
 */
export type InferConfig<T extends ConfigSchema> = {
  [K in keyof T]: T[K]['default'] extends infer D
    ? D extends undefined
      ? T[K]['required'] extends true
        ? InferFieldType<T[K]>
        : InferFieldType<T[K]> | undefined
      : InferFieldType<T[K]>
    : InferFieldType<T[K]>
}

/**
 * Infer field type from field definition
 * Uses the generic T from ConfigField<T> for better type inference
 */
type InferFieldType<F> =
  F extends ConfigField<infer T>
    ? T extends undefined
      ? (
        F extends { type: 'string' } ? string :
        F extends { type: 'number' } ? number :
        F extends { type: 'boolean' } ? boolean :
        F extends { type: 'array' } ? string[] :
        F extends { type: 'object' } ? Record<string, any> :
        F extends { type: 'enum'; values: readonly (infer U)[] } ? U :
        any
      )
      : T
    : any

/**
 * Validation error
 */
export interface ValidationError {
  field: string
  message: string
  value?: any
}

/**
 * Config validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings?: string[]
}

/**
 * Cast value to specific type
 */
function castValue(value: any, type: ConfigFieldType): any {
  if (value === undefined || value === null) {
    return undefined
  }

  switch (type) {
    case 'string':
      return String(value)

    case 'number':
      const num = Number(value)
      return isNaN(num) ? undefined : num

    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
      }
      return Boolean(value)

    case 'array':
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        return value.split(',').map(v => v.trim()).filter(Boolean)
      }
      return [value]

    case 'object':
      if (typeof value === 'object' && value !== null) return value
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return {}
        }
      }
      return {}

    case 'enum':
      return value

    default:
      return value
  }
}

/**
 * Validate config value
 */
function validateField(
  fieldName: string,
  value: any,
  field: ConfigField
): ValidationError | null {
  // Check required
  if (field.required && (value === undefined || value === null || value === '')) {
    return {
      field: fieldName,
      message: `Field '${fieldName}' is required but not provided`
    }
  }

  // Skip validation if value is undefined and not required
  if (value === undefined && !field.required) {
    return null
  }

  // Check enum values
  if (field.type === 'enum' && field.values) {
    if (!field.values.includes(value)) {
      return {
        field: fieldName,
        message: `Field '${fieldName}' must be one of: ${field.values.join(', ')}`,
        value
      }
    }
  }

  // Custom validation
  if (field.validate) {
    const result = field.validate(value)
    if (result === false) {
      return {
        field: fieldName,
        message: `Field '${fieldName}' failed validation`,
        value
      }
    }
    if (typeof result === 'string') {
      return {
        field: fieldName,
        message: result,
        value
      }
    }
  }

  return null
}

/**
 * Reactive config instance that can reload in runtime
 */
export class ReactiveConfig<T extends ConfigSchema> {
  private schema: T
  private config: InferConfig<T>
  private watchers: Array<(config: InferConfig<T>) => void> = []

  constructor(schema: T) {
    this.schema = schema
    this.config = this.loadConfig()
  }

  /**
   * Load config from environment
   */
  private loadConfig(): InferConfig<T> {
    const config: any = {}
    const errors: ValidationError[] = []

    for (const [fieldName, field] of Object.entries(this.schema)) {
      let value: any

      // 1. Try to get from environment variable
      if (field.env) {
        const envValue = env.has(field.env) ? env.all()[field.env] : undefined
        if (envValue !== undefined && envValue !== '') {
          value = envValue
        }
      }

      // 2. Use default value if not found in env
      if (value === undefined) {
        value = field.default
      }

      // 3. Apply custom transform if provided
      if (value !== undefined && field.transform) {
        try {
          value = field.transform(value)
        } catch (error) {
          errors.push({
            field: fieldName,
            message: `Transform failed: ${error}`
          })
          continue
        }
      }

      // 4. Cast to correct type
      if (value !== undefined) {
        value = castValue(value, field.type)
      }

      // 5. Validate
      const validationError = validateField(fieldName, value, field)
      if (validationError) {
        errors.push(validationError)
        continue
      }

      // 6. Set value
      config[fieldName] = value
    }

    // Throw error if validation failed
    if (errors.length > 0) {
      const errorMessage = errors
        .map(e => `  - ${e.message}${e.value !== undefined ? ` (got: ${JSON.stringify(e.value)})` : ''}`)
        .join('\n')

      throw new Error(
        `❌ Configuration validation failed:\n${errorMessage}\n\n` +
        `Please check your environment variables or configuration.`
      )
    }

    return config as InferConfig<T>
  }

  /**
   * Get current config values
   */
  get values(): InferConfig<T> {
    return this.config
  }

  /**
   * Reload config from environment (runtime reload)
   */
  reload(): InferConfig<T> {
    // Clear env cache to get fresh values
    env.clearCache()

    // Reload config
    const newConfig = this.loadConfig()
    this.config = newConfig

    // Notify watchers
    this.watchers.forEach(watcher => watcher(newConfig))

    return newConfig
  }

  /**
   * Watch for config changes (called after reload)
   */
  watch(callback: (config: InferConfig<T>) => void): () => void {
    this.watchers.push(callback)

    // Return unwatch function
    return () => {
      const index = this.watchers.indexOf(callback)
      if (index > -1) {
        this.watchers.splice(index, 1)
      }
    }
  }

  /**
   * Get specific field value with runtime lookup
   */
  get<K extends keyof InferConfig<T>>(key: K): InferConfig<T>[K] {
    return this.config[key]
  }

  /**
   * Check if field exists
   */
  has<K extends keyof InferConfig<T>>(key: K): boolean {
    return this.config[key] !== undefined
  }
}

/**
 * Define and load configuration from schema
 */
export function defineConfig<T extends ConfigSchema>(schema: T): InferConfig<T> {
  const reactive = new ReactiveConfig(schema)
  return reactive.values as InferConfig<T>
}

/**
 * Define reactive configuration (can be reloaded in runtime)
 */
export function defineReactiveConfig<T extends ConfigSchema>(schema: T): ReactiveConfig<T> {
  return new ReactiveConfig(schema)
}

/**
 * Validate configuration without throwing
 */
export function validateConfig<T extends ConfigSchema>(
  schema: T,
  values: Partial<InferConfig<T>>
): ValidationResult {
  const errors: ValidationError[] = []

  for (const [fieldName, field] of Object.entries(schema)) {
    const value = (values as any)[fieldName]
    const error = validateField(fieldName, value, field)
    if (error) {
      errors.push(error)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Create nested config schema (for grouping)
 */
export function defineNestedConfig<T extends Record<string, ConfigSchema>>(
  schemas: T
): { [K in keyof T]: InferConfig<T[K]> } {
  const config: any = {}

  for (const [groupName, schema] of Object.entries(schemas)) {
    config[groupName] = defineConfig(schema)
  }

  return config
}

/**
 * Helper to create env field quickly
 */
export function envString(envVar: string, defaultValue?: string, required = false): ConfigField<string> {
  return {
    type: 'string' as const,
    env: envVar,
    default: defaultValue,
    required
  }
}

export function envNumber(envVar: string, defaultValue?: number, required = false): ConfigField<number> {
  return {
    type: 'number' as const,
    env: envVar,
    default: defaultValue,
    required
  }
}

export function envBoolean(envVar: string, defaultValue?: boolean, required = false): ConfigField<boolean> {
  return {
    type: 'boolean' as const,
    env: envVar,
    default: defaultValue,
    required
  }
}

export function envArray(envVar: string, defaultValue?: string[], required = false): ConfigField<string[]> {
  return {
    type: 'array' as const,
    env: envVar,
    default: defaultValue,
    required
  }
}

export function envEnum<T extends readonly string[]>(
  envVar: string,
  values: T,
  defaultValue?: T[number],
  required = false
): ConfigField<T[number]> {
  return {
    type: 'enum' as const,
    env: envVar,
    values,
    default: defaultValue,
    required
  }
}

/**
 * Export shorthand helpers
 */
export const config = {
  string: envString,
  number: envNumber,
  boolean: envBoolean,
  array: envArray,
  enum: envEnum
}
