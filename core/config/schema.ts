import { config as modernFluxStackConfig } from '@config/fluxstack.config'

export const defaultFluxStackConfig = modernFluxStackConfig

export const environmentDefaults = modernFluxStackConfig.environments ?? {
  development: {},
  production: {},
  test: {}
}

export const fluxStackConfigSchema = {
  type: 'object',
  required: ['app', 'server', 'client', 'build', 'plugins', 'logging', 'monitoring'],
  properties: {
    app: {
      type: 'object',
      required: ['name', 'version'],
      properties: {
        name: { type: 'string' },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+' },
        description: { type: 'string' }
      }
    },
    server: {
      type: 'object',
      required: ['port', 'host', 'apiPrefix', 'cors'],
      properties: {
        port: { type: 'number', minimum: 1, maximum: 65535 },
        host: { type: 'string' },
        apiPrefix: { type: 'string' },
        cors: {
          type: 'object',
          properties: {
            origins: { type: 'array', items: { type: 'string' } },
            methods: { type: 'array', items: { type: 'string' } },
            headers: { type: 'array', items: { type: 'string' } },
            credentials: { type: 'boolean' },
            maxAge: { type: 'number' }
          }
        }
      }
    },
    client: {
      type: 'object',
      required: ['port', 'proxy', 'build'],
      properties: {
        port: { type: 'number' },
        proxy: {
          type: 'object',
          properties: {
            target: { type: 'string' },
            secure: { type: 'boolean' },
            changeOrigin: { type: 'boolean' }
          }
        },
        build: { type: 'object' }
      }
    },
    build: {
      type: 'object',
      required: ['target', 'outDir', 'optimization'],
      properties: {
        target: { type: 'string' },
        outDir: { type: 'string' },
        optimization: { type: 'object' }
      }
    },
    plugins: { type: 'object' },
    logging: { type: 'object' },
    monitoring: { type: 'object' }
  }
}

export type FluxStackConfig = typeof modernFluxStackConfig

export default {
  defaultFluxStackConfig,
  environmentDefaults,
  fluxStackConfigSchema
}
