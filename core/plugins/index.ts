/**
 * Enhanced Plugin System
 * Comprehensive plugin system with lifecycle hooks, dependency management, and configuration
 */

// Core plugin types and interfaces
export type {
    FluxStack,
    PluginContext,
    PluginHook,
    PluginPriority,
    PluginManifest,
    PluginLoadResult,
    PluginRegistryState,
    PluginHookResult,
    PluginMetrics,
    PluginDiscoveryOptions,
    PluginInstallOptions,
    PluginExecutionContext,
    PluginValidationResult,
    HookExecutionOptions,
    PluginLifecycleEvent,
    PluginConfigSchema,
    RequestContext,
    ResponseContext,
    ErrorContext,
    BuildContext
} from './types'

export type Plugin = FluxStack.Plugin

// Plugin registry
export { PluginRegistry } from './registry'
export type { PluginRegistryConfig } from './registry'

// Plugin discovery
export { PluginDiscovery, pluginDiscovery } from './discovery'
export type { PluginDiscoveryConfig } from './discovery'

// Plugin configuration management
export {
    DefaultPluginConfigManager,
    createPluginUtils
} from './config'
export type { PluginConfigManager } from './config'

// Plugin manager
export {
    PluginManager,
    createRequestContext,
    createResponseContext,
    createErrorContext,
    createBuildContext
} from './manager'
export type { PluginManagerConfig } from './manager'

// Module resolver for plugins
export { PluginModuleResolver } from './module-resolver'
export type { ModuleResolverConfig } from './module-resolver'

// Plugin executor
export {
    PluginExecutor,
    calculateExecutionStats
} from './executor'
export type {
    PluginExecutionPlan,
    PluginExecutionStep,
    PluginExecutionStats
} from './executor'

// Utility functions for plugin development
export const PluginUtils = {
    /**
     * Create a simple plugin
     */
    createPlugin: (config: {
        name: string
        version?: string
        description?: string
        dependencies?: string[]
        priority?: number | PluginPriority
        setup?: (context: PluginContext) => void | Promise<void>
        onServerStart?: (context: PluginContext) => void | Promise<void>
        onServerStop?: (context: PluginContext) => void | Promise<void>
        onRequest?: (context: RequestContext) => void | Promise<void>
        onBeforeRoute?: (context: RequestContext) => void | Promise<void>
        onResponse?: (context: ResponseContext) => void | Promise<void>
        onError?: (context: ErrorContext) => void | Promise<void>
        configSchema?: any
        defaultConfig?: any
    }): Plugin => {
        const plugin = {
            name: config.name,
            ...(config.version && { version: config.version }),
            ...(config.description && { description: config.description }),
            ...(config.dependencies && { dependencies: config.dependencies }),
            ...(config.priority !== undefined && { priority: config.priority }),
            ...(config.setup && { setup: config.setup }),
            ...(config.onServerStart && { onServerStart: config.onServerStart }),
            ...(config.onServerStop && { onServerStop: config.onServerStop }),
            ...(config.onRequest && { onRequest: config.onRequest }),
            ...(config.onBeforeRoute && { onBeforeRoute: config.onBeforeRoute }),
            ...(config.onResponse && { onResponse: config.onResponse }),
            ...(config.onError && { onError: config.onError }),
            ...(config.configSchema && { configSchema: config.configSchema }),
            ...(config.defaultConfig && { defaultConfig: config.defaultConfig })
        } as Plugin
        return plugin
    },

    /**
     * Create a plugin manifest
     */
    createManifest: (config: {
        name: string
        version: string
        description: string
        author: string
        license: string
        homepage?: string
        repository?: string
        keywords?: string[]
        dependencies?: Record<string, string>
        peerDependencies?: Record<string, string>
        fluxstack: {
            version: string
            hooks: PluginHook[]
            config?: any
            category?: string
            tags?: string[]
        }
    }): any => {
        return {
            name: config.name,
            version: config.version || '1.0.0',
            description: config.description,
            author: config.author,
            license: config.license,
            homepage: config.homepage,
            repository: config.repository,
            keywords: config.keywords || [],
            dependencies: config.dependencies || {},
            peerDependencies: config.peerDependencies,
            fluxstack: config.fluxstack
        }
    },

    /**
     * Validate plugin structure
     */
    validatePlugin: (plugin: any): plugin is Plugin => {
        return (
            plugin &&
            typeof plugin === 'object' &&
            typeof plugin.name === 'string' &&
            plugin.name.length > 0
        )
    },

    /**
     * Check if plugin implements hook
     */
    implementsHook: (plugin: Plugin, hook: PluginHook): boolean => {
        const hookFunction = (plugin as any)[hook]
        return hookFunction && typeof hookFunction === 'function'
    },

    /**
     * Get plugin hooks
     */
    getPluginHooks: (plugin: Plugin): PluginHook[] => {
        const hooks: PluginHook[] = []
        const possibleHooks: PluginHook[] = [
            'setup',
            'onServerStart',
            'onServerStop',
            'onRequest',
            'onResponse',
            'onError',
            'onBuild',
            'onBuildComplete'
        ]

        for (const hook of possibleHooks) {
            if (PluginUtils.implementsHook(plugin, hook)) {
                hooks.push(hook)
            }
        }

        return hooks
    }
}

// Re-export types for convenience
import type {
    PluginContext,
    PluginHook,
    PluginPriority,
    RequestContext,
    ResponseContext,
    ErrorContext,
    FluxStack
} from './types'