import type { Generator } from "./index"
import type { GeneratorContext, GeneratorOptions, Template } from "./types"
import { templateEngine } from "./template-engine"

export class RouteGenerator implements Generator {
  name = 'route'
  description = 'Generate API routes with controllers'

  async generate(context: GeneratorContext, options: GeneratorOptions): Promise<void> {
    const template = this.getTemplate(options.template)
    
    if (template.hooks?.beforeGenerate) {
      await template.hooks.beforeGenerate(context, options)
    }

    const files = await templateEngine.processTemplate(template, context, options)
    
    if (options.dryRun) {
      console.log(`\n📋 Would generate route '${options.name}':\n`)
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

    console.log(`\n✅ Generated route '${options.name}' with ${files.length} files`)
  }

  private getTemplate(templateName?: string): Template {
    switch (templateName) {
      case 'minimal':
        return this.getMinimalTemplate()
      case 'auth':
        return this.getAuthTemplate()
      case 'crud':
      default:
        return this.getCrudTemplate()
    }
  }

  private getCrudTemplate(): Template {
    return {
      name: 'crud-route',
      description: 'Full CRUD API routes with validation',
      files: [
        {
          path: 'app/server/routes/{{kebabName}}.routes.ts',
          content: `import { Elysia, t } from 'elysia'
import { {{pascalName}}Controller } from '../controllers/{{kebabName}}.controller'
import { errorHandler } from '@core/utils/errors/middleware'
import { logger } from '@core/utils/logger'

const controller = new {{pascalName}}Controller()

export const {{camelName}}Routes = new Elysia({ prefix: '/api/{{kebabName}}s' })
  .use(errorHandler)
  .onBeforeHandle(({ request }) => {
    const url = (() => {
      try {
        return new URL(request.url)
      } catch {
        const host = request.headers.get('host') || 'localhost'
        return new URL(request.url, \`http://\${host}\`)
      }
    })()
    logger.request(request.method, url.pathname)
  })
  .get('/', async () => {
    return await controller.getAll()
  }, {
    detail: {
      tags: ['{{pascalName}}'],
      summary: 'Get all {{camelName}}s',
      description: 'Retrieve a list of all {{camelName}}s'
    }
  })
  .get('/:id', async ({ params }) => {
    return await controller.getById({ params })
  }, {
    params: t.Object({
      id: t.String({
        description: '{{pascalName}} ID',
        example: '{{kebabName}}_123'
      })
    }),
    detail: {
      tags: ['{{pascalName}}'],
      summary: 'Get {{camelName}} by ID',
      description: 'Retrieve a specific {{camelName}} by its ID'
    }
  })
  .post('/', async ({ body }) => {
    return await controller.create({ body })
  }, {
    body: t.Object({
      name: t.String({
        minLength: 1,
        maxLength: 100,
        description: '{{pascalName}} name',
        example: 'Sample {{pascalName}}'
      }),
      description: t.Optional(t.String({
        maxLength: 500,
        description: '{{pascalName}} description',
        example: 'This is a sample {{camelName}} description'
      }))
    }),
    detail: {
      tags: ['{{pascalName}}'],
      summary: 'Create new {{camelName}}',
      description: 'Create a new {{camelName}} with the provided data'
    }
  })
  .put('/:id', async ({ params, body }) => {
    return await controller.update({ params, body })
  }, {
    params: t.Object({
      id: t.String({
        description: '{{pascalName}} ID',
        example: '{{kebabName}}_123'
      })
    }),
    body: t.Partial(t.Object({
      name: t.String({
        minLength: 1,
        maxLength: 100,
        description: '{{pascalName}} name',
        example: 'Updated {{pascalName}}'
      }),
      description: t.String({
        maxLength: 500,
        description: '{{pascalName}} description',
        example: 'Updated description'
      })
    })),
    detail: {
      tags: ['{{pascalName}}'],
      summary: 'Update {{camelName}}',
      description: 'Update an existing {{camelName}} with new data'
    }
  })
  .delete('/:id', async ({ params }) => {
    return await controller.delete({ params })
  }, {
    params: t.Object({
      id: t.String({
        description: '{{pascalName}} ID',
        example: '{{kebabName}}_123'
      })
    }),
    detail: {
      tags: ['{{pascalName}}'],
      summary: 'Delete {{camelName}}',
      description: 'Delete a {{camelName}} by its ID'
    }
  })
  .get('/search', async ({ query }) => {
    // Assuming controller has a search method
    return await (controller as any).search({ query })
  }, {
    query: t.Object({
      q: t.String({
        minLength: 1,
        description: 'Search query',
        example: 'search term'
      }),
      limit: t.Optional(t.Number({
        minimum: 1,
        maximum: 100,
        default: 10,
        description: 'Maximum number of results'
      })),
      offset: t.Optional(t.Number({
        minimum: 0,
        default: 0,
        description: 'Number of results to skip'
      }))
    }),
    detail: {
      tags: ['{{pascalName}}'],
      summary: 'Search {{camelName}}s',
      description: 'Search for {{camelName}}s using a query string'
    }
  })
`
        },
        {
          path: 'app/server/routes/index.ts',
          content: `import { Elysia } from 'elysia'
import { {{camelName}}Routes } from './{{kebabName}}.routes'

// Import other route modules here
// import { userRoutes } from './user.routes'
// import { authRoutes } from './auth.routes'

export const apiRoutes = new Elysia({ prefix: '/api' })
  .use({{camelName}}Routes)
  // Add other routes here
  // .use(userRoutes)
  // .use(authRoutes)
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '{{projectName}}'
  }), {
    detail: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Check if the API is running'
    }
  })

export default apiRoutes
`,
          condition: (variables) => !variables.skipIndex
        }
      ],
      hooks: {
        afterGenerate: async (context, options, files) => {
          context.logger.info(`Generated route files:`)
          files.forEach(file => {
            context.logger.info(`  - ${file}`)
          })
          context.logger.info(`\nNext steps:`)
          context.logger.info(`1. Generate the corresponding controller: flux generate controller ${options.name}`)
          context.logger.info(`2. Import and use the routes in your main server file`)
          context.logger.info(`3. Test the API endpoints using the Swagger documentation`)
          context.logger.info(`\nAPI endpoints created:`)
          context.logger.info(`  GET    /api/${options.name}s`)
          context.logger.info(`  GET    /api/${options.name}s/:id`)
          context.logger.info(`  POST   /api/${options.name}s`)
          context.logger.info(`  PUT    /api/${options.name}s/:id`)
          context.logger.info(`  DELETE /api/${options.name}s/:id`)
          context.logger.info(`  GET    /api/${options.name}s/search`)
        }
      }
    }
  }

  private getMinimalTemplate(): Template {
    return {
      name: 'minimal-route',
      description: 'Minimal API route with basic endpoints',
      files: [
        {
          path: 'app/server/routes/{{kebabName}}.routes.ts',
          content: `import { Elysia } from 'elysia'

export const {{camelName}}Routes = new Elysia({ prefix: '/api/{{kebabName}}s' })
  .get('/', () => {
    // TODO: Implement list logic
    return {
      success: true,
      data: [],
      message: 'List {{camelName}}s'
    }
  })
  .get('/:id', ({ params }) => {
    // TODO: Implement get by id logic
    return {
      success: true,
      data: { id: params.id },
      message: 'Get {{camelName}}'
    }
  })
  .post('/', ({ body }) => {
    // TODO: Implement create logic
    return {
      success: true,
      data: body,
      message: '{{pascalName}} created'
    }
  })
  .put('/:id', ({ params, body }) => {
    // TODO: Implement update logic
    return {
      success: true,
      data: { id: params.id, ...body },
      message: '{{pascalName}} updated'
    }
  })
  .delete('/:id', ({ params }) => {
    // TODO: Implement delete logic
    return {
      success: true,
      message: '{{pascalName}} deleted'
    }
  })
`
        }
      ]
    }
  }

  private getAuthTemplate(): Template {
    return {
      name: 'auth-route',
      description: 'Authentication routes with JWT',
      files: [
        {
          path: 'app/server/routes/auth.routes.ts',
          content: `import { Elysia, t } from 'elysia'
import { AuthController } from '../controllers/auth.controller'
import { errorHandler } from '@core/utils/errors/middleware'
import { authMiddleware } from '../middleware/auth.middleware'
import { logger } from '@core/utils/logger'

const controller = new AuthController()

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(errorHandler)
  .onBeforeHandle(({ request }) => {
    const url = (() => {
      try {
        return new URL(request.url)
      } catch {
        const host = request.headers.get('host') || 'localhost'
        return new URL(request.url, \`http://\${host}\`)
      }
    })()
    logger.request(request.method, url.pathname)
  })
  .post('/register', async ({ body }) => {
    return await controller.register({ body })
  }, {
    body: t.Object({
      email: t.String({
        format: 'email',
        description: 'User email address',
        example: 'user@example.com'
      }),
      password: t.String({
        minLength: 8,
        description: 'User password (minimum 8 characters)',
        example: 'securePassword123'
      }),
      name: t.String({
        minLength: 1,
        maxLength: 100,
        description: 'User full name',
        example: 'John Doe'
      })
    }),
    detail: {
      tags: ['Authentication'],
      summary: 'Register new user',
      description: 'Create a new user account'
    }
  })
  .post('/login', async ({ body }) => {
    return await controller.login({ body })
  }, {
    body: t.Object({
      email: t.String({
        format: 'email',
        description: 'User email address',
        example: 'user@example.com'
      }),
      password: t.String({
        minLength: 1,
        description: 'User password',
        example: 'securePassword123'
      })
    }),
    detail: {
      tags: ['Authentication'],
      summary: 'User login',
      description: 'Authenticate user and return JWT token'
    }
  })
  .post('/logout', async ({ headers }) => {
    return await controller.logout({ headers })
  }, {
    beforeHandle: authMiddleware,
    detail: {
      tags: ['Authentication'],
      summary: 'User logout',
      description: 'Logout user and invalidate token'
    }
  })
  .get('/me', async ({ headers }) => {
    return await controller.getProfile({ headers })
  }, {
    beforeHandle: authMiddleware,
    detail: {
      tags: ['Authentication'],
      summary: 'Get user profile',
      description: 'Get current user profile information'
    }
  })
  .put('/me', async ({ headers, body }) => {
    return await controller.updateProfile({ headers, body })
  }, {
    beforeHandle: authMiddleware,
    body: t.Partial(t.Object({
      name: t.String({
        minLength: 1,
        maxLength: 100,
        description: 'User full name'
      }),
      email: t.String({
        format: 'email',
        description: 'User email address'
      })
    })),
    detail: {
      tags: ['Authentication'],
      summary: 'Update user profile',
      description: 'Update current user profile information'
    }
  })
  .post('/refresh', async ({ body }) => {
    return await controller.refreshToken({ body })
  }, {
    body: t.Object({
      refreshToken: t.String({
        description: 'Refresh token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      })
    }),
    detail: {
      tags: ['Authentication'],
      summary: 'Refresh access token',
      description: 'Get new access token using refresh token'
    }
  })
  .post('/forgot-password', async ({ body }) => {
    return await controller.forgotPassword({ body })
  }, {
    body: t.Object({
      email: t.String({
        format: 'email',
        description: 'User email address',
        example: 'user@example.com'
      })
    }),
    detail: {
      tags: ['Authentication'],
      summary: 'Forgot password',
      description: 'Send password reset email'
    }
  })
  .post('/reset-password', async ({ body }) => {
    return await controller.resetPassword({ body })
  }, {
    body: t.Object({
      token: t.String({
        description: 'Password reset token',
        example: 'reset-token-123'
      }),
      password: t.String({
        minLength: 8,
        description: 'New password (minimum 8 characters)',
        example: 'newSecurePassword123'
      })
    }),
    detail: {
      tags: ['Authentication'],
      summary: 'Reset password',
      description: 'Reset user password using reset token'
    }
  })
`
        },
        {
          path: 'app/server/middleware/auth.middleware.ts',
          content: `import { Context } from 'elysia'
import { UnauthorizedError } from '@core/utils/errors'
import { logger } from '@core/utils/logger'

// JWT verification function (implement based on your JWT library)
async function verifyJWT(token: string): Promise<any> {
  // TODO: Implement JWT verification
  // This is a placeholder - replace with actual JWT verification
  if (!token || token === 'invalid') {
    throw new Error('Invalid token')
  }
  
  return {
    userId: 'user_123',
    email: 'user@example.com',
    name: 'John Doe'
  }
}

export async function authMiddleware(context: Context) {
  try {
    const authorization = context.headers.authorization
    
    if (!authorization) {
      throw new UnauthorizedError('Authorization header is required')
    }
    
    const token = authorization.replace('Bearer ', '')
    
    if (!token) {
      throw new UnauthorizedError('Bearer token is required')
    }
    
    const user = await verifyJWT(token)
    
    // Add user to context for use in route handlers
    ;(context as any).user = user
    
    logger.debug('User authenticated', { userId: user.userId })
    
  } catch (error) {
    logger.warn('Authentication failed', { error: error instanceof Error ? error.message : 'Unknown error' })
    
    if (error instanceof UnauthorizedError) {
      throw error
    }
    
    throw new UnauthorizedError('Invalid or expired token')
  }
}
`
        }
      ]
    }
  }
}