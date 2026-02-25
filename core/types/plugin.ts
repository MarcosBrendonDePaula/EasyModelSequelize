/**
 * Plugin system types
 * Comprehensive type definitions for the plugin system
 */

// Import namespace for type alias
import type { FluxStack } from "../plugins/types"

// Re-export plugin types
export type {
  FluxStack,
  PluginContext,
  PluginUtils,
  RequestContext,
  ResponseContext,
  ErrorContext,
  BuildContext,
  ConfigLoadContext,
  RouteContext,
  ValidationContext,
  TransformContext,
  BuildAssetContext,
  BuildErrorContext,
  PluginEventContext
} from "../plugins/types"

// Export Plugin as a standalone type for convenience
export type Plugin = FluxStack.Plugin

// Additional plugin-related types
export interface PluginManifest {
  name: string
  version: string
  description: string
  author: string
  license: string
  homepage?: string
  repository?: string
  keywords: string[]
  dependencies: Record<string, string>
  peerDependencies?: Record<string, string>
  fluxstack: {
    version: string
    hooks: string[]
    config?: any
  }
}

export interface PluginLoadResult {
  success: boolean
  plugin?: Plugin
  error?: string
  warnings?: string[]
}

export interface PluginRegistryState {
  plugins: Map<string, Plugin>
  loadOrder: string[]
  dependencies: Map<string, string[]>
  conflicts: string[]
}

export interface PluginHookResult {
  success: boolean
  error?: Error
  duration: number
  plugin: string
  hook: string
}

export interface PluginMetrics {
  loadTime: number
  setupTime: number
  hookExecutions: Map<string, number>
  errors: number
  warnings: number
}

export type PluginHook = 
  | 'setup'
  | 'onServerStart'
  | 'onServerStop'
  | 'onRequest'
  | 'onResponse'
  | 'onError'

export type PluginPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest' | number

export interface PluginConfigSchema {
  type: 'object'
  properties: Record<string, any>
  required?: string[]
  additionalProperties?: boolean
}

export interface PluginDiscoveryOptions {
  directories?: string[]
  patterns?: string[]
  includeBuiltIn?: boolean
  includeExternal?: boolean
}

export interface PluginInstallOptions {
  version?: string
  registry?: string
  force?: boolean
  dev?: boolean
}