import type { FluxStack, PluginManifest, PluginLoadResult, PluginDiscoveryOptions } from "./types"

type FluxStackPlugin = FluxStack.Plugin
import type { FluxStackConfig } from "@config"
import type { Logger } from "@core/utils/logger"
import { FluxStackError } from "@core/utils/errors"
import { PluginDependencyManager } from "./dependency-manager"
import { readdir, readFile } from "fs/promises"
import { join, resolve, sep } from "path"
import { existsSync } from "fs"

export interface PluginRegistryConfig {
  logger?: Logger
  config?: FluxStackConfig
  discoveryOptions?: PluginDiscoveryOptions
}

export class PluginRegistry {
  private plugins: Map<string, FluxStackPlugin> = new Map()
  private manifests: Map<string, PluginManifest> = new Map()
  private loadOrder: string[] = []
  private dependencies: Map<string, string[]> = new Map()
  private conflicts: string[] = []
  private logger?: Logger
  private config?: FluxStackConfig
  private dependencyManager: PluginDependencyManager

  constructor(options: PluginRegistryConfig = {}) {
    this.logger = options.logger
    this.config = options.config
    this.dependencyManager = new PluginDependencyManager({
      logger: this.logger,
      autoInstall: true,
      packageManager: 'bun'
    })
  }

  /**
   * Register a plugin with the registry
   */
  async register(plugin: FluxStackPlugin, manifest?: PluginManifest): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new FluxStackError(
        `Plugin '${plugin.name}' is already registered`,
        'PLUGIN_ALREADY_REGISTERED',
        400
      )
    }

    // Validate plugin structure
    this.validatePlugin(plugin)

    // Validate plugin configuration if schema is provided
    const pluginConfigs = this.config?.plugins.config as Record<string, unknown> | undefined
    if (plugin.configSchema && pluginConfigs?.[plugin.name]) {
      this.validatePluginConfig(plugin, pluginConfigs[plugin.name])
    }

    this.plugins.set(plugin.name, plugin)

    if (manifest) {
      this.manifests.set(plugin.name, manifest)
    }

    // Update dependency tracking
    if (plugin.dependencies) {
      this.dependencies.set(plugin.name, plugin.dependencies)
    }

    // Update load order
    this.updateLoadOrder()

    this.logger?.debug(`Plugin '${plugin.name}' registered successfully`, {
      plugin: plugin.name,
      version: plugin.version,
      dependencies: plugin.dependencies
    })

    // Execute onPluginRegister hooks on all registered plugins
    await this.executePluginRegisterHooks(plugin)
  }

  /**
   * Execute onPluginRegister hooks on all plugins
   */
  private async executePluginRegisterHooks(registeredPlugin: FluxStackPlugin): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onPluginRegister && typeof plugin.onPluginRegister === 'function') {
        try {
          await plugin.onPluginRegister({
            pluginName: registeredPlugin.name,
            pluginVersion: registeredPlugin.version,
            timestamp: Date.now(),
            data: { plugin: registeredPlugin }
          })
        } catch (error) {
          this.logger?.error(`Plugin '${plugin.name}' onPluginRegister hook failed`, {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }
  }

  /**
   * Execute onPluginUnregister hooks on all plugins
   */
  private async executePluginUnregisterHooks(unregisteredPluginName: string, version?: string): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onPluginUnregister && typeof plugin.onPluginUnregister === 'function') {
        try {
          await plugin.onPluginUnregister({
            pluginName: unregisteredPluginName,
            pluginVersion: version,
            timestamp: Date.now()
          })
        } catch (error) {
          this.logger?.error(`Plugin '${plugin.name}' onPluginUnregister hook failed`, {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }
  }

  /**
   * Unregister a plugin from the registry
   */
  async unregister(name: string): Promise<void> {
    if (!this.plugins.has(name)) {
      throw new FluxStackError(
        `Plugin '${name}' is not registered`,
        'PLUGIN_NOT_FOUND',
        404
      )
    }

    // Check if other plugins depend on this one
    const dependents = this.getDependents(name)
    if (dependents.length > 0) {
      throw new FluxStackError(
        `Cannot unregister plugin '${name}' because it is required by: ${dependents.join(', ')}`,
        'PLUGIN_HAS_DEPENDENTS',
        400
      )
    }

    const plugin = this.plugins.get(name)
    const version = plugin?.version

    this.plugins.delete(name)
    this.manifests.delete(name)
    this.dependencies.delete(name)
    this.loadOrder = this.loadOrder.filter(pluginName => pluginName !== name)

    this.logger?.debug(`Plugin '${name}' unregistered successfully`)

    // Execute onPluginUnregister hooks on all remaining plugins
    await this.executePluginUnregisterHooks(name, version)
  }

  /**
   * Get a plugin by name
   */
  get(name: string): FluxStackPlugin | undefined {
    return this.plugins.get(name)
  }

  /**
   * Get plugin manifest by name
   */
  getManifest(name: string): PluginManifest | undefined {
    return this.manifests.get(name)
  }

  /**
   * Get all registered plugins
   */
  getAll(): FluxStackPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get all plugin manifests
   */
  getAllManifests(): PluginManifest[] {
    return Array.from(this.manifests.values())
  }

  /**
   * Get plugins in load order
   */
  getLoadOrder(): string[] {
    return [...this.loadOrder]
  }

  /**
   * Get plugins that depend on the specified plugin
   */
  getDependents(pluginName: string): string[] {
    const dependents: string[] = []
    
    for (const [name, deps] of this.dependencies.entries()) {
      if (deps.includes(pluginName)) {
        dependents.push(name)
      }
    }
    
    return dependents
  }

  /**
   * Get plugin dependencies
   */
  getDependencies(pluginName: string): string[] {
    return this.dependencies.get(pluginName) || []
  }

  /**
   * Check if a plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name)
  }

  /**
   * Check which dependencies are missing from main package.json
   */
  private checkMissingDependencies(pluginDeps: Record<string, string>): string[] {
    try {
      const mainPackageJsonPath = join(process.cwd(), 'package.json')
      if (!existsSync(mainPackageJsonPath)) {
        return Object.keys(pluginDeps)
      }

      const mainPackageJson = JSON.parse(
        require('fs').readFileSync(mainPackageJsonPath, 'utf-8')
      )

      const allDeps = {
        ...mainPackageJson.dependencies,
        ...mainPackageJson.devDependencies
      }

      return Object.keys(pluginDeps).filter(dep => !allDeps[dep])
    } catch (error) {
      // If we can't read package.json, assume all deps are missing
      return Object.keys(pluginDeps)
    }
  }

  /**
   * 🔒 Check if a plugin is allowed to be loaded (whitelist check)
   *
   * @param pluginName - Name of the plugin (e.g., "fluxstack-plugin-auth", "@acme/fplugin-payments")
   * @param isNpmPlugin - Whether this is an npm plugin (requires whitelist) or project plugin (trusted)
   * @returns true if plugin is allowed, false otherwise
   */
  /**
   * Check if a plugin is allowed to be loaded (whitelist enforcement)
   *
   * Security model:
   * - Project plugins (plugins/) are ALWAYS trusted (developer put them there)
   * - NPM plugins (node_modules/) REQUIRE whitelist (supply chain protection)
   */
  private isPluginAllowed(pluginName: string, source: 'npm' | 'project'): boolean {
    const allowedPlugins = this.config?.plugins.allowedPlugins || []

    // Project plugins are always trusted - developer explicitly added them
    if (source === 'project') {
      if (!this.config?.plugins.discoverProjectPlugins) {
        this.logger?.debug(`Project plugin '${pluginName}' skipped: discovery disabled`)
        return false
      }

      // ✅ Project plugins bypass whitelist - they're trusted by design
      this.logger?.debug(`Project plugin '${pluginName}' allowed (trusted source)`)
      return true
    }

    if (allowedPlugins.length === 0) {
      this.logger?.warn(`NPM plugin '${pluginName}' blocked: No plugins in whitelist (PLUGINS_ALLOWED is empty)`)
      return false
    }

    if (!allowedPlugins.includes(pluginName)) {
      this.logger?.warn(`NPM plugin '${pluginName}' blocked: Not in whitelist (PLUGINS_ALLOWED)`, {
        pluginName,
        allowedPlugins
      })
      return false
    }

    return true
  }
  /**
   * Get registry statistics
   */
  getStats() {
    return {
      totalPlugins: this.plugins.size,
      enabledPlugins: this.config?.plugins.enabled?.length ?? 0,
      disabledPlugins: this.config?.plugins.disabled?.length ?? 0,
      conflicts: this.conflicts.length,
      loadOrder: this.loadOrder.length
    }
  }

  /**
   * Validate all plugin dependencies
   */
  validateDependencies(): void {
    this.conflicts = []

    for (const plugin of this.plugins.values()) {
      if (plugin.dependencies) {
        for (const dependency of plugin.dependencies) {
          if (!this.plugins.has(dependency)) {
            const error = `Plugin '${plugin.name}' depends on '${dependency}' which is not registered`
            this.conflicts.push(error)
            this.logger?.error(error, { plugin: plugin.name, dependency })
          }
        }
      }
    }

    if (this.conflicts.length > 0) {
      throw new FluxStackError(
        `Plugin dependency validation failed: ${this.conflicts.join('; ')}`,
        'PLUGIN_DEPENDENCY_ERROR',
        400,
        { conflicts: this.conflicts }
      )
    }
  }

  /**
   * Discover FluxStack plugins from node_modules
   * Looks for packages with naming pattern:
   * - fluxstack-plugin-*
   * - fplugin-*
   * - @fluxstack/plugin-*
   * - @fplugin/*
   * - @org/fluxstack-plugin-*
   * - @org/fplugin-*
   *
   * 🔒 SECURITY: Respects config.plugins.discoverNpmPlugins and config.plugins.allowedPlugins
   */
  async discoverNpmPlugins(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = []
    const nodeModulesDir = 'node_modules'

    // 🔒 Check if npm plugin discovery is enabled
    if (!this.config?.plugins.discoverNpmPlugins) {
      this.logger?.debug('NPM plugin discovery is disabled (PLUGINS_DISCOVER_NPM=false)')
      return results
    }

    if (!existsSync(nodeModulesDir)) {
      this.logger?.debug('node_modules directory not found')
      return results
    }

    try {
      const entries = await readdir(nodeModulesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check scoped packages (@org/package)
          if (entry.name.startsWith('@')) {
            const scopeDir = join(nodeModulesDir, entry.name)
            const scopedEntries = await readdir(scopeDir, { withFileTypes: true })

            for (const scopedEntry of scopedEntries) {
              if (scopedEntry.isDirectory()) {
                const packageName = `${entry.name}/${scopedEntry.name}`
                let isFluxStackPlugin = false

                // Match patterns:
                // @fluxstack/plugin-*
                if (entry.name === '@fluxstack' && scopedEntry.name.startsWith('plugin-')) {
                  isFluxStackPlugin = true
                }
                // @fplugin/*
                else if (entry.name === '@fplugin') {
                  isFluxStackPlugin = true
                }
                // @org/fluxstack-plugin-*
                else if (scopedEntry.name.startsWith('fluxstack-plugin-')) {
                  isFluxStackPlugin = true
                }
                // @org/fplugin-*
                else if (scopedEntry.name.startsWith('fplugin-')) {
                  isFluxStackPlugin = true
                }

                if (isFluxStackPlugin) {
                  // 🔒 Security check: Verify plugin is in whitelist
                  if (!this.isPluginAllowed(packageName, 'npm')) {
                    this.logger?.debug(`Skipping npm plugin (not in whitelist): ${packageName}`)
                    results.push({
                      success: false,
                      error: `Plugin '${packageName}' is not in the allowed plugins whitelist (PLUGINS_ALLOWED)`
                    })
                    continue
                  }

                  const pluginPath = join(scopeDir, scopedEntry.name)
                  this.logger?.debug(`Loading whitelisted npm plugin: ${packageName}`)

                  const result = await this.loadPlugin(pluginPath)
                  results.push(result)
                }
              }
            }
          }
          // Check non-scoped packages
          else if (
            entry.name.startsWith('fluxstack-plugin-') ||
            entry.name.startsWith('fplugin-')
          ) {
            // 🔒 Security check: Verify plugin is in whitelist
            if (!this.isPluginAllowed(entry.name, 'npm')) {
              this.logger?.debug(`Skipping npm plugin (not in whitelist): ${entry.name}`)
              results.push({
                success: false,
                error: `Plugin '${entry.name}' is not in the allowed plugins whitelist (PLUGINS_ALLOWED)`
              })
              continue
            }

            const pluginPath = join(nodeModulesDir, entry.name)
            this.logger?.debug(`Loading whitelisted npm plugin: ${entry.name}`)

            const result = await this.loadPlugin(pluginPath)
            results.push(result)
          }
        }
      }

      // 🔒 Security summary
      const successful = results.filter(r => r.success).length
      const blocked = results.filter(r => !r.success && r.error?.includes('whitelist')).length
      const failed = results.filter(r => !r.success && !r.error?.includes('whitelist')).length

      if (blocked > 0) {
        this.logger?.warn(`🔒 Security: Blocked ${blocked} npm plugin(s) not in whitelist (PLUGINS_ALLOWED)`)
      }

      this.logger?.info(`Discovered ${successful} allowed npm plugin(s)`, {
        total: results.length,
        successful,
        blocked,
        failed
      })
    } catch (error) {
      this.logger?.error('Failed to discover npm plugins', { error })
    }

    return results
  }

  /**
   * Discover plugins from filesystem
   *
   * 🔒 SECURITY: Respects config.plugins.discoverProjectPlugins for project plugins
   */
  async discoverPlugins(options: PluginDiscoveryOptions = {}): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = []
    const {
      directories = ['plugins'],
      patterns: _patterns = ['**/plugin.{js,ts}', '**/index.{js,ts}'],
      includeBuiltIn: _includeBuiltIn = false,
      includeExternal: _includeExternal = true
    } = options

    // 🔒 Check if project plugin discovery is enabled
    if (!this.config?.plugins.discoverProjectPlugins) {
      this.logger?.debug('Project plugin discovery is disabled (PLUGINS_DISCOVER_PROJECT=false)')
      return results
    }

    // Descobrir plugins
    for (const directory of directories) {
      this.logger?.debug(`Scanning directory: ${directory}`)
      if (!existsSync(directory)) {
        this.logger?.warn(`Directory does not exist: ${directory}`)
        continue
      }

      try {
        const pluginResults = await this.discoverPluginsInDirectory(directory, _patterns)
        this.logger?.debug(`Found ${pluginResults.length} plugins in ${directory}`)

        for (const pluginResult of pluginResults) {
          if (pluginResult.success && pluginResult.plugin) {
            if (!this.isPluginAllowed(pluginResult.plugin.name, 'project')) {
              results.push({
                success: false,
                error: `Plugin '${pluginResult.plugin.name}' is not in the allowed plugins whitelist (PLUGINS_ALLOWED)`
              })
              continue
            }
          }

          results.push(pluginResult)
        }
      } catch (error) {
        this.logger?.warn(`Failed to discover plugins in directory '${directory}'`, { error })
        results.push({
          success: false,
          error: `Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    }

    // Resolver e instalar dependências
    await this.resolveDependencies(results)

    return results
  }

  /**
   * Load a plugin from file path
   */
  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    try {
      // Check if manifest exists
      const manifestPath = join(pluginPath, 'plugin.json')
      let manifest: PluginManifest | undefined

      if (existsSync(manifestPath)) {
        const manifestContent = await readFile(manifestPath, 'utf-8')
        manifest = JSON.parse(manifestContent)
      } else {
        // Try package.json for npm plugins
        const packagePath = join(pluginPath, 'package.json')
        if (existsSync(packagePath)) {
          try {
            const packageContent = await readFile(packagePath, 'utf-8')
            const packageJson = JSON.parse(packageContent)

            if (packageJson.fluxstack) {
              manifest = {
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
            this.logger?.warn(`Failed to parse package.json in '${pluginPath}'`, { error })
          }
        }
      }

      // Check and install plugin dependencies
      if (manifest && manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
        const isProjectPlugin = pluginPath.includes('plugins' + sep)

        if (isProjectPlugin) {
          // Install dependencies locally in plugin directory
          this.logger?.debug(
            `Installing dependencies for plugin '${manifest.name}' in ${pluginPath}`,
            { dependencies: Object.keys(manifest.dependencies).length }
          )

          try {
            await this.dependencyManager.installDependenciesInPath(
              pluginPath,
              manifest.dependencies
            )
          } catch (error) {
            this.logger?.warn(
              `Failed to install dependencies for plugin '${manifest.name}'. ` +
              `You can install manually with: cd ${pluginPath} && bun install`
            )
          }
        } else {
          // NPM plugins always show warning
          this.logger?.warn(`Plugin '${manifest.name}' declares dependencies. Run 'bun run flux plugin:deps install ${manifest.name}' to review and install them manually.`)
        }
      }

      // Try to import the plugin (after dependencies are installed)
      const pluginModule = await import(resolve(pluginPath))
      const plugin: FluxStackPlugin = pluginModule.default || pluginModule

      if (!plugin || typeof plugin !== 'object' || !plugin.name) {
        return {
          success: false,
          error: 'Invalid plugin: must export a plugin object with a name property'
        }
      }

      // Register the plugin
      await this.register(plugin, manifest)

      return {
        success: true,
        plugin,
        warnings: manifest ? [] : ['No plugin manifest found']
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Validate plugin structure
   */
  private validatePlugin(plugin: FluxStackPlugin): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new FluxStackError(
        'Plugin must have a valid name property',
        'INVALID_PLUGIN_STRUCTURE',
        400
      )
    }

    if (plugin.version && typeof plugin.version !== 'string') {
      throw new FluxStackError(
        'Plugin version must be a string',
        'INVALID_PLUGIN_STRUCTURE',
        400
      )
    }

    if (plugin.dependencies && !Array.isArray(plugin.dependencies)) {
      throw new FluxStackError(
        'Plugin dependencies must be an array',
        'INVALID_PLUGIN_STRUCTURE',
        400
      )
    }

    if (plugin.priority && typeof plugin.priority !== 'number') {
      throw new FluxStackError(
        'Plugin priority must be a number',
        'INVALID_PLUGIN_STRUCTURE',
        400
      )
    }
  }

  /**
   * Validate plugin configuration against schema
   */
  private validatePluginConfig(plugin: FluxStackPlugin, config: any): void {
    if (!plugin.configSchema) {
      return
    }

    // Basic validation - in a real implementation, you'd use a proper JSON schema validator
    if (plugin.configSchema.required) {
      for (const requiredField of plugin.configSchema.required) {
        if (!(requiredField in config)) {
          throw new FluxStackError(
            `Plugin '${plugin.name}' configuration missing required field: ${requiredField}`,
            'INVALID_PLUGIN_CONFIG',
            400
          )
        }
      }
    }
  }

  /**
   * Update the load order based on dependencies and priorities.
   *
   * Uses a priority-aware topological sort: at each round, picks all plugins
   * whose dependencies are already placed, then sorts that group by priority
   * (highest first) before appending. This preserves dependency constraints
   * while respecting priority within each dependency level.
   */
  private updateLoadOrder(): void {
    // First, detect circular dependencies via DFS
    const visiting = new Set<string>()
    const visited = new Set<string>()

    const detectCycles = (pluginName: string) => {
      if (visiting.has(pluginName)) {
        throw new FluxStackError(
          `Circular dependency detected involving plugin '${pluginName}'`,
          'CIRCULAR_DEPENDENCY',
          400
        )
      }
      if (visited.has(pluginName)) return

      visiting.add(pluginName)
      const plugin = this.plugins.get(pluginName)
      if (plugin?.dependencies) {
        for (const dep of plugin.dependencies) {
          if (this.plugins.has(dep)) {
            detectCycles(dep)
          }
        }
      }
      visiting.delete(pluginName)
      visited.add(pluginName)
    }

    for (const pluginName of this.plugins.keys()) {
      detectCycles(pluginName)
    }

    // Kahn's algorithm with priority-aware group selection
    const placed = new Set<string>()
    const order: string[] = []
    const remaining = new Set(this.plugins.keys())

    while (remaining.size > 0) {
      // Find all plugins whose dependencies are satisfied
      const ready: string[] = []
      for (const name of remaining) {
        const plugin = this.plugins.get(name)
        const deps = plugin?.dependencies ?? []
        const allDepsPlaced = deps.every(d => !this.plugins.has(d) || placed.has(d))
        if (allDepsPlaced) {
          ready.push(name)
        }
      }

      if (ready.length === 0) {
        // Should not happen after cycle detection, but guard against it
        break
      }

      // Sort ready plugins by priority (highest first)
      ready.sort((a, b) => {
        const pluginA = this.plugins.get(a)
        const pluginB = this.plugins.get(b)
        const priorityA = typeof pluginA?.priority === 'number' ? pluginA.priority : 0
        const priorityB = typeof pluginB?.priority === 'number' ? pluginB.priority : 0
        return priorityB - priorityA
      })

      for (const name of ready) {
        order.push(name)
        placed.add(name)
        remaining.delete(name)
      }
    }

    this.loadOrder = order
  }

  /**
   * Resolver dependências de todos os plugins descobertos
   */
  private async resolveDependencies(results: PluginLoadResult[]): Promise<void> {
    // Dependencies are now installed during plugin loading in loadPlugin()
    // This method is kept for compatibility but no longer performs installation

    // Only check for dependency conflicts on successfully loaded plugins
    for (const result of results) {
      if (result.success && result.plugin) {
        try {
          const pluginDir = this.findPluginDirectory(result.plugin.name)
          if (pluginDir) {
            const resolution = await this.dependencyManager.resolvePluginDependencies(pluginDir)

            if (!resolution.resolved) {
              this.logger?.warn(`Plugin '${result.plugin.name}' has dependency conflicts`, {
                conflicts: resolution.conflicts.length
              })
            }
          }
        } catch (error) {
          this.logger?.warn(`Failed to check dependencies for plugin '${result.plugin.name}'`, { error })
        }
      }
    }
  }

  /**
   * Encontrar diretório de um plugin pelo nome
   */
  private findPluginDirectory(pluginName: string): string | null {
    const possiblePaths = [
      `plugins/${pluginName}`,
      `core/plugins/built-in/${pluginName}`
    ]

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path
      }
    }

    return null
  }

  /**
   * Discover plugins in a specific directory
   */
  private async discoverPluginsInDirectory(
    directory: string,
    _patterns: string[]
  ): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = []
    
    try {
      const entries = await readdir(directory, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginDir = join(directory, entry.name)
          
          // Check if this looks like a plugin directory
          // Skip if it's just an index file in the root of built-in directory
          if (directory === 'core/plugins/built-in' && entry.name === 'index.ts') {
            continue
          }
          
          const hasPluginFile = existsSync(join(pluginDir, 'index.ts')) || 
                               existsSync(join(pluginDir, 'index.js')) ||
                               existsSync(join(pluginDir, 'plugin.ts')) ||
                               existsSync(join(pluginDir, 'plugin.js'))
          
          if (hasPluginFile) {
            this.logger?.debug(`Loading plugin from: ${pluginDir}`)
            const result = await this.loadPlugin(pluginDir)
            results.push(result)
          }
        }
      }
    } catch (error) {
      this.logger?.error(`Failed to read directory '${directory}'`, { error })
    }
    
    return results
  }
}




