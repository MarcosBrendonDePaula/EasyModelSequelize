# Plugin Hooks Reference

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- Hooks are defined in `core/plugins/types.ts`
- Execution order follows plugin priority (highest → lowest)
- All hooks receive typed contexts
- Hooks can be async (return Promise)

## Hook Categories

1. **Lifecycle Hooks** - Server startup/shutdown
2. **Request Pipeline Hooks** - HTTP request/response processing
3. **Build Pipeline Hooks** - Build process events
4. **Plugin System Hooks** - Plugin registration events

## Execution Order

### Server Startup Sequence

```
onConfigLoad → setup → onBeforeServerStart → onServerStart → onAfterServerStart
```

### Request Processing Sequence

```
onRequest → onRequestValidation → onBeforeRoute → [handler] → onAfterRoute → onBeforeResponse → onResponseTransform → onResponse
```

### Error Handling

```
[error occurs] → onError → onBeforeResponse → onResponse
```

### Server Shutdown Sequence

```
onBeforeServerStop → onServerStop
```

### Build Sequence

```
onBeforeBuild → onBuild → onBuildAsset (per asset) → onBuildComplete
[on error] → onBuildError
```

## Lifecycle Hooks

| Hook | Context | When Called | Use Case |
|------|---------|-------------|----------|
| `setup` | `PluginContext` | After plugin load, before server | Initialize plugin, register Elysia plugins |
| `onConfigLoad` | `ConfigLoadContext` | Config loaded | Validate/modify configuration |
| `onBeforeServerStart` | `PluginContext` | Before server.listen() | Pre-flight checks, connections |
| `onServerStart` | `PluginContext` | Server starting | Register routes, middleware |
| `onAfterServerStart` | `PluginContext` | Server fully started | Log ready status, health checks |
| `onBeforeServerStop` | `PluginContext` | Before shutdown | Start graceful shutdown |
| `onServerStop` | `PluginContext` | Server stopped | Cleanup connections, resources |

### Context Types

```typescript
interface PluginContext {
  config: FluxStackConfig
  logger: Logger
  app: Elysia  // The Elysia app instance
  utils: PluginUtils
  registry?: PluginRegistry
}

interface ConfigLoadContext {
  config: FluxStackConfig
  envVars: Record<string, string | undefined>
  configPath?: string
}
```

### Example: Lifecycle Hook

```typescript
const myPlugin: FluxStack.Plugin = {
  name: 'my-plugin',
  version: '1.0.0',

  setup: async ({ app, logger }) => {
    logger.info('Plugin initializing')

    // Register Elysia plugin
    app.use(myElysiaPlugin())
  },

  onAfterServerStart: ({ config, logger }) => {
    logger.info(`Server running on port ${config.server.port}`)
  }
}
```

## Request Pipeline Hooks

| Hook | Context | When Called | Use Case |
|------|---------|-------------|----------|
| `onRequest` | `RequestContext` | Request received | Logging, rate limiting, auth check |
| `onRequestValidation` | `ValidationContext` | After validation | Custom validation, error formatting |
| `onBeforeRoute` | `RequestContext` | Before handler | Modify request, inject data |
| `onAfterRoute` | `RouteContext` | After handler | Logging, metrics |
| `onBeforeResponse` | `ResponseContext` | Before sending | Modify response, add headers |
| `onResponseTransform` | `TransformContext` | Transform response | Compression, encryption |
| `onResponse` | `ResponseContext` | Response sent | Access logs, analytics |
| `onError` | `ErrorContext` | On any error | Error logging, custom responses |

### Context Types

```typescript
interface RequestContext {
  request: Request
  path: string
  method: string
  headers: Record<string, string>
  query: Record<string, string>
  params: Record<string, string>
  body?: any
  user?: any
  startTime: number
  handled?: boolean
  response?: Response
}

interface ResponseContext extends RequestContext {
  response: Response
  statusCode: number
  duration: number
  size?: number
}

interface ValidationContext extends RequestContext {
  errors: Array<{ field: string; message: string; code: string }>
  isValid: boolean
}

interface ErrorContext extends RequestContext {
  error: Error
  duration: number
  handled: boolean
}

interface RouteContext extends RequestContext {
  route?: string
  handler?: Function
  params: Record<string, string>
}

interface TransformContext extends ResponseContext {
  transformed: boolean
  originalResponse?: Response
}
```

### Example: Request Hook

```typescript
const authPlugin: FluxStack.Plugin = {
  name: 'auth-plugin',

  onRequest: async ({ request, headers }) => {
    const token = headers['authorization']
    if (token) {
      // Validate token and attach user
      const user = await validateToken(token)
      return { user }  // Merged into context
    }
  },

  onError: ({ error, path, method, logger }) => {
    logger.error(`${method} ${path} failed: ${error.message}`)
  }
}
```

## Build Pipeline Hooks

| Hook | Context | When Called | Use Case |
|------|---------|-------------|----------|
| `onBeforeBuild` | `BuildContext` | Before build starts | Setup, validation |
| `onBuild` | `BuildContext` | Build in progress | Custom build steps |
| `onBuildAsset` | `BuildAssetContext` | Per asset processed | Transform, optimize assets |
| `onBuildComplete` | `BuildContext` | Build finished | Post-processing, notifications |
| `onBuildError` | `BuildErrorContext` | Build failed | Error reporting |

### Context Types

```typescript
interface BuildContext {
  target: string
  outDir: string
  mode: 'development' | 'production'
  config: FluxStackConfig
}

interface BuildAssetContext {
  assetPath: string
  assetType: 'js' | 'css' | 'html' | 'image' | 'font' | 'other'
  size: number
  content?: string | Buffer
}

interface BuildErrorContext {
  error: Error
  file?: string
  line?: number
  column?: number
}
```

### Example: Build Hook

```typescript
const optimizerPlugin: FluxStack.Plugin = {
  name: 'optimizer',

  onBuildAsset: ({ assetPath, assetType, size }) => {
    console.log(`Processing ${assetType}: ${assetPath} (${size} bytes)`)
  },

  onBuildComplete: ({ outDir, mode }) => {
    console.log(`Build complete: ${outDir} (${mode})`)
  }
}
```

## Plugin System Hooks

| Hook | Context | When Called | Use Case |
|------|---------|-------------|----------|
| `onPluginRegister` | `PluginEventContext` | Plugin registered | Log, notify |
| `onPluginUnregister` | `PluginEventContext` | Plugin removed | Cleanup |
| `onPluginError` | `PluginEventContext & { error }` | Plugin error | Error handling |

### Context Types

```typescript
interface PluginEventContext {
  pluginName: string
  pluginVersion?: string
  timestamp: number
  data?: any
}
```

## Plugin Utilities

Available via `context.utils`:

```typescript
interface PluginUtils {
  createTimer: (label: string) => { end: () => number }
  formatBytes: (bytes: number) => string
  isProduction: () => boolean
  isDevelopment: () => boolean
  getEnvironment: () => string
  createHash: (data: string) => string
  deepMerge: (target: any, source: any) => any
  validateSchema: (data: any, schema: any) => { valid: boolean; errors: string[] }
}
```

### Example: Using Utilities

```typescript
const metricsPlugin: FluxStack.Plugin = {
  name: 'metrics',

  onRequest: ({ utils }) => {
    const timer = utils.createTimer('request')
    return { timer }  // Pass to response hook
  },

  onResponse: ({ timer, utils }) => {
    const duration = timer?.end()
    if (utils.isProduction()) {
      sendMetric('request_duration', duration)
    }
  }
}
```

## Hook Priority

Plugins execute in priority order:

```typescript
type PluginPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest' | number

const plugin: FluxStack.Plugin = {
  name: 'high-priority-plugin',
  priority: 'high',  // or numeric: 100 (higher = earlier)
  // ...
}
```

| Priority | Numeric | Order |
|----------|---------|-------|
| `highest` | 1000 | First |
| `high` | 100 | Second |
| `normal` | 0 | Default |
| `low` | -100 | Fourth |
| `lowest` | -1000 | Last |

## Hook Execution Options

```typescript
interface HookExecutionOptions {
  timeout?: number      // Max execution time (ms)
  parallel?: boolean    // Run hooks in parallel
  stopOnError?: boolean // Stop chain on error
  retries?: number      // Retry on failure
}
```

## Complete Plugin Example

```typescript
import type { FluxStack } from '@core/plugins/types'

export const analyticsPlugin: FluxStack.Plugin = {
  name: 'analytics',
  version: '1.0.0',
  description: 'Request analytics and metrics',
  priority: 'high',

  setup: async ({ logger }) => {
    logger.info('Analytics plugin initialized')
  },

  onRequest: ({ path, method }) => {
    return { requestStart: Date.now() }
  },

  onResponse: ({ path, method, statusCode, requestStart }) => {
    const duration = Date.now() - (requestStart || 0)
    trackRequest({ path, method, statusCode, duration })
  },

  onError: ({ error, path }) => {
    trackError({ error: error.message, path })
  }
}
```

## Related

- [Plugin System](../core/plugin-system.md)
- [External Plugins](../resources/plugins-external.md)
- [Framework Lifecycle](../core/framework-lifecycle.md)
