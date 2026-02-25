# External Plugins

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- Plugins extend FluxStack with custom functionality
- Located in `plugins/[plugin-name]/` directory
- Use lifecycle hooks for integration
- Support declarative configuration system
- Can add CLI commands, routes, and middleware
- Auto-discovered and loaded at startup

## Plugin Structure

```
plugins/my-plugin/
├── index.ts              # Main plugin file (required)
├── package.json          # Plugin metadata
├── config/
│   └── index.ts         # Plugin configuration
├── server/
│   ├── index.ts         # Server-side code
│   └── middleware.ts    # Middleware
├── client/
│   └── index.ts         # Client-side code
└── cli/
    └── commands.ts      # CLI commands
```

## Basic Plugin Template

```typescript
// plugins/my-plugin/index.ts
import type { FluxStack, PluginContext } from "@core/plugins/types"
import { Elysia } from "elysia"

export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  version: "1.0.0",
  description: "My custom plugin",
  author: "Your Name",
  priority: 100,
  category: "utility",
  tags: ["custom", "utility"],
  dependencies: [],

  setup: async (context: PluginContext) => {
    context.logger.info('My plugin initialized')
    
    // Initialize plugin services
    // Register middleware
    // Setup database connections
  },

  onServerStart: async (context: PluginContext) => {
    context.logger.info('Server started with my plugin')
  },

  onRequest: async (requestContext) => {
    // Process incoming requests
  },

  onResponse: async (responseContext) => {
    // Process outgoing responses
  }
}

export default myPlugin
```

## Plugin Interface

```typescript
interface Plugin {
  // Metadata
  name: string
  version?: string
  description?: string
  author?: string
  dependencies?: string[]
  priority?: number | 'highest' | 'high' | 'normal' | 'low' | 'lowest'
  category?: string
  tags?: string[]

  // Lifecycle hooks
  setup?: (context: PluginContext) => void | Promise<void>
  onConfigLoad?: (context: ConfigLoadContext) => void | Promise<void>
  onBeforeServerStart?: (context: PluginContext) => void | Promise<void>
  onServerStart?: (context: PluginContext) => void | Promise<void>
  onAfterServerStart?: (context: PluginContext) => void | Promise<void>
  onBeforeServerStop?: (context: PluginContext) => void | Promise<void>
  onServerStop?: (context: PluginContext) => void | Promise<void>

  // Request/Response hooks
  onRequest?: (context: RequestContext) => void | Promise<void>
  onBeforeRoute?: (context: RequestContext) => void | Promise<void>
  onAfterRoute?: (context: RouteContext) => void | Promise<void>
  onBeforeResponse?: (context: ResponseContext) => void | Promise<void>
  onResponse?: (context: ResponseContext) => void | Promise<void>
  onRequestValidation?: (context: ValidationContext) => void | Promise<void>
  onResponseTransform?: (context: TransformContext) => void | Promise<void>

  // Error handling
  onError?: (context: ErrorContext) => void | Promise<void>

  // Build hooks
  onBeforeBuild?: (context: BuildContext) => void | Promise<void>
  onBuild?: (context: BuildContext) => void | Promise<void>
  onBuildComplete?: (context: BuildContext) => void | Promise<void>
  onBuildError?: (context: BuildErrorContext) => void | Promise<void>

  // CLI commands
  commands?: CliCommand[]
}
```

## Lifecycle Hooks

### setup

Called during plugin initialization, before server starts:

```typescript
setup: async (context: PluginContext) => {
  // Initialize services
  const service = new MyService(context.config)
  
  // Store in global for access in other hooks
  ;(global as any).myService = service
  
  // Register with plugin registry
  context.logger.info('Plugin initialized')
}
```

### onServerStart

Called when server starts:

```typescript
onServerStart: async (context: PluginContext) => {
  context.logger.info('Server started')
  
  // Start background tasks
  // Connect to external services
  // Initialize monitoring
}
```

### onRequest

Process incoming requests:

```typescript
onRequest: async (requestContext) => {
  // Log request
  console.log(`${requestContext.method} ${requestContext.path}`)
  
  // Add custom headers
  requestContext.headers['x-custom'] = 'value'
  
  // Authenticate user
  const user = await authenticateRequest(requestContext)
  requestContext.user = user
}
```

### onResponse

Process outgoing responses:

```typescript
onResponse: async (responseContext) => {
  // Log response
  console.log(`${responseContext.statusCode} - ${responseContext.duration}ms`)
  
  // Track metrics
  if (responseContext.user) {
    trackUserActivity(responseContext.user, responseContext.path)
  }
}
```

### onError

Handle errors:

```typescript
onError: async (errorContext) => {
  // Log error
  console.error('Request error:', errorContext.error)
  
  // Send to error tracking service
  await sendToSentry(errorContext.error)
  
  // Mark as handled to prevent default error handler
  errorContext.handled = true
}
```

## Plugin Configuration

Use declarative config system:

```typescript
// plugins/my-plugin/config/index.ts
import { defineConfig, config } from '@core/utils/config-schema'

const myPluginConfigSchema = {
  enabled: config.boolean('MY_PLUGIN_ENABLED', true),
  apiKey: config.string('MY_PLUGIN_API_KEY', '', true), // required
  timeout: config.number('MY_PLUGIN_TIMEOUT', 5000, false),
  features: config.array('MY_PLUGIN_FEATURES', ['feature1', 'feature2'])
}

export const myPluginConfig = defineConfig(myPluginConfigSchema)
export type MyPluginConfig = typeof myPluginConfig
export default myPluginConfig
```

Use in plugin:

```typescript
// plugins/my-plugin/index.ts
import { myPluginConfig } from "./config"

export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  
  setup: async (context) => {
    if (!myPluginConfig.enabled) {
      context.logger.info('Plugin disabled')
      return
    }
    
    const service = new MyService({
      apiKey: myPluginConfig.apiKey,
      timeout: myPluginConfig.timeout
    })
  }
}
```

## Adding Routes (Elysia Plugin)

Plugins can add routes using Elysia:

```typescript
import { Elysia, t } from "elysia"

export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  
  // @ts-ignore - plugin property supported but not in official types
  plugin: new Elysia({ prefix: "/api/my-plugin", tags: ['MyPlugin'] })
    .get("/status", () => ({
      status: "ok",
      version: "1.0.0"
    }), {
      response: t.Object({
        status: t.String(),
        version: t.String()
      }),
      detail: {
        summary: 'Plugin Status',
        description: 'Returns plugin status information'
      }
    })
    
    .post("/action", async ({ body }) => {
      // Handle action
      return { success: true }
    }, {
      body: t.Object({
        data: t.String()
      }),
      response: t.Object({
        success: t.Boolean()
      })
    })
}
```

## Adding CLI Commands

```typescript
// plugins/my-plugin/cli/my-command.ts
import type { CliCommand } from "@core/plugins/types"

export const myCommand: CliCommand = {
  name: "my:command",
  description: "Does something useful",
  usage: "flux my:command [options]",
  examples: [
    "flux my:command --option value"
  ],
  options: [
    {
      name: "option",
      alias: "o",
      description: "An option",
      type: "string",
      required: false
    }
  ],
  handler: async (args, options, context) => {
    context.logger.info('Running my command')
    
    // Access config
    const config = context.config
    
    // Perform action
    console.log('Option value:', options.option)
  }
}
```

Register in plugin:

```typescript
import { myCommand } from "./cli/my-command"

export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  commands: [myCommand]
}
```

## Middleware Pattern

Create reusable middleware:

```typescript
// plugins/my-plugin/server/middleware.ts
export class MyMiddleware {
  constructor(private config: any) {}

  async handle(requestContext: RequestContext) {
    // Validate request
    if (!this.validateRequest(requestContext)) {
      throw new Error('Invalid request')
    }
    
    // Add data to context
    requestContext.user = await this.getUser(requestContext)
  }

  private validateRequest(context: RequestContext): boolean {
    // Validation logic
    return true
  }

  private async getUser(context: RequestContext) {
    // Get user from headers
    return { id: 1, name: 'User' }
  }
}
```

Use in plugin:

```typescript
import { MyMiddleware } from "./server/middleware"

export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  
  setup: async (context) => {
    const middleware = new MyMiddleware(myPluginConfig)
    ;(global as any).myMiddleware = middleware
  },
  
  onRequest: async (requestContext) => {
    const middleware = (global as any).myMiddleware
    await middleware.handle(requestContext)
  }
}
```

## Package.json Metadata

```json
{
  "name": "@fluxstack/my-plugin",
  "version": "1.0.0",
  "description": "My FluxStack plugin",
  "main": "index.ts",
  "types": "index.ts",
  "exports": {
    ".": {
      "import": "./index.ts",
      "types": "./index.ts"
    },
    "./server": {
      "import": "./server/index.ts",
      "types": "./server/index.ts"
    },
    "./client": {
      "import": "./client/index.ts",
      "types": "./client/index.ts"
    }
  },
  "keywords": [
    "fluxstack",
    "plugin"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {},
  "fluxstack": {
    "plugin": true,
    "version": "^1.0.0",
    "hooks": [
      "setup",
      "onServerStart",
      "onRequest"
    ],
    "category": "utility",
    "tags": ["custom"]
  }
}
```

## Plugin Dependencies

Declare dependencies on other plugins:

```typescript
export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  dependencies: ["crypto-auth", "database"],
  
  setup: async (context) => {
    // Dependencies are loaded first
    // Access other plugin services
    const authService = (global as any).cryptoAuthService
  }
}
```

## Plugin Priority

Control load order with priority:

```typescript
export const myPlugin: FluxStack.Plugin = {
  name: "my-plugin",
  priority: 100, // Higher = loads first
  // or use named priorities:
  // priority: 'highest' | 'high' | 'normal' | 'low' | 'lowest'
}
```

Load order:
1. Highest priority (or 1000+)
2. High priority (or 500-999)
3. Normal priority (or 100-499) - default
4. Low priority (or 50-99)
5. Lowest priority (or 0-49)

## Security Considerations

### Plugin Whitelist

Only whitelisted plugins are loaded:

```typescript
// config/system/plugins.config.ts
export const pluginsConfig = defineConfig({
  whitelist: config.array('PLUGINS_WHITELIST', [
    'crypto-auth',
    'my-plugin'
  ])
})
```

### Validate Input

Always validate user input in plugin routes:

```typescript
.post("/action", async ({ body, set }) => {
  if (!body.data || typeof body.data !== 'string') {
    set.status = 400
    return { error: 'Invalid data' }
  }
  
  // Process validated data
}, {
  body: t.Object({
    data: t.String({ minLength: 1, maxLength: 1000 })
  })
})
```

### Secure Configuration

Never expose sensitive config in responses:

```typescript
// ❌ BAD
.get("/config", () => myPluginConfig)

// ✅ GOOD
.get("/config", () => ({
  enabled: myPluginConfig.enabled,
  features: myPluginConfig.features
  // Don't expose apiKey or secrets
}))
```

## Testing Plugins

```typescript
// plugins/my-plugin/__tests__/plugin.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { myPlugin } from '../index'

describe('MyPlugin', () => {
  it('should have correct metadata', () => {
    expect(myPlugin.name).toBe('my-plugin')
    expect(myPlugin.version).toBe('1.0.0')
  })

  it('should initialize correctly', async () => {
    const mockContext = {
      config: {},
      logger: { info: vi.fn() },
      app: {},
      utils: {}
    }

    await myPlugin.setup?.(mockContext)
    
    expect(mockContext.logger.info).toHaveBeenCalled()
  })
})
```

## Example: Crypto Auth Plugin

Reference implementation in `plugins/crypto-auth/`:

```typescript
export const cryptoAuthPlugin: FluxStack.Plugin = {
  name: "crypto-auth",
  version: "1.0.0",
  description: "Ed25519 cryptographic authentication",
  priority: 100,
  category: "auth",
  tags: ["authentication", "ed25519", "security"],
  dependencies: [],

  setup: async (context) => {
    if (!cryptoAuthConfig.enabled) return
    
    const authService = new CryptoAuthService({
      maxTimeDrift: cryptoAuthConfig.maxTimeDrift,
      adminKeys: cryptoAuthConfig.adminKeys,
      logger: context.logger
    })
    
    ;(global as any).cryptoAuthService = authService
  },

  plugin: new Elysia({ prefix: "/api/auth" })
    .get("/info", () => ({
      name: "FluxStack Crypto Auth",
      version: "1.0.0"
    })),

  onResponse: async (context) => {
    if (!cryptoAuthConfig.enableMetrics) return
    
    // Log authentication metrics
    if (context.user) {
      console.debug("Authenticated request", {
        publicKey: context.user.publicKey,
        path: context.path
      })
    }
  }
}
```

## Plugin Discovery

Plugins are auto-discovered from:

1. `plugins/` directory (project plugins)
2. `node_modules/@fluxstack/*-plugin` (npm plugins)
3. Whitelisted in `config/system/plugins.config.ts`

## Critical Rules

**ALWAYS:**
- Export plugin as default export
- Use declarative config system
- Validate all user input
- Handle errors gracefully
- Document plugin hooks and dependencies
- Test plugin functionality

**NEVER:**
- Modify core framework files
- Expose sensitive configuration
- Block server startup in setup hook
- Ignore security best practices
- Forget to cleanup in onServerStop

## Related

- [Plugin System](../core/plugin-system.md)
- [Plugin Hooks Reference](../reference/plugin-hooks.md)
- [Configuration System](../config/declarative-system.md)
- [CLI Commands](../reference/cli-commands.md)
