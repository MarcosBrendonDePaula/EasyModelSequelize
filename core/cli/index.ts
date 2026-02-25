#!/usr/bin/env bun

/**
 * FluxStack CLI Entry Point
 * Modular command structure with each command in its own file
 */

import { cliRegistry } from "./command-registry"
import { pluginDiscovery } from "./plugin-discovery"
import { generateCommand, interactiveGenerateCommand } from "./generators/index"

// Import modular commands
import { builtInCommands } from "./commands"

const command = process.argv[2]
const args = process.argv.slice(3)

// Register built-in commands
async function registerBuiltInCommands() {
  // Register modular commands from commands/
  for (const cmd of builtInCommands) {
    cliRegistry.register(cmd)
  }

  // Register generate commands (still in generators/)
  cliRegistry.register(generateCommand)
  cliRegistry.register(interactiveGenerateCommand)

  // Register plugin commands that use Commander.js (dynamic imports)
  cliRegistry.register({
    name: 'plugin:add',
    description: 'Install and whitelist an NPM plugin securely',
    category: 'Plugins',
    arguments: [
      {
        name: 'plugin-name',
        description: 'Name of the plugin to install (e.g., fluxstack-plugin-auth)',
        required: true
      }
    ],
    options: [
      {
        name: '--skip-audit',
        description: 'Skip npm audit check'
      },
      {
        name: '--skip-confirmation',
        description: 'Skip confirmation prompt'
      }
    ],
    handler: async (args, options, context) => {
      const { createPluginAddCommand } = await import('./commands/plugin-add')
      const cmd = createPluginAddCommand()
      await cmd.parseAsync(['node', 'cli', ...args], { from: 'user' })
    }
  })

  cliRegistry.register({
    name: 'plugin:remove',
    description: 'Remove plugin from whitelist and optionally uninstall',
    category: 'Plugins',
    aliases: ['plugin:rm'],
    arguments: [
      {
        name: 'plugin-name',
        description: 'Name of the plugin to remove',
        required: true
      }
    ],
    options: [
      {
        name: '--skip-confirmation',
        description: 'Skip confirmation prompt'
      },
      {
        name: '--keep-installed',
        description: 'Keep plugin installed, only remove from whitelist'
      }
    ],
    handler: async (args, options, context) => {
      const { createPluginRemoveCommand } = await import('./commands/plugin-remove')
      const cmd = createPluginRemoveCommand()
      await cmd.parseAsync(['node', 'cli', ...args], { from: 'user' })
    }
  })

  cliRegistry.register({
    name: 'plugin:list',
    description: 'List all plugins (installed, whitelisted, and discovered)',
    category: 'Plugins',
    aliases: ['plugin:ls'],
    options: [
      {
        name: '--installed',
        description: 'Show only installed NPM plugins'
      },
      {
        name: '--whitelisted',
        description: 'Show only whitelisted plugins'
      },
      {
        name: '--json',
        description: 'Output as JSON'
      }
    ],
    handler: async (args, options, context) => {
      const { createPluginListCommand } = await import('./commands/plugin-list')
      const cmd = createPluginListCommand()
      await cmd.parseAsync(['node', 'cli', ...args], { from: 'user' })
    }
  })

  cliRegistry.register({
    name: 'plugin:deps',
    description: 'Gerenciar dependências de plugins',
    category: 'Plugins',
    handler: async (args, options, context) => {
      if (args.length === 0) {
        console.log(`
⚡ FluxStack Plugin Dependencies Manager

Usage:
  flux plugin:deps install     Install plugin dependencies
  flux plugin:deps list        List plugin dependencies
  flux plugin:deps check       Check for dependency conflicts
  flux plugin:deps clean       Clean unused dependencies

Examples:
  flux plugin:deps install --dry-run    # Show what would be installed
  flux plugin:deps list --plugin crypto-auth  # Show specific plugin deps
  flux plugin:deps check                # Check for conflicts
        `)
        return
      }

      const subcommand = args[0]
      const subArgs = args.slice(1)

      const { createPluginDepsCommand } = await import('./commands/plugin-deps')
      const cmd = createPluginDepsCommand()

      switch (subcommand) {
        case 'install':
          const installCmd = cmd.commands.find(c => c.name() === 'install')
          if (installCmd) {
            await installCmd.parseAsync(['node', 'cli', ...subArgs], { from: 'user' })
          }
          break
        case 'list':
          const listCmd = cmd.commands.find(c => c.name() === 'list')
          if (listCmd) {
            await listCmd.parseAsync(['node', 'cli', ...subArgs], { from: 'user' })
          }
          break
        case 'check':
          const checkCmd = cmd.commands.find(c => c.name() === 'check')
          if (checkCmd) {
            await checkCmd.parseAsync(['node', 'cli', ...subArgs], { from: 'user' })
          }
          break
        case 'clean':
          const cleanCmd = cmd.commands.find(c => c.name() === 'clean')
          if (cleanCmd) {
            await cleanCmd.parseAsync(['node', 'cli', ...subArgs], { from: 'user' })
          }
          break
        default:
          console.error(`❌ Unknown subcommand: ${subcommand}`)
          console.error('Available subcommands: install, list, check, clean')
      }
    }
  })

  // Discover and register plugin-provided commands
  try {
    await pluginDiscovery.discoverAndRegisterCommands()
  } catch (error) {
    // Plugin command discovery is optional
    // console.warn('Failed to discover plugin commands:', error)
  }
}

// Initialize and run CLI
async function main() {
  await registerBuiltInCommands()
  await cliRegistry.execute(command, args)
}

main().catch((error) => {
  console.error('CLI Error:', error)
  process.exit(1)
})
