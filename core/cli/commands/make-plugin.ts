/**
 * FluxStack CLI - Make Plugin Command
 * Create a new FluxStack plugin
 */

import type { CLICommand } from '../command-registry'

export const makePluginCommand: CLICommand = {
  name: 'make:plugin',
  description: 'Create a new FluxStack plugin',
  category: 'Plugins',
  usage: 'flux make:plugin <name> [options]',
  aliases: ['create:plugin'],
  examples: [
    'flux make:plugin my-plugin              # Create basic plugin',
    'flux make:plugin my-plugin --template full    # Create full plugin with server/client',
    'flux make:plugin auth --template server       # Create server-only plugin'
  ],
  arguments: [
    {
      name: 'name',
      description: 'Name of the plugin to create',
      required: true,
      type: 'string'
    }
  ],
  options: [
    {
      name: 'template',
      short: 't',
      description: 'Plugin template to use',
      type: 'string',
      choices: ['basic', 'full', 'server', 'client'],
      default: 'basic'
    },
    {
      name: 'description',
      short: 'd',
      description: 'Plugin description',
      type: 'string',
      default: 'A FluxStack plugin'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Overwrite existing plugin',
      type: 'boolean',
      default: false
    }
  ],
  handler: async (args, options, context) => {
    const [name] = args

    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      console.error("❌ Plugin name can only contain letters, numbers, hyphens, and underscores")
      return
    }

    // Use the plugin generator
    const { generatorRegistry } = await import('../generators/index')
    const pluginGenerator = generatorRegistry.get('plugin')

    if (!pluginGenerator) {
      console.error("❌ Plugin generator not found")
      return
    }

    const generatorContext = {
      workingDir: context.workingDir,
      config: context.config,
      logger: context.logger,
      utils: context.utils
    }

    const generatorOptions = {
      name,
      template: options.template,
      force: options.force,
      dryRun: false,
      description: options.description
    }

    try {
      await pluginGenerator.generate(generatorContext, generatorOptions)
    } catch (error) {
      console.error("❌ Failed to create plugin:", error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}
