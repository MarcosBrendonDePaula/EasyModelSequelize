import { swagger } from '@elysiajs/swagger'
import type { Plugin, PluginContext } from '@core/plugins/types'

export const swaggerPlugin: Plugin = {
  name: 'swagger',
  setup(context: PluginContext) {
    context.app.use(swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: 'FluxStack API',
          version: '1.7.4',
          description: 'Modern full-stack TypeScript framework with type-safe API endpoints'
        },
        tags: [
          { 
            name: 'Health', 
            description: 'Health check endpoints' 
          },
          { 
            name: 'Users', 
            description: 'User management endpoints' 
          }
        ],
        servers: [
          {
            url: `http://localhost:${context.config.server?.port || 3000}`,
            description: 'Development server'
          }
        ]
      }
    }))
  }
}