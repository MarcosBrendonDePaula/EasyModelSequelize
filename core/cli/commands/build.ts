/**
 * FluxStack CLI - Build Command
 * Build the application for production
 */

import type { CLICommand } from '../command-registry'
import { FluxStackBuilder } from '@core/build'
import { fluxStackConfig } from '@config'

export const buildCommand: CLICommand = {
  name: 'build',
  description: 'Build the application for production',
  category: 'Build',
  usage: 'flux build [options]',
  examples: [
    'flux build                  # Build both frontend and backend',
    'flux build --frontend-only  # Build only frontend',
    'flux build --backend-only   # Build only backend'
  ],
  options: [
    {
      name: 'frontend-only',
      description: 'Build only frontend',
      type: 'boolean'
    },
    {
      name: 'backend-only',
      description: 'Build only backend',
      type: 'boolean'
    },
    {
      name: 'production',
      description: 'Build for production (minified)',
      type: 'boolean',
      default: true
    }
  ],
  handler: async (args, options, context) => {
    const config = fluxStackConfig

    // Load plugins for build hooks
    const { PluginRegistry } = await import('@core/plugins/registry')
    const { PluginManager } = await import('@core/plugins/manager')
    const pluginRegistry = new PluginRegistry({ config, logger: context.logger })
    const pluginManager = new PluginManager({ config, logger: context.logger })

    try {
      await pluginManager.initialize()
      // Sync plugins to registry (same as framework does)
      const discoveredPlugins = pluginManager.getRegistry().getAll()
      for (const plugin of discoveredPlugins) {
        if (!pluginRegistry.has(plugin.name)) {
          (pluginRegistry as any).plugins.set(plugin.name, plugin)
          if (plugin.dependencies) {
            (pluginRegistry as any).dependencies.set(plugin.name, plugin.dependencies)
          }
        }
      }
      try {
        (pluginRegistry as any).updateLoadOrder()
      } catch (error) {
        const plugins = (pluginRegistry as any).plugins as Map<string, any>
        ;(pluginRegistry as any).loadOrder = Array.from(plugins.keys())
      }
    } catch (error) {
      context.logger.warn('Failed to load plugins for build hooks', { error })
    }

    const builder = new FluxStackBuilder(config, pluginRegistry)

    if (options['frontend-only']) {
      await builder.buildClient()
    } else if (options['backend-only']) {
      await builder.buildServer()
    } else {
      await builder.build()
    }
  }
}
