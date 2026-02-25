/**
 * Plugin Configuration Management
 * Handles plugin-specific configuration validation and management
 */

import type { FluxStack, PluginConfigSchema, PluginValidationResult } from "./types"
import type { FluxStackConfig } from "@config"
import type { Logger } from "@core/utils/logger/index"

type Plugin = FluxStack.Plugin

export interface PluginConfigManager {
  validatePluginConfig(plugin: Plugin, config: any): PluginValidationResult
  mergePluginConfig(plugin: Plugin, userConfig: any): any
  getPluginConfig(pluginName: string, config: FluxStackConfig): any
  setPluginConfig(pluginName: string, pluginConfig: any, config: FluxStackConfig): void
}

export class DefaultPluginConfigManager implements PluginConfigManager {
  constructor(_logger?: Logger) {
    // Logger stored but not used in current implementation
  }

  /**
   * Validate plugin configuration against its schema
   */
  validatePluginConfig(plugin: Plugin, config: any): PluginValidationResult {
    const result: PluginValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    }

    if (!plugin.configSchema) {
      // No schema means any config is valid
      return result
    }

    try {
      this.validateAgainstSchema(config, plugin.configSchema, plugin.name, result)
    } catch (error) {
      result.valid = false
      result.errors.push(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * Merge user configuration with plugin defaults
   */
  mergePluginConfig(plugin: Plugin, userConfig: any): any {
    const defaultConfig = plugin.defaultConfig || {}
    
    if (!userConfig) {
      return defaultConfig
    }

    return this.deepMerge(defaultConfig, userConfig)
  }

  /**
   * Get plugin configuration from main config
   * @deprecated Plugin configs are now directly accessed from config.plugins
   */
  getPluginConfig(pluginName: string, config: FluxStackConfig): any {
    // Plugin configs are now accessed directly from config.plugins
    // Example: config.plugins.swaggerEnabled
    return {}
  }

  /**
   * Set plugin configuration in main config
   * @deprecated Plugin configs are now set via environment variables and config files
   */
  setPluginConfig(pluginName: string, pluginConfig: any, config: FluxStackConfig): void {
    // Plugin configs are now set via environment variables and config files
    // This function is deprecated and does nothing
  }

  /**
   * Validate configuration against JSON schema
   */
  private validateAgainstSchema(
    data: any,
    schema: PluginConfigSchema,
    pluginName: string,
    result: PluginValidationResult
  ): void {
    if (schema.type === 'object' && typeof data !== 'object') {
      result.valid = false
      result.errors.push(`Plugin '${pluginName}' configuration must be an object`)
      return
    }

    // Check required properties
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data)) {
          result.valid = false
          result.errors.push(`Plugin '${pluginName}' configuration missing required property: ${requiredProp}`)
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in data) {
          this.validateProperty(data[propName], propSchema, `${pluginName}.${propName}`, result)
        }
      }
    }

    // Check for additional properties
    if (schema.additionalProperties === false) {
      const allowedProps = Object.keys(schema.properties || {})
      const actualProps = Object.keys(data)
      
      for (const prop of actualProps) {
        if (!allowedProps.includes(prop)) {
          result.warnings.push(`Plugin '${pluginName}' configuration has unexpected property: ${prop}`)
        }
      }
    }
  }

  /**
   * Validate individual property
   */
  private validateProperty(value: any, schema: any, path: string, result: PluginValidationResult): void {
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (actualType !== schema.type) {
        result.valid = false
        result.errors.push(`Property '${path}' must be of type ${schema.type}, got ${actualType}`)
        return
      }
    }

    // Type-specific validations
    switch (schema.type) {
      case 'string':
        this.validateStringProperty(value, schema, path, result)
        break
      case 'number':
        this.validateNumberProperty(value, schema, path, result)
        break
      case 'array':
        this.validateArrayProperty(value, schema, path, result)
        break
      case 'object':
        if (schema.properties) {
          this.validateObjectProperty(value, schema, path, result)
        }
        break
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      result.valid = false
      result.errors.push(`Property '${path}' must be one of: ${schema.enum.join(', ')}`)
    }
  }

  /**
   * Validate string property
   */
  private validateStringProperty(value: string, schema: any, path: string, result: PluginValidationResult): void {
    if (schema.minLength && value.length < schema.minLength) {
      result.valid = false
      result.errors.push(`Property '${path}' must be at least ${schema.minLength} characters long`)
    }

    if (schema.maxLength && value.length > schema.maxLength) {
      result.valid = false
      result.errors.push(`Property '${path}' must be at most ${schema.maxLength} characters long`)
    }

    if (schema.pattern) {
      const regex = new RegExp(schema.pattern)
      if (!regex.test(value)) {
        result.valid = false
        result.errors.push(`Property '${path}' does not match required pattern: ${schema.pattern}`)
      }
    }
  }

  /**
   * Validate number property
   */
  private validateNumberProperty(value: number, schema: any, path: string, result: PluginValidationResult): void {
    if (schema.minimum !== undefined && value < schema.minimum) {
      result.valid = false
      result.errors.push(`Property '${path}' must be at least ${schema.minimum}`)
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      result.valid = false
      result.errors.push(`Property '${path}' must be at most ${schema.maximum}`)
    }

    if (schema.multipleOf && value % schema.multipleOf !== 0) {
      result.valid = false
      result.errors.push(`Property '${path}' must be a multiple of ${schema.multipleOf}`)
    }
  }

  /**
   * Validate array property
   */
  private validateArrayProperty(value: any[], schema: any, path: string, result: PluginValidationResult): void {
    if (schema.minItems && value.length < schema.minItems) {
      result.valid = false
      result.errors.push(`Property '${path}' must have at least ${schema.minItems} items`)
    }

    if (schema.maxItems && value.length > schema.maxItems) {
      result.valid = false
      result.errors.push(`Property '${path}' must have at most ${schema.maxItems} items`)
    }

    if (schema.items) {
      value.forEach((item, index) => {
        this.validateProperty(item, schema.items, `${path}[${index}]`, result)
      })
    }
  }

  /**
   * Validate object property
   */
  private validateObjectProperty(value: any, schema: any, path: string, result: PluginValidationResult): void {
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in value)) {
          result.valid = false
          result.errors.push(`Property '${path}' missing required property: ${requiredProp}`)
        }
      }
    }

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in value) {
          this.validateProperty(value[propName], propSchema, `${path}.${propName}`, result)
        }
      }
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target
    }

    if (target === null || target === undefined) {
      return source
    }

    if (typeof target !== 'object' || typeof source !== 'object') {
      return source
    }

    if (Array.isArray(source)) {
      return [...source]
    }

    const result = { ...target }

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
          result[key] = this.deepMerge(target[key], source[key])
        } else {
          result[key] = source[key]
        }
      }
    }

    return result
  }
}

/** Shared instance — stateless, safe to reuse across all plugin utils */
const sharedConfigManager = new DefaultPluginConfigManager()

/**
 * Create plugin configuration utilities
 */
export function createPluginUtils(logger?: Logger): PluginUtils {
  return {
    createTimer: (label: string) => {
      const start = Date.now()
      return {
        end: () => {
          const duration = Date.now() - start
          logger?.debug(`Timer '${label}' completed`, { duration })
          return duration
        }
      }
    },

    formatBytes: (bytes: number): string => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },

    isProduction: (): boolean => {
      return process.env.NODE_ENV === 'production'
    },

    isDevelopment: (): boolean => {
      return process.env.NODE_ENV === 'development'
    },

    getEnvironment: (): string => {
      return process.env.NODE_ENV || 'development'
    },

    createHash: (data: string): string => {
      // Simple hash function - in production, use crypto
      let hash = 0
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32-bit integer
      }
      return hash.toString(36)
    },

    deepMerge: (target: any, source: any): any => {
      return (sharedConfigManager as any).deepMerge(target, source)
    },

    validateSchema: (data: any, schema: any): { valid: boolean; errors: string[] } => {
      const result = sharedConfigManager.validatePluginConfig({ name: 'temp', configSchema: schema }, data)
      return {
        valid: result.valid,
        errors: result.errors
      }
    }
  }
}

// Export types for plugin utilities
import type { PluginUtils } from "./types"