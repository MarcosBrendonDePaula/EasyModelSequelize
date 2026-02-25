import type { Generator } from "./index"
import type { GeneratorContext, GeneratorOptions, Template } from "./types"
import { templateEngine } from "./template-engine"

export class ControllerGenerator implements Generator {
  name = 'controller'
  description = 'Generate a new controller with CRUD operations'

  async generate(context: GeneratorContext, options: GeneratorOptions): Promise<void> {
    const template = this.getTemplate(options.template)
    
    // Execute before hook if present
    if (template.hooks?.beforeGenerate) {
      await template.hooks.beforeGenerate(context, options)
    }

    const files = await templateEngine.processTemplate(template, context, options)
    
    if (options.dryRun) {
      console.log(`\n📋 Would generate controller '${options.name}':\n`)
      for (const file of files) {
        console.log(`${file.action === 'create' ? '📄' : '✏️'} ${file.path}`)
      }
      return
    }

    await templateEngine.generateFiles(files, options.dryRun)
    
    // Execute after hook if present
    if (template.hooks?.afterGenerate) {
      const filePaths = files.map(f => f.path)
      await template.hooks.afterGenerate(context, options, filePaths)
    }

    console.log(`\n✅ Generated controller '${options.name}' with ${files.length} files`)
  }

  private getTemplate(templateName?: string): Template {
    switch (templateName) {
      case 'minimal':
        return this.getMinimalTemplate()
      case 'crud':
      default:
        return this.getCrudTemplate()
    }
  }

  private getCrudTemplate(): Template {
    return {
      name: 'crud-controller',
      description: 'Full CRUD controller with validation',
      files: [
        {
          path: 'app/server/controllers/{{kebabName}}.controller.ts',
          content: `import { Elysia, t } from 'elysia'
import { {{pascalName}}Service } from '../services/{{kebabName}}.service'
import { {{pascalName}}Schema, Create{{pascalName}}Schema, Update{{pascalName}}Schema } from '../schemas/{{kebabName}}.schema'
import { NotFoundError, ValidationError } from '@core/utils/errors'

export class {{pascalName}}Controller {
  private service: {{pascalName}}Service

  constructor() {
    this.service = new {{pascalName}}Service()
  }

  routes() {
    return new Elysia({ prefix: '/{{kebabName}}s' })
      .get('/', this.getAll.bind(this))
      .get('/:id', this.getById.bind(this), {
        params: t.Object({
          id: t.String()
        })
      })
      .post('/', this.create.bind(this), {
        body: Create{{pascalName}}Schema
      })
      .put('/:id', this.update.bind(this), {
        params: t.Object({
          id: t.String()
        }),
        body: Update{{pascalName}}Schema
      })
      .delete('/:id', this.delete.bind(this), {
        params: t.Object({
          id: t.String()
        })
      })
  }

  async getAll() {
    try {
      const {{camelName}}s = await this.service.findAll()
      return {
        success: true,
        data: {{camelName}}s,
        count: {{camelName}}s.length
      }
    } catch (error) {
      throw new Error(\`Failed to fetch {{camelName}}s: \${error instanceof Error ? error.message : 'Unknown error'}\`)
    }
  }

  async getById({ params }: { params: { id: string } }) {
    try {
      const {{camelName}} = await this.service.findById(params.id)
      
      if (!{{camelName}}) {
        throw new NotFoundError('{{pascalName}} not found')
      }

      return {
        success: true,
        data: {{camelName}}
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      throw new Error(\`Failed to fetch {{camelName}}: \${error instanceof Error ? error.message : 'Unknown error'}\`)
    }
  }

  async create({ body }: { body: any }) {
    try {
      const {{camelName}} = await this.service.create(body)
      
      return {
        success: true,
        data: {{camelName}},
        message: '{{pascalName}} created successfully'
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new Error(\`Failed to create {{camelName}}: \${error instanceof Error ? error.message : 'Unknown error'}\`)
    }
  }

  async update({ params, body }: { params: { id: string }, body: any }) {
    try {
      const {{camelName}} = await this.service.update(params.id, body)
      
      if (!{{camelName}}) {
        throw new NotFoundError('{{pascalName}} not found')
      }

      return {
        success: true,
        data: {{camelName}},
        message: '{{pascalName}} updated successfully'
      }
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error
      }
      throw new Error(\`Failed to update {{camelName}}: \${error instanceof Error ? error.message : 'Unknown error'}\`)
    }
  }

  async delete({ params }: { params: { id: string } }) {
    try {
      const deleted = await this.service.delete(params.id)
      
      if (!deleted) {
        throw new NotFoundError('{{pascalName}} not found')
      }

      return {
        success: true,
        message: '{{pascalName}} deleted successfully'
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      throw new Error(\`Failed to delete {{camelName}}: \${error instanceof Error ? error.message : 'Unknown error'}\`)
    }
  }
}
`
        },
        {
          path: 'app/server/schemas/{{kebabName}}.schema.ts',
          content: `import { t } from 'elysia'

export const {{pascalName}}Schema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Optional(t.String()),
  createdAt: t.Date(),
  updatedAt: t.Date()
})

export const Create{{pascalName}}Schema = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 100,
    error: 'Name must be between 1 and 100 characters'
  }),
  description: t.Optional(t.String({
    maxLength: 500,
    error: 'Description must be less than 500 characters'
  }))
})

export const Update{{pascalName}}Schema = t.Partial(Create{{pascalName}}Schema)

export type {{pascalName}} = typeof {{pascalName}}Schema.static
export type Create{{pascalName}} = typeof Create{{pascalName}}Schema.static
export type Update{{pascalName}} = typeof Update{{pascalName}}Schema.static
`
        }
      ],
      hooks: {
        afterGenerate: async (context, options, files) => {
          context.logger.info(`Generated controller files:`)
          files.forEach(file => {
            context.logger.info(`  - ${file}`)
          })
          context.logger.info(`\nNext steps:`)
          context.logger.info(`1. Generate the corresponding service: flux generate service ${options.name}`)
          context.logger.info(`2. Add the controller to your routes in app/server/routes/`)
          context.logger.info(`3. Implement the business logic in the service`)
        }
      }
    }
  }

  private getMinimalTemplate(): Template {
    return {
      name: 'minimal-controller',
      description: 'Minimal controller with basic structure',
      files: [
        {
          path: 'app/server/controllers/{{kebabName}}.controller.ts',
          content: `import { Elysia } from 'elysia'

export class {{pascalName}}Controller {
  routes() {
    return new Elysia({ prefix: '/{{kebabName}}s' })
      .get('/', this.index.bind(this))
      .get('/:id', this.show.bind(this))
      .post('/', this.create.bind(this))
      .put('/:id', this.update.bind(this))
      .delete('/:id', this.destroy.bind(this))
  }

  async index() {
    // TODO: Implement list logic
    return {
      success: true,
      data: [],
      message: 'List {{camelName}}s'
    }
  }

  async show({ params }: { params: { id: string } }) {
    // TODO: Implement show logic
    return {
      success: true,
      data: { id: params.id },
      message: 'Show {{camelName}}'
    }
  }

  async create({ body }: { body: any }) {
    // TODO: Implement create logic
    return {
      success: true,
      data: body,
      message: '{{pascalName}} created'
    }
  }

  async update({ params, body }: { params: { id: string }, body: any }) {
    // TODO: Implement update logic
    return {
      success: true,
      data: { id: params.id, ...body },
      message: '{{pascalName}} updated'
    }
  }

  async destroy({ params }: { params: { id: string } }) {
    // TODO: Implement delete logic
    return {
      success: true,
      message: '{{pascalName}} deleted'
    }
  }
}
`
        }
      ]
    }
  }
}