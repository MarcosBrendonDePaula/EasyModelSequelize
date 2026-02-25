import type { CliCommand } from "../../plugins/types"
import { generatorRegistry } from "./index"
import type { GeneratorContext, GeneratorOptions } from "./types"
import { promptSystem } from "./prompts"

export const interactiveGenerateCommand: CliCommand = {
  name: 'generate:interactive',
  description: 'Generate code interactively with prompts',
  usage: 'flux generate:interactive',
  aliases: ['gi', 'gen:i'],
  category: 'Development',
  examples: [
    'flux generate:interactive',
    'flux gi'
  ],
  handler: async (args, options, context) => {
    console.log('🎯 FluxStack Interactive Code Generator\n')
    
    // Select generator type
    const generators = generatorRegistry.getAll()
    const generatorChoices = generators.map(gen => ({
      name: `${gen.name} - ${gen.description}`,
      value: gen.name
    }))
    
    const selectedType = await promptSystem.select(
      'What would you like to generate?',
      generatorChoices
    )
    
    const generator = generatorRegistry.get(selectedType)
    if (!generator) {
      console.error(`❌ Generator not found: ${selectedType}`)
      return
    }
    
    // Get name
    const name = await promptSystem.input(
      `Enter the ${selectedType} name:`,
      undefined,
      (value) => {
        if (!value.trim()) {
          return 'Name is required'
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
          return 'Name must start with a letter and contain only letters, numbers, hyphens, and underscores'
        }
        return true
      }
    )
    
    // Get template variant (if applicable)
    let template: string | undefined
    if (selectedType === 'controller') {
      template = await promptSystem.select(
        'Choose controller template:',
        [
          { name: 'CRUD - Full CRUD operations with validation', value: 'crud' },
          { name: 'Minimal - Basic structure only', value: 'minimal' }
        ]
      )
    } else if (selectedType === 'component') {
      template = await promptSystem.select(
        'Choose component template:',
        [
          { name: 'Basic - Simple component', value: 'basic' },
          { name: 'Functional - Component with hooks', value: 'functional' },
          { name: 'Page - Page component with layout', value: 'page' },
          { name: 'Form - Form component with validation', value: 'form' },
          { name: 'Full - Complete with tests and stories', value: 'full' }
        ]
      )
    } else if (selectedType === 'service') {
      template = await promptSystem.select(
        'Choose service template:',
        [
          { name: 'CRUD - Full service with repository', value: 'crud' },
          { name: 'Repository - Service with repository pattern', value: 'repository' },
          { name: 'Minimal - Basic structure only', value: 'minimal' }
        ]
      )
    } else if (selectedType === 'route') {
      template = await promptSystem.select(
        'Choose route template:',
        [
          { name: 'CRUD - Full REST API routes', value: 'crud' },
          { name: 'Auth - Authentication routes', value: 'auth' },
          { name: 'Minimal - Basic routes only', value: 'minimal' }
        ]
      )
    }
    
    // Get custom path (optional)
    const useCustomPath = await promptSystem.confirm(
      'Do you want to specify a custom path?',
      false
    )
    
    let customPath: string | undefined
    if (useCustomPath) {
      customPath = await promptSystem.input(
        'Enter custom path (relative to project root):'
      )
    }
    
    // Confirm overwrite if files exist
    const force = await promptSystem.confirm(
      'Overwrite existing files if they exist?',
      false
    )
    
    // Show dry run first
    console.log('\n📋 Preview of files to be generated:\n')
    
    const generatorContext: GeneratorContext = {
      workingDir: context.workingDir,
      config: context.config,
      logger: context.logger,
      utils: context.utils
    }

    const generatorOptions: GeneratorOptions = {
      name,
      path: customPath,
      template,
      force,
      dryRun: true
    }

    try {
      await generator.generate(generatorContext, generatorOptions)
      
      const proceed = await promptSystem.confirm(
        '\nProceed with generation?',
        true
      )
      
      if (!proceed) {
        console.log('❌ Generation cancelled')
        return
      }
      
      // Generate for real
      generatorOptions.dryRun = false
      await generator.generate(generatorContext, generatorOptions)
      
      console.log(`\n✅ Successfully generated ${selectedType}: ${name}`)
      
      // Ask if user wants to generate related files
      await suggestRelatedGenerations(selectedType, name, generatorContext)
      
    } catch (error) {
      console.error(`❌ Failed to generate ${selectedType}:`, error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}

async function suggestRelatedGenerations(
  generatedType: string, 
  name: string, 
  context: GeneratorContext
): Promise<void> {
  const suggestions: Array<{ type: string; description: string }> = []
  
  switch (generatedType) {
    case 'controller':
      suggestions.push(
        { type: 'service', description: `Generate ${name} service for business logic` },
        { type: 'route', description: `Generate ${name} routes to expose the controller` }
      )
      break
    case 'service':
      suggestions.push(
        { type: 'controller', description: `Generate ${name} controller to use this service` }
      )
      break
    case 'route':
      suggestions.push(
        { type: 'controller', description: `Generate ${name} controller for route handlers` }
      )
      break
    case 'component':
      // No automatic suggestions for components
      break
  }
  
  if (suggestions.length === 0) {
    return
  }
  
  console.log('\n💡 Suggested next steps:')
  for (const suggestion of suggestions) {
    console.log(`   • ${suggestion.description}`)
  }
  
  const generateRelated = await promptSystem.confirm(
    '\nWould you like to generate related files now?',
    false
  )
  
  if (!generateRelated) {
    return
  }
  
  for (const suggestion of suggestions) {
    const shouldGenerate = await promptSystem.confirm(
      `Generate ${suggestion.type} for ${name}?`,
      true
    )
    
    if (shouldGenerate) {
      const generator = generatorRegistry.get(suggestion.type)
      if (generator) {
        try {
          await generator.generate(context, {
            name,
            force: false,
            dryRun: false
          })
          console.log(`✅ Generated ${suggestion.type}: ${name}`)
        } catch (error) {
          console.error(`❌ Failed to generate ${suggestion.type}:`, error instanceof Error ? error.message : String(error))
        }
      }
    }
  }
}