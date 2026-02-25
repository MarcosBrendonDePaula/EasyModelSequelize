import type { Generator } from "./index"
import type { GeneratorContext, GeneratorOptions, Template } from "./types"
import { templateEngine } from "./template-engine"

export class ServiceGenerator implements Generator {
  name = 'service'
  description = 'Generate a new service with business logic'

  async generate(context: GeneratorContext, options: GeneratorOptions): Promise<void> {
    const template = this.getTemplate(options.template)
    
    if (template.hooks?.beforeGenerate) {
      await template.hooks.beforeGenerate(context, options)
    }

    const files = await templateEngine.processTemplate(template, context, options)
    
    if (options.dryRun) {
      console.log(`\n📋 Would generate service '${options.name}':\n`)
      for (const file of files) {
        console.log(`${file.action === 'create' ? '📄' : '✏️'} ${file.path}`)
      }
      return
    }

    await templateEngine.generateFiles(files, options.dryRun)
    
    if (template.hooks?.afterGenerate) {
      const filePaths = files.map(f => f.path)
      await template.hooks.afterGenerate(context, options, filePaths)
    }

    console.log(`\n✅ Generated service '${options.name}' with ${files.length} files`)
  }

  private getTemplate(templateName?: string): Template {
    switch (templateName) {
      case 'minimal':
        return this.getMinimalTemplate()
      case 'repository':
        return this.getRepositoryTemplate()
      case 'crud':
      default:
        return this.getCrudTemplate()
    }
  }

  private getCrudTemplate(): Template {
    return {
      name: 'crud-service',
      description: 'Full CRUD service with validation and error handling',
      files: [
        {
          path: 'app/server/services/{{kebabName}}.service.ts',
          content: `import { {{pascalName}}, Create{{pascalName}}, Update{{pascalName}} } from '../schemas/{{kebabName}}.schema'
import { {{pascalName}}Repository } from '../repositories/{{kebabName}}.repository'
import { ValidationError, NotFoundError } from '@core/utils/errors'
import { logger } from '@core/utils/logger'

export class {{pascalName}}Service {
  private repository: {{pascalName}}Repository

  constructor() {
    this.repository = new {{pascalName}}Repository()
  }

  async findAll(): Promise<{{pascalName}}[]> {
    try {
      logger.debug('Fetching all {{camelName}}s')
      const {{camelName}}s = await this.repository.findAll()
      logger.info(\`Found \${{{camelName}}s.length} {{camelName}}s\`)
      return {{camelName}}s
    } catch (error) {
      logger.error('Failed to fetch {{camelName}}s', { error })
      throw new Error('Failed to fetch {{camelName}}s')
    }
  }

  async findById(id: string): Promise<{{pascalName}} | null> {
    try {
      this.validateId(id)
      
      logger.debug(\`Fetching {{camelName}} with id: \${id}\`)
      const {{camelName}} = await this.repository.findById(id)
      
      if (!{{camelName}}) {
        logger.warn(\`{{pascalName}} not found with id: \${id}\`)
        return null
      }
      
      logger.info(\`Found {{camelName}}: \${{{camelName}}.name}\`)
      return {{camelName}}
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      logger.error(\`Failed to fetch {{camelName}} with id: \${id}\`, { error })
      throw new Error('Failed to fetch {{camelName}}')
    }
  }

  async create(data: Create{{pascalName}}): Promise<{{pascalName}}> {
    try {
      this.validateCreateData(data)
      
      logger.debug('Creating new {{camelName}}', { data })
      
      // Check for duplicates
      const existing = await this.repository.findByName(data.name)
      if (existing) {
        throw new ValidationError('{{pascalName}} with this name already exists')
      }
      
      const {{camelName}} = await this.repository.create({
        ...data,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      logger.info(\`Created {{camelName}}: \${{{camelName}}.name}\`, { id: {{camelName}}.id })
      return {{camelName}}
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      logger.error('Failed to create {{camelName}}', { error, data })
      throw new Error('Failed to create {{camelName}}')
    }
  }

  async update(id: string, data: Update{{pascalName}}): Promise<{{pascalName}} | null> {
    try {
      this.validateId(id)
      this.validateUpdateData(data)
      
      logger.debug(\`Updating {{camelName}} with id: \${id}\`, { data })
      
      const existing = await this.repository.findById(id)
      if (!existing) {
        logger.warn(\`{{pascalName}} not found for update with id: \${id}\`)
        return null
      }
      
      // Check for name conflicts if name is being updated
      if (data.name && data.name !== existing.name) {
        const nameConflict = await this.repository.findByName(data.name)
        if (nameConflict && nameConflict.id !== id) {
          throw new ValidationError('{{pascalName}} with this name already exists')
        }
      }
      
      const updated{{pascalName}} = await this.repository.update(id, {
        ...data,
        updatedAt: new Date()
      })
      
      logger.info(\`Updated {{camelName}}: \${updated{{pascalName}}?.name}\`, { id })
      return updated{{pascalName}}
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      logger.error(\`Failed to update {{camelName}} with id: \${id}\`, { error, data })
      throw new Error('Failed to update {{camelName}}')
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      this.validateId(id)
      
      logger.debug(\`Deleting {{camelName}} with id: \${id}\`)
      
      const existing = await this.repository.findById(id)
      if (!existing) {
        logger.warn(\`{{pascalName}} not found for deletion with id: \${id}\`)
        return false
      }
      
      const deleted = await this.repository.delete(id)
      
      if (deleted) {
        logger.info(\`Deleted {{camelName}}: \${existing.name}\`, { id })
      }
      
      return deleted
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      logger.error(\`Failed to delete {{camelName}} with id: \${id}\`, { error })
      throw new Error('Failed to delete {{camelName}}')
    }
  }

  async search(query: string): Promise<{{pascalName}}[]> {
    try {
      if (!query || query.trim().length === 0) {
        throw new ValidationError('Search query cannot be empty')
      }
      
      logger.debug(\`Searching {{camelName}}s with query: \${query}\`)
      const results = await this.repository.search(query.trim())
      logger.info(\`Found \${results.length} {{camelName}}s matching query: \${query}\`)
      
      return results
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      logger.error(\`Failed to search {{camelName}}s with query: \${query}\`, { error })
      throw new Error('Failed to search {{camelName}}s')
    }
  }

  private validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new ValidationError('Invalid ID provided')
    }
  }

  private validateCreateData(data: Create{{pascalName}}): void {
    if (!data) {
      throw new ValidationError('{{pascalName}} data is required')
    }
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new ValidationError('{{pascalName}} name is required')
    }
    
    if (data.name.length > 100) {
      throw new ValidationError('{{pascalName}} name must be less than 100 characters')
    }
    
    if (data.description && data.description.length > 500) {
      throw new ValidationError('{{pascalName}} description must be less than 500 characters')
    }
  }

  private validateUpdateData(data: Update{{pascalName}}): void {
    if (!data || Object.keys(data).length === 0) {
      throw new ValidationError('Update data is required')
    }
    
    if (data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        throw new ValidationError('{{pascalName}} name cannot be empty')
      }
      
      if (data.name.length > 100) {
        throw new ValidationError('{{pascalName}} name must be less than 100 characters')
      }
    }
    
    if (data.description !== undefined && data.description && data.description.length > 500) {
      throw new ValidationError('{{pascalName}} description must be less than 500 characters')
    }
  }

  private generateId(): string {
    return \`{{kebabName}}_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`
  }
}
`
        },
        {
          path: 'app/server/repositories/{{kebabName}}.repository.ts',
          content: `import { {{pascalName}} } from '../schemas/{{kebabName}}.schema'

// In-memory storage for demo purposes
// Replace with your preferred database implementation
let {{camelName}}Store: {{pascalName}}[] = []

export class {{pascalName}}Repository {
  async findAll(): Promise<{{pascalName}}[]> {
    return [...{{camelName}}Store]
  }

  async findById(id: string): Promise<{{pascalName}} | null> {
    const {{camelName}} = {{camelName}}Store.find(item => item.id === id)
    return {{camelName}} || null
  }

  async findByName(name: string): Promise<{{pascalName}} | null> {
    const {{camelName}} = {{camelName}}Store.find(item => 
      item.name.toLowerCase() === name.toLowerCase()
    )
    return {{camelName}} || null
  }

  async create(data: {{pascalName}}): Promise<{{pascalName}}> {
    {{camelName}}Store.push(data)
    return data
  }

  async update(id: string, data: Partial<{{pascalName}}>): Promise<{{pascalName}} | null> {
    const index = {{camelName}}Store.findIndex(item => item.id === id)
    
    if (index === -1) {
      return null
    }
    
    {{camelName}}Store[index] = { ...{{camelName}}Store[index], ...data }
    return {{camelName}}Store[index]
  }

  async delete(id: string): Promise<boolean> {
    const index = {{camelName}}Store.findIndex(item => item.id === id)
    
    if (index === -1) {
      return false
    }
    
    {{camelName}}Store.splice(index, 1)
    return true
  }

  async search(query: string): Promise<{{pascalName}}[]> {
    const lowerQuery = query.toLowerCase()
    return {{camelName}}Store.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      (item.description && item.description.toLowerCase().includes(lowerQuery))
    )
  }

  async count(): Promise<number> {
    return {{camelName}}Store.length
  }

  async clear(): Promise<void> {
    {{camelName}}Store = []
  }
}
`
        }
      ],
      hooks: {
        afterGenerate: async (context, options, files) => {
          context.logger.info(`Generated service files:`)
          files.forEach(file => {
            context.logger.info(`  - ${file}`)
          })
          context.logger.info(`\nNext steps:`)
          context.logger.info(`1. Replace the in-memory repository with your database implementation`)
          context.logger.info(`2. Add any additional business logic methods`)
          context.logger.info(`3. Configure proper error handling and logging`)
        }
      }
    }
  }

  private getMinimalTemplate(): Template {
    return {
      name: 'minimal-service',
      description: 'Minimal service with basic structure',
      files: [
        {
          path: 'app/server/services/{{kebabName}}.service.ts',
          content: `export class {{pascalName}}Service {
  async findAll() {
    // TODO: Implement find all logic
    return []
  }

  async findById(id: string) {
    // TODO: Implement find by id logic
    return null
  }

  async create(data: any) {
    // TODO: Implement create logic
    return data
  }

  async update(id: string, data: any) {
    // TODO: Implement update logic
    return { id, ...data }
  }

  async delete(id: string) {
    // TODO: Implement delete logic
    return true
  }
}
`
        }
      ]
    }
  }

  private getRepositoryTemplate(): Template {
    return {
      name: 'repository-service',
      description: 'Service with repository pattern',
      files: [
        {
          path: 'app/server/services/{{kebabName}}.service.ts',
          content: `import { {{pascalName}}Repository } from '../repositories/{{kebabName}}.repository'

export class {{pascalName}}Service {
  private repository: {{pascalName}}Repository

  constructor() {
    this.repository = new {{pascalName}}Repository()
  }

  async findAll() {
    return await this.repository.findAll()
  }

  async findById(id: string) {
    return await this.repository.findById(id)
  }

  async create(data: any) {
    // Add business logic here
    return await this.repository.create(data)
  }

  async update(id: string, data: any) {
    // Add business logic here
    return await this.repository.update(id, data)
  }

  async delete(id: string) {
    return await this.repository.delete(id)
  }
}
`
        },
        {
          path: 'app/server/repositories/{{kebabName}}.repository.ts',
          content: `export class {{pascalName}}Repository {
  async findAll() {
    // TODO: Implement database query
    return []
  }

  async findById(id: string) {
    // TODO: Implement database query
    return null
  }

  async create(data: any) {
    // TODO: Implement database insert
    return data
  }

  async update(id: string, data: any) {
    // TODO: Implement database update
    return { id, ...data }
  }

  async delete(id: string) {
    // TODO: Implement database delete
    return true
  }
}
`
        }
      ]
    }
  }
}