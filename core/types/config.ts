/**
 * Configuration-related types
 * Centralized type definitions for all configuration interfaces
 */

import type {
  LoggerConfig,
  PluginsConfig
} from "@config"

// Re-export all configuration types from @config
export type {
  FluxStackConfig,
  AppConfig,
  ServerConfig,
  ClientConfig,
  BuildConfig,
  ViteConfig,
  ClientBuildConfig,
  OptimizationConfig,
  BuildFullConfig,
  CorsConfig,
  ServerFullConfig,
  LoggerConfig,
  PluginsConfig,
  MonitoringConfig,
  MetricsConfig,
  ProfilingConfig,
  MonitoringFullConfig,
  SystemConfig,
  SystemRuntimeInfo,
  AppRuntimeConfig
} from "@config"

// Legacy type aliases (for backward compatibility)
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type BuildTarget = 'bun' | 'node' | 'docker'
export type LogFormat = 'json' | 'pretty'
export type LoggingConfig = LoggerConfig
export type PluginConfig = PluginsConfig

// Configuration loading types (deprecated - kept for backward compatibility)
export interface ConfigLoadOptions {
  env?: string
  validate?: boolean
  strict?: boolean
}

export interface ConfigLoadResult<T = any> {
  config: T
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  path: string
  message: string
  value?: any
}

export interface ValidationWarning {
  path: string
  message: string
  value?: any
}

// Additional configuration utility types
export interface ConfigOverride {
  path: string
  value: any
  source: 'env' | 'file' | 'runtime'
}

export interface ConfigMergeOptions {
  deep?: boolean
  arrays?: 'replace' | 'merge' | 'concat'
  overrideArrays?: boolean
}

export interface ConfigValidationOptions {
  strict?: boolean
  allowUnknown?: boolean
  stripUnknown?: boolean
  warnings?: boolean
}

export interface ConfigSource {
  type: 'file' | 'env' | 'default' | 'override'
  path?: string
  priority: number
  data: any
}