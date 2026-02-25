/**
 * Plugin Discovery System
 * Handles automatic discovery and loading of plugins from various sources
 */

import type { FluxStack, PluginManifest, PluginLoadResult, PluginDiscoveryOptions } from "./types"
import type { Logger } from "@core/utils/logger/index"
import { readdir, readFile } from "fs/promises"
import { join, resolve } from "path"
import { existsSync } from "fs"

type Plugin = FluxStack.Plugin

export interface PluginDiscoveryConfig {
  logger?: Logger
  baseDir?: string
  builtInDir?: string
  externalDir?: string
  nodeModulesDir?: string
}

export class PluginDiscovery {
  private logger?: Logger
  private baseDir: string
  private builtInDir: string
  private externalDir: string
  private nodeModulesDir: string

  constructor(config: PluginDiscoveryConfig = {}) {
    this.logger = config.logger
    this.baseDir = config.baseDir || process.cwd()
    this.builtInDir = config.builtInDir || join(this.baseDir, 'core/plugins/built-in')
    this.externalDir = config.externalDir || join(this.baseDir, 'plugins')
    this.nodeModulesDir = config.nodeModulesDir || join(this.baseDir, 'node_modules')
  }

  /**
   * Discover all available plugins
   */
  async discoverAll(options: PluginDiscoveryOptions = {}): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = []
    const {
      includeBuiltIn = true,
      includeExternal = true
    } = options

    // Discover built-in plugins
    if (includeBuiltIn) {
      const builtInResults = await this.discoverBuiltInPlugins()
      results.push(...builtInResults)
    }

    // Discover external plugins
    if (includeExternal) {
      const externalResults = await this.discoverExternalPlugins()
      results.push(...externalResults)
      
      const npmResults = await this.discoverNpmPlugins()
      results.push(...npmResults)
    }

    return results
  }

  /**
   * Discover built-in plugins
   */
  async discoverBuiltInPlugins(): Promise<PluginLoadResult[]> {
    if (!existsSync(this.builtInDir)) {
      this.logger?.debug('Built-in plugins directory not found', { dir: this.builtInDir })
      return []
    }

    return this.discoverPluginsInDirectory(this.builtInDir, 'built-in')
  }

  /**
   * Discover external plugins in the plugins directory
   */
  async discoverExternalPlugins(): Promise<PluginLoadResult[]> {
    if (!existsSync(this.externalDir)) {
      this.logger?.debug('External plugins directory not found', { dir: this.externalDir })
      return []
    }

    return this.discoverPluginsInDirectory(this.externalDir, 'external')
  }

  /**
   * Discover npm-installed plugins
   */
  async discoverNpmPlugins(): Promise<PluginLoadResult[]> {
    if (!existsSync(this.nodeModulesDir)) {
      this.logger?.debug('Node modules directory not found', { dir: this.nodeModulesDir })
      return []
    }

    const results: PluginLoadResult[] = []

    try {
      const entries = await readdir(this.nodeModulesDir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('fluxstack-plugin-')) {
          const pluginDir = join(this.nodeModulesDir, entry.name)
          const result = await this.loadPluginFromDirectory(pluginDir, 'npm')
          results.push(result)
        }
      }
    } catch (error) {
      this.logger?.error('Failed to discover npm plugins', { error })
    }

    return results
  }

  /**
   * Load a specific plugin by name
   */
  async loadPlugin(name: string): Promise<PluginLoadResult> {
    // Try built-in first
    const builtInPath = join(this.builtInDir, name)
    if (existsSync(builtInPath)) {
      return this.loadPluginFromDirectory(builtInPath, 'built-in')
    }

    // Try external plugins
    const externalPath = join(this.externalDir, name)
    if (existsSync(externalPath)) {
      return this.loadPluginFromDirectory(externalPath, 'external')
    }

    // Try npm plugins
    const npmPath = join(this.nodeModulesDir, `fluxstack-plugin-${name}`)
    if (existsSync(npmPath)) {
      return this.loadPluginFromDirectory(npmPath, 'npm')
    }

    return {
      success: false,
      error: `Plugin '${name}' not found in any plugin directory`
    }
  }

  /**
   * Discover plugins in a specific directory
   */
  private async discoverPluginsInDirectory(
    directory: string,
    source: 'built-in' | 'external' | 'npm'
  ): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = []

    try {
      const entries = await readdir(directory, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginDir = join(directory, entry.name)
          const result = await this.loadPluginFromDirectory(pluginDir, source)
          results.push(result)
        }
      }
    } catch (error) {
      this.logger?.error(`Failed to discover plugins in directory '${directory}'`, { error })
      results.push({
        success: false,
        error: `Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`
      })
    }

    return results
  }

  /**
   * Load a plugin from a specific directory
   */
  private async loadPluginFromDirectory(
    pluginDir: string,
    source: 'built-in' | 'external' | 'npm'
  ): Promise<PluginLoadResult> {
    try {
      // Load manifest if it exists
      const manifest = await this.loadPluginManifest(pluginDir)
      
      // Find the main plugin file
      const pluginFile = await this.findPluginFile(pluginDir)
      if (!pluginFile) {
        return {
          success: false,
          error: 'No plugin entry point found (index.ts, index.js, plugin.ts, or plugin.js)'
        }
      }

      // Import the plugin
      const pluginModule = await import(resolve(pluginFile))
      const plugin: Plugin = pluginModule.default || pluginModule

      if (!this.isValidPlugin(plugin)) {
        return {
          success: false,
          error: 'Invalid plugin: must export a plugin object with a name property'
        }
      }

      // Validate manifest compatibility
      const warnings: string[] = []
      if (manifest) {
        const manifestWarnings = this.validateManifestCompatibility(plugin, manifest)
        warnings.push(...manifestWarnings)
      } else {
        warnings.push('No plugin manifest found')
      }

      this.logger?.debug(`Loaded plugin '${plugin.name}' from ${source}`, {
        plugin: plugin.name,
        version: plugin.version,
        source,
        path: pluginDir
      })

      return {
        success: true,
        plugin,
        warnings
      }
    } catch (error) {
      this.logger?.error(`Failed to load plugin from '${pluginDir}'`, { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Load plugin manifest from directory
   */
  private async loadPluginManifest(pluginDir: string): Promise<PluginManifest | undefined> {
    const manifestPath = join(pluginDir, 'plugin.json')
    
    if (!existsSync(manifestPath)) {
      // Try package.json for npm plugins
      const packagePath = join(pluginDir, 'package.json')
      if (existsSync(packagePath)) {
        try {
          const packageContent = await readFile(packagePath, 'utf-8')
          const packageJson = JSON.parse(packageContent)
          
          if (packageJson.fluxstack) {
            return {
              name: packageJson.name,
              version: packageJson.version,
              description: packageJson.description || '',
              author: packageJson.author || '',
              license: packageJson.license || '',
              homepage: packageJson.homepage,
              repository: packageJson.repository,
              keywords: packageJson.keywords || [],
              dependencies: packageJson.dependencies || {},
              peerDependencies: packageJson.peerDependencies,
              fluxstack: packageJson.fluxstack
            }
          }
        } catch (error) {
          this.logger?.warn(`Failed to parse package.json in '${pluginDir}'`, { error })
        }
      }
      return undefined
    }

    try {
      const manifestContent = await readFile(manifestPath, 'utf-8')
      return JSON.parse(manifestContent)
    } catch (error) {
      this.logger?.warn(`Failed to parse plugin manifest in '${pluginDir}'`, { error })
      return undefined
    }
  }

  /**
   * Find the main plugin file in a directory
   */
  private async findPluginFile(pluginDir: string): Promise<string | null> {
    const possibleFiles = [
      'index.ts',
      'index.js',
      'plugin.ts',
      'plugin.js',
      'src/index.ts',
      'src/index.js',
      'dist/index.js'
    ]

    for (const file of possibleFiles) {
      const filePath = join(pluginDir, file)
      if (existsSync(filePath)) {
        return filePath
      }
    }

    return null
  }

  /**
   * Validate if an object is a valid plugin
   */
  private isValidPlugin(plugin: any): plugin is Plugin {
    if (!plugin || typeof plugin !== 'object' || typeof plugin.name !== 'string' || plugin.name.length === 0) {
      return false
    }

    const hookNames = [
      'setup', 'onConfigLoad', 'onBeforeServerStart', 'onServerStart',
      'onAfterServerStart', 'onBeforeServerStop', 'onServerStop',
      'onRequest', 'onResponse', 'onError'
    ]

    for (const hook of hookNames) {
      if (hook in plugin && typeof plugin[hook] !== 'function') {
        this.logger?.warn(`Plugin "${plugin.name}" has invalid hook "${hook}" (expected function, got ${typeof plugin[hook]})`)
        return false
      }
    }

    return true
  }

  /**
   * Validate manifest compatibility with plugin
   */
  private validateManifestCompatibility(plugin: Plugin, manifest: PluginManifest): string[] {
    const warnings: string[] = []

    if (plugin.name !== manifest.name) {
      warnings.push(`Plugin name mismatch: plugin exports '${plugin.name}' but manifest declares '${manifest.name}'`)
    }

    if (plugin.version && plugin.version !== manifest.version) {
      warnings.push(`Plugin version mismatch: plugin exports '${plugin.version}' but manifest declares '${manifest.version}'`)
    }

    if (plugin.dependencies && manifest.fluxstack.hooks) {
      // Check if plugin implements the hooks declared in manifest
      const declaredHooks = manifest.fluxstack.hooks
      const implementedHooks = Object.keys(plugin).filter(key => 
        key.startsWith('on') || key === 'setup'
      )
      
      for (const hook of declaredHooks) {
        if (!implementedHooks.includes(hook)) {
          warnings.push(`Plugin declares hook '${hook}' in manifest but doesn't implement it`)
        }
      }
    }

    return warnings
  }
}

/**
 * @deprecated Unused — PluginRegistry handles discovery directly.
 * Instantiation deferred to first access to avoid side effects at module load.
 * Remove this export in the next major version.
 */
let _pluginDiscovery: PluginDiscovery | undefined
export function getPluginDiscovery(): PluginDiscovery {
  _pluginDiscovery ??= new PluginDiscovery()
  return _pluginDiscovery
}

/** @deprecated Use getPluginDiscovery() instead */
export const pluginDiscovery = {} as PluginDiscovery