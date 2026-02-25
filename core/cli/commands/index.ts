/**
 * FluxStack CLI Commands
 * Central export for all command modules
 */

// General commands
export { helpCommand } from './help'

// Development commands
export { devCommand } from './dev'

// Build commands
export { buildCommand } from './build'

// Project commands
export { createCommand } from './create'

// Plugin commands (management)
export { makePluginCommand } from './make-plugin'

// Export all commands as an array for easy registration
import { helpCommand } from './help'
import { devCommand } from './dev'
import { buildCommand } from './build'
import { createCommand } from './create'
import { makePluginCommand } from './make-plugin'

export const builtInCommands = [
  helpCommand,
  devCommand,
  buildCommand,
  createCommand,
  makePluginCommand,
]
