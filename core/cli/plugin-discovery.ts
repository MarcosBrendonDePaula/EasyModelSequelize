import { existsSync } from 'fs'
import { join } from 'path'
import type { FluxStack } from '@core/plugins/types'
import { cliRegistry } from './command-registry'
import { logger } from '@core/utils/logger'

export class CliPluginDiscovery {
  private loadedPlugins = new Set<string>()

  async discoverAndRegisterCommands(): Promise<void> {
    // 1. Load built-in plugins with CLI commands
    await this.loadBuiltInPlugins()

    // 2. Load local plugins from project
    await this.loadLocalPlugins()
  }

  private async loadBuiltInPlugins(): Promise<void> {
    const builtInPluginsDir = join(__dirname, '../plugins/built-in')

    if (!existsSync(builtInPluginsDir)) {
      return
    }

    try {
      const fs = await import('fs')
      const potentialPlugins = fs.readdirSync(builtInPluginsDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)

      for (const pluginName of potentialPlugins) {
        try {
          const pluginPath = join(builtInPluginsDir, pluginName, 'index.ts')
          if (existsSync(pluginPath)) {
            const pluginModule = await import(pluginPath)

            if (pluginModule.commands) {
              for (const command of pluginModule.commands) {
                cliRegistry.register(command)
              }
              this.loadedPlugins.add(pluginName)
              logger.debug(`Registered ${pluginModule.commands.length} CLI commands from built-in plugin: ${pluginName}`)
            }
          }
        } catch (error) {
          logger.debug(`Failed to load built-in plugin ${pluginName}:`, error)
        }
      }
    } catch (error) {
      logger.debug('Failed to scan built-in plugins:', error)
    }
  }

  // Métodos removidos - não carregamos mais plugins do node_modules
  // private async loadExternalPlugins(): Promise<void> { ... }
  // private async loadExternalPlugin(packageName: string): Promise<void> { ... }

  private async loadLocalPlugins(): Promise<void> {
    const localPluginsDir = join(process.cwd(), 'plugins')

    if (!existsSync(localPluginsDir)) {
      return
    }

    try {
      const fs = await import('fs')
      const entries = fs.readdirSync(localPluginsDir, { withFileTypes: true })

      for (const entry of entries) {
        // Buscar arquivos .ts/.js diretamente
        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          const pluginPath = join(localPluginsDir, entry.name)

          try {
            const pluginModule = await import(pluginPath)
            const plugin = pluginModule.default || Object.values(pluginModule).find(
              (exp: any) => exp && typeof exp === 'object' && exp.name && exp.commands
            ) as Plugin

            if (plugin && plugin.commands) {
              this.registerPluginCommands(plugin)
            }
          } catch (error) {
            logger.debug(`Failed to load local plugin ${entry.name}:`, error)
          }
        }

        // ✅ Buscar em subdiretórios (plugins/nome-plugin/index.ts)
        if (entry.isDirectory()) {
          const pluginIndexPath = join(localPluginsDir, entry.name, 'index.ts')

          if (existsSync(pluginIndexPath)) {
            try {
              const pluginModule = await import(pluginIndexPath)
              const plugin = pluginModule.default || Object.values(pluginModule).find(
                (exp: any) => exp && typeof exp === 'object' && exp.name && exp.commands
              ) as Plugin

              if (plugin && plugin.commands) {
                this.registerPluginCommands(plugin)
              }
            } catch (error) {
              logger.debug(`Failed to load local plugin ${entry.name}:`, error)
            }
          }
        }
      }
    } catch (error) {
      logger.debug('Failed to scan local plugins:', error)
    }
  }

  private registerPluginCommands(plugin: FluxStack.Plugin): void {
    if (!plugin.commands || this.loadedPlugins.has(plugin.name)) {
      return
    }

    try {
      for (const command of plugin.commands) {
        // Prefix command with plugin name to avoid conflicts
        const prefixedCommand = {
          ...command,
          name: `${plugin.name}:${command.name}`,
          category: command.category || `Plugin: ${plugin.name}`,
          aliases: command.aliases?.map(alias => `${plugin.name}:${alias}`)
        }

        cliRegistry.register(prefixedCommand)

        // Also register without prefix if no conflict exists
        if (!cliRegistry.has(command.name)) {
          cliRegistry.register({
            ...command,
            category: command.category || `Plugin: ${plugin.name}`
          })
        }
      }

      this.loadedPlugins.add(plugin.name)
      logger.debug(`Registered ${plugin.commands.length} CLI commands from plugin: ${plugin.name}`)

    } catch (error) {
      logger.error(`Failed to register CLI commands for plugin ${plugin.name}:`, error)
    }
  }

  getLoadedPlugins(): string[] {
    return Array.from(this.loadedPlugins)
  }
}

export const pluginDiscovery = new CliPluginDiscovery()
