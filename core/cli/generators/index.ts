import type { CliCommand } from "../../plugins/types"
import { ControllerGenerator } from "./controller"
import { RouteGenerator } from "./route"
import { ComponentGenerator } from "./component"
import { ServiceGenerator } from "./service"
import { PluginGenerator } from "./plugin"
import type { GeneratorContext, GeneratorOptions } from "./types"

export interface Generator {
  name: string
  description: string
  generate(context: GeneratorContext, options: GeneratorOptions): Promise<void>
}

export class GeneratorRegistry {
  private generators = new Map<string, Generator>()

  constructor() {
    this.registerBuiltInGenerators()
  }

  private registerBuiltInGenerators() {
    this.register(new ControllerGenerator())
    this.register(new RouteGenerator())
    this.register(new ComponentGenerator())
    this.register(new ServiceGenerator())
    this.register(new PluginGenerator())
  }

  register(generator: Generator): void {
    this.generators.set(generator.name, generator)
  }

  get(name: string): Generator | undefined {
    return this.generators.get(name)
  }

  getAll(): Generator[] {
    return Array.from(this.generators.values())
  }

  has(name: string): boolean {
    return this.generators.has(name)
  }
}

export const generatorRegistry = new GeneratorRegistry()

// Export additional commands
export { interactiveGenerateCommand } from "./interactive"

// CLI command for code generation
export const generateCommand: CliCommand = {
  name: 'generate',
  description: 'Generate code from templates',
  usage: 'flux generate <type> <name> [options]',
  aliases: ['g', 'gen'],
  category: 'Development',
  examples: [
    'flux generate controller user',
    'flux generate component UserCard',
    'flux generate service auth',
    'flux generate route api/users',
    'flux generate plugin my-plugin'
  ],
  arguments: [
    {
      name: 'type',
      description: 'Type of code to generate',
      required: true,
      type: 'string',
      choices: ['controller', 'route', 'component', 'service', 'plugin']
    },
    {
      name: 'name',
      description: 'Name of the generated item',
      required: true,
      type: 'string'
    }
  ],
  options: [
    {
      name: 'path',
      short: 'p',
      description: 'Custom path for generated files',
      type: 'string'
    },
    {
      name: 'template',
      short: 't',
      description: 'Template variant to use',
      type: 'string'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Overwrite existing files',
      type: 'boolean',
      default: false
    },
    {
      name: 'dry-run',
      description: 'Show what would be generated without creating files',
      type: 'boolean',
      default: false
    }
  ],
  handler: async (args, options, context) => {
    const [type, name] = args
    
    const generator = generatorRegistry.get(type)
    if (!generator) {
      console.error(`❌ Unknown generator type: ${type}`)
      console.log('\nAvailable generators:')
      for (const gen of generatorRegistry.getAll()) {
        console.log(`  ${gen.name.padEnd(12)} ${gen.description}`)
      }
      return
    }

    const generatorContext: GeneratorContext = {
      workingDir: context.workingDir,
      config: context.config,
      logger: context.logger,
      utils: context.utils
    }

    const generatorOptions: GeneratorOptions = {
      name,
      path: options.path,
      template: options.template,
      force: options.force,
      dryRun: options['dry-run']
    }

    try {
      await generator.generate(generatorContext, generatorOptions)
      
      if (!options['dry-run']) {
        console.log(`✅ Successfully generated ${type}: ${name}`)
      }
    } catch (error) {
      console.error(`❌ Failed to generate ${type}:`, error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}