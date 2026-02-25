import type { FluxStack, PluginContext } from '@core/plugins/types'
import { createLiveComponentCommand } from './commands/create-live-component'

type Plugin = FluxStack.Plugin

// This is the entry point for the live-components built-in plugin.
export const liveComponentsPlugin: Plugin = {
  name: 'live-components',
  version: '1.0.0',
  description: 'Live Components CLI commands for FluxStack',
  author: 'FluxStack Team',
  priority: 500,
  category: 'development',
  tags: ['live-components', 'cli', 'generator'],
  
  setup: async (context: PluginContext) => {
    context.logger.info('Live Components plugin initialized (CLI commands only)')
  },
  
  // CLI commands
  commands: [createLiveComponentCommand]
}

// Export commands for backward compatibility
export const commands = [createLiveComponentCommand]

export default liveComponentsPlugin
