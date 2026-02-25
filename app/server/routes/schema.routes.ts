import { Elysia, t } from 'elysia'
import { generatorRegistry } from '@server/generators'

export const schemaRoutes = new Elysia({ prefix: '/schema' })
  .get('/generators', () => ({
    success: true,
    generators: generatorRegistry.getAll()
  }), {
    detail: {
      tags: ['Schema'],
      summary: 'List available generators',
      description: 'Returns metadata for all registered code generators'
    }
  })

  .post('/generate', ({ body }) => {
    const { generatorId, models } = body
    const result = generatorRegistry.generate(generatorId, models)
    return { success: true, result }
  }, {
    body: t.Object({
      generatorId: t.String(),
      models: t.Array(t.Any())
    }),
    detail: {
      tags: ['Schema'],
      summary: 'Generate code',
      description: 'Generates code files for the given models using the specified generator'
    }
  })
