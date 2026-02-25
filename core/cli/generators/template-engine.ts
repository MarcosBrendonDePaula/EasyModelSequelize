import type { GeneratorContext, GeneratorOptions, Template, TemplateFile, GeneratedFile, TemplateProcessor } from "./types"
import { join, dirname } from "path"
import { mkdir, writeFile, readFile, stat } from "fs/promises"
import { existsSync } from "fs"

export class TemplateEngine {
  private processor: TemplateProcessor

  constructor() {
    this.processor = this.createTemplateProcessor()
  }

  async processTemplate(
    template: Template,
    context: GeneratorContext,
    options: GeneratorOptions
  ): Promise<GeneratedFile[]> {
    const variables = await this.collectVariables(template, context, options)
    const files: GeneratedFile[] = []

    for (const templateFile of template.files) {
      // Check condition if specified
      if (templateFile.condition && !templateFile.condition(variables)) {
        continue
      }

      const processedPath = this.processor(templateFile.path, variables)
      const processedContent = this.processor(templateFile.content, variables)
      const fullPath = join(context.workingDir, processedPath)

      const exists = existsSync(fullPath)
      let action: 'create' | 'overwrite' | 'skip' = 'create'

      if (exists) {
        if (options.force) {
          action = 'overwrite'
        } else {
          action = 'skip'
          context.logger.warn(`File already exists: ${processedPath}`)
        }
      }

      files.push({
        path: fullPath,
        content: processedContent,
        exists,
        action
      })
    }

    return files
  }

  async generateFiles(files: GeneratedFile[], dryRun: boolean = false): Promise<void> {
    for (const file of files) {
      if (file.action === 'skip') {
        continue
      }

      if (dryRun) {
        console.log(`${file.action === 'create' ? '📄' : '✏️'} ${file.path}`)
        continue
      }

      // Ensure directory exists
      const dir = dirname(file.path)
      await mkdir(dir, { recursive: true })

      // Write file
      await writeFile(file.path, file.content, 'utf-8')
    }
  }

  private async collectVariables(
    template: Template,
    context: GeneratorContext,
    options: GeneratorOptions
  ): Promise<Record<string, any>> {
    const variables: Record<string, any> = {
      // Spread options first so built-in variables take precedence
      ...options,
      // Built-in variables (override any same-named keys from options)
      name: options.name,
      Name: this.capitalize(options.name),
      NAME: options.name.toUpperCase(),
      kebabName: this.toKebabCase(options.name),
      camelName: this.toCamelCase(options.name),
      pascalName: this.toPascalCase(options.name),
      snakeName: this.toSnakeCase(options.name),
      constantName: this.toConstantCase(options.name), // SCREAMING_SNAKE_CASE
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString(),
      year: new Date().getFullYear(),
      author: 'FluxStack Developer',
      projectName: context.config.app?.name || 'fluxstack-app'
    }

    // Process template-specific variables
    if (template.variables) {
      for (const variable of template.variables) {
        if (!(variable.name in variables)) {
          if (variable.required && !variable.default) {
            // In a real implementation, you'd use a proper prompt library
            // For now, we'll use the default or throw an error
            if (variable.default !== undefined) {
              variables[variable.name] = variable.default
            } else {
              throw new Error(`Required variable '${variable.name}' not provided`)
            }
          } else {
            variables[variable.name] = variable.default
          }
        }
      }
    }

    return variables
  }

  private createTemplateProcessor(): TemplateProcessor {
    return (template: string, variables: Record<string, any>) => {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? String(variables[key]) : match
      })
    }
  }

  // String transformation utilities
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
  }

  private toPascalCase(str: string): string {
    return this.capitalize(this.toCamelCase(str))
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase()
  }

  private toConstantCase(str: string): string {
    return this.toSnakeCase(str).toUpperCase()
  }
}

export const templateEngine = new TemplateEngine()