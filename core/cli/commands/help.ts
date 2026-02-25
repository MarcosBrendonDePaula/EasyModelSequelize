/**
 * FluxStack CLI - Help Command
 * Display help information for commands
 */

import type { CLICommand } from '../command-registry'
import { cliRegistry } from '../command-registry'

export const helpCommand: CLICommand = {
  name: 'help',
  description: 'Show help information',
  category: 'General',
  aliases: ['h', '--help', '-h'],
  arguments: [
    {
      name: 'command',
      description: 'Command to show help for',
      required: false
    }
  ],
  handler: async (args, options, context) => {
    if (args[0]) {
      const targetCommand = cliRegistry.get(args[0])
      if (targetCommand) {
        cliRegistry.showCommandHelp(targetCommand)
      } else {
        console.error(`❌ Unknown command: ${args[0]}`)
        cliRegistry.showHelp()
      }
    } else {
      cliRegistry.showHelp()
    }
  }
}
