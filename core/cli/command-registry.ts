import type { CliCommand, CliContext, CliArgument, CliOption } from "../plugins/types"
import { fluxStackConfig } from "@config"
import { logger } from "@core/utils/logger"
import { createTimer, formatBytes, isProduction, isDevelopment } from "../utils/helpers"

export class CliCommandRegistry {
  private commands = new Map<string, CliCommand>()
  private aliases = new Map<string, string>()
  private context: CliContext

  constructor() {
    const config = fluxStackConfig

    this.context = {
      config,
      logger: logger as any,
      utils: {
        createTimer,
        formatBytes,
        isProduction,
        isDevelopment,
        getEnvironment: () => process.env.NODE_ENV || 'development',
        createHash: (data: string) => {
          const crypto = require('crypto')
          return crypto.createHash('sha256').update(data).digest('hex')
        },
        deepMerge: (target: Record<string, unknown>, source: Record<string, unknown>) => {
          const result = { ...target }
          for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
              result[key] = this.context.utils.deepMerge(result[key] as Record<string, unknown> || {}, source[key] as Record<string, unknown>)
            } else {
              result[key] = source[key]
            }
          }
          return result
        },
        validateSchema: (_data: unknown, _schema: unknown) => {
          try {
            return { valid: true, errors: [] }
          } catch (error) {
            return { valid: false, errors: [error instanceof Error ? error.message : 'Validation failed'] }
          }
        }
      },
      workingDir: process.cwd(),
      packageInfo: {
        name: 'fluxstack',
        version: '1.0.0'
      }
    }
  }

  register(command: CliCommand): void {
    // Register main command
    this.commands.set(command.name, command)
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name)
      }
    }
  }

  get(name: string): CliCommand | undefined {
    // Check direct command
    const command = this.commands.get(name)
    if (command) return command
    
    // Check alias
    const aliasTarget = this.aliases.get(name)
    if (aliasTarget) {
      return this.commands.get(aliasTarget)
    }
    
    return undefined
  }

  has(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name)
  }

  getAll(): CliCommand[] {
    return Array.from(this.commands.values())
  }

  getAllByCategory(): Map<string, CliCommand[]> {
    const categories = new Map<string, CliCommand[]>()
    
    for (const command of this.commands.values()) {
      if (command.hidden) continue
      
      const category = command.category || 'General'
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(command)
    }
    
    return categories
  }

  async execute(commandName: string, args: string[]): Promise<number> {
    const command = this.get(commandName)
    
    if (!command) {
      console.error(`❌ Unknown command: ${commandName}`)
      this.showHelp()
      return 1
    }

    try {
      // Parse arguments and options
      const { parsedArgs, parsedOptions } = this.parseArgs(command, args)
      
      // Validate required arguments
      if (command.arguments) {
        for (let i = 0; i < command.arguments.length; i++) {
          const arg = command.arguments[i]
          if (arg.required && !parsedArgs[i]) {
            console.error(`❌ Missing required argument: ${arg.name}`)
            this.showCommandHelp(command)
            return 1
          }
        }
      }
      
      // Validate required options
      if (command.options) {
        for (const option of command.options) {
          if (option.required && !(option.name in parsedOptions)) {
            console.error(`❌ Missing required option: --${option.name}`)
            this.showCommandHelp(command)
            return 1
          }
        }
      }

      // Execute command
      await command.handler(parsedArgs, parsedOptions, this.context)
      return 0
      
    } catch (error) {
      console.error(`❌ Command failed:`, error instanceof Error ? error.message : String(error))
      return 1
    }
  }

  private parseArgs(command: CliCommand, args: string[]): { parsedArgs: any[], parsedOptions: any } {
    const parsedArgs: any[] = []
    const parsedOptions: any = {}
    
    let i = 0
    while (i < args.length) {
      const arg = args[i]
      
      // Handle options (--name or -n)
      if (arg.startsWith('--')) {
        const optionName = arg.slice(2)
        const option = command.options?.find(o => o.name === optionName)
        
        if (option) {
          if (option.type === 'boolean') {
            parsedOptions[optionName] = true
          } else if (option.type === 'array') {
            parsedOptions[optionName] = parsedOptions[optionName] || []
            if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
              parsedOptions[optionName].push(args[++i])
            }
          } else {
            if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
              parsedOptions[optionName] = this.convertType(args[++i], option.type)
            }
          }
        }
      } 
      // Handle short options (-n)
      else if (arg.startsWith('-') && arg.length === 2) {
        const shortName = arg.slice(1)
        const option = command.options?.find(o => o.short === shortName)
        
        if (option) {
          if (option.type === 'boolean') {
            parsedOptions[option.name] = true
          } else {
            if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
              parsedOptions[option.name] = this.convertType(args[++i], option.type)
            }
          }
        }
      }
      // Handle positional arguments
      else {
        const argIndex = parsedArgs.length
        const argDef = command.arguments?.[argIndex]
        
        if (argDef) {
          parsedArgs.push(this.convertType(arg, argDef.type))
        } else {
          parsedArgs.push(arg)
        }
      }
      
      i++
    }
    
    // Apply defaults
    if (command.arguments) {
      for (let i = 0; i < command.arguments.length; i++) {
        if (parsedArgs[i] === undefined && command.arguments[i].default !== undefined) {
          parsedArgs[i] = command.arguments[i].default
        }
      }
    }
    
    if (command.options) {
      for (const option of command.options) {
        if (!(option.name in parsedOptions) && option.default !== undefined) {
          parsedOptions[option.name] = option.default
        }
      }
    }
    
    return { parsedArgs, parsedOptions }
  }

  private convertType(value: string, type?: 'string' | 'number' | 'boolean' | 'array'): any {
    if (!type || type === 'string') return value
    if (type === 'number') return Number(value)
    if (type === 'boolean') return value.toLowerCase() === 'true'
    if (type === 'array') return [value] // Convert single value to array
    return value
  }

  showHelp(): void {
    console.log(`
⚡ FluxStack Framework CLI

Usage:
  flux <command> [options] [arguments]
  fluxstack <command> [options] [arguments]

Built-in Commands:`)

    const categories = this.getAllByCategory()
    
    for (const [category, commands] of categories) {
      console.log(`\n${category}:`)
      for (const command of commands) {
        const aliases = command.aliases?.length ? ` (${command.aliases.join(', ')})` : ''
        console.log(`  ${command.name}${aliases.padEnd(20)} ${command.description}`)
      }
    }

    console.log(`
Examples:
  flux dev                    # Start development server
  flux build --production    # Build for production
  flux create my-app          # Create new project
  flux help <command>         # Show help for specific command

Use "flux help <command>" for more information about a specific command.`)
  }

  showCommandHelp(command: CliCommand): void {
    console.log(`\n${command.description}`)
    
    if (command.usage) {
      console.log(`\nUsage:\n  ${command.usage}`)
    } else {
      let usage = `flux ${command.name}`
      
      if (command.arguments) {
        for (const arg of command.arguments) {
          if (arg.required) {
            usage += ` <${arg.name}>`
          } else {
            usage += ` [${arg.name}]`
          }
        }
      }
      
      if (command.options?.length) {
        usage += ` [options]`
      }
      
      console.log(`\nUsage:\n  ${usage}`)
    }
    
    if (command.arguments?.length) {
      console.log(`\nArguments:`)
      for (const arg of command.arguments) {
        const required = arg.required ? ' (required)' : ''
        const defaultValue = arg.default !== undefined ? ` (default: ${arg.default})` : ''
        console.log(`  ${arg.name.padEnd(15)} ${arg.description}${required}${defaultValue}`)
      }
    }
    
    if (command.options?.length) {
      console.log(`\nOptions:`)
      for (const option of command.options) {
        const short = option.short ? `-${option.short}, ` : '    '
        const required = option.required ? ' (required)' : ''
        const defaultValue = option.default !== undefined ? ` (default: ${option.default})` : ''
        console.log(`  ${short}--${option.name.padEnd(15)} ${option.description}${required}${defaultValue}`)
      }
    }
    
    if (command.examples?.length) {
      console.log(`\nExamples:`)
      for (const example of command.examples) {
        console.log(`  ${example}`)
      }
    }
    
    if (command.aliases?.length) {
      console.log(`\nAliases: ${command.aliases.join(', ')}`)
    }
  }
}

// Global registry instance
export const cliRegistry = new CliCommandRegistry()

export type CLICommand = CliCommand
