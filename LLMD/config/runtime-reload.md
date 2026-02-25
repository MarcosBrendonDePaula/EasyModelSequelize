# Runtime Configuration Reload

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- `ReactiveConfig` enables runtime config updates without server restart
- Watches environment variable changes
- Notifies listeners on reload
- Used for feature flags, rate limits, maintenance mode
- Implementation: `config/system/runtime.config.ts`

## ReactiveConfig Class

### Creating Reactive Config

```typescript
import { defineReactiveConfig, config } from '@core/utils/config-schema'

const reactiveConfig = defineReactiveConfig({
  featureEnabled: config.boolean('FEATURE_FLAG', false),
  maxRequests: config.number('MAX_REQUESTS', 100)
})
```

### Accessing Values

```typescript
// Get all values
const values = reactiveConfig.values
console.log(values.featureEnabled)  // false
console.log(values.maxRequests)     // 100

// Get specific value
const enabled = reactiveConfig.get('featureEnabled')

// Check if value exists
if (reactiveConfig.has('featureEnabled')) {
  // ...
}
```

### Reloading Configuration

```typescript
// Reload from environment (clears env cache)
const newConfig = reactiveConfig.reload()

// All watchers are notified automatically
```

### Watching for Changes

```typescript
// Register watcher
const unwatch = reactiveConfig.watch((newConfig) => {
  console.log('Config updated!')
  console.log('Feature enabled:', newConfig.featureEnabled)
  console.log('Max requests:', newConfig.maxRequests)
})

// Later: stop watching
unwatch()
```

## Runtime Config Example

FluxStack includes `appRuntimeConfig` for runtime-reloadable settings:

```typescript
// config/system/runtime.config.ts
export const appRuntimeConfig = defineReactiveConfig({
  // Feature toggles
  enableSwagger: config.boolean('ENABLE_SWAGGER', true),
  enableMetrics: config.boolean('ENABLE_METRICS', false),
  enableDebugMode: config.boolean('DEBUG', false),

  // Rate limiting
  rateLimitEnabled: config.boolean('RATE_LIMIT_ENABLED', true),
  rateLimitMax: config.number('RATE_LIMIT_MAX', 100),
  rateLimitWindow: config.number('RATE_LIMIT_WINDOW', 60000),

  // Request settings
  requestTimeout: config.number('REQUEST_TIMEOUT', 30000),
  maxUploadSize: config.number('MAX_UPLOAD_SIZE', 10485760),

  // Maintenance mode
  maintenanceMode: config.boolean('MAINTENANCE_MODE', false),
  maintenanceMessage: config.string(
    'MAINTENANCE_MESSAGE',
    'System is under maintenance. Please try again later.'
  )
})

// Setup watcher
appRuntimeConfig.watch((newConfig) => {
  console.log('🔄 Runtime config reloaded')
  console.log('   Debug:', newConfig.enableDebugMode)
  console.log('   Maintenance:', newConfig.maintenanceMode)
})
```

## Use Cases

### Feature Flags

Toggle features without restart:

```typescript
// Check feature flag
if (appRuntimeConfig.values.enableSwagger) {
  // Enable Swagger UI
}

// Update .env: ENABLE_SWAGGER=false
// Reload config
appRuntimeConfig.reload()
// Swagger now disabled
```

### Rate Limiting

Adjust rate limits dynamically:

```typescript
const { rateLimitMax, rateLimitWindow } = appRuntimeConfig.values

// Apply rate limit
if (requestCount > rateLimitMax) {
  throw new Error('Rate limit exceeded')
}

// Update .env: RATE_LIMIT_MAX=200
// Reload config
appRuntimeConfig.reload()
// New limit applied
```

### Maintenance Mode

Enable maintenance without downtime:

```typescript
// Middleware check
if (appRuntimeConfig.values.maintenanceMode) {
  return new Response(appRuntimeConfig.values.maintenanceMessage, {
    status: 503
  })
}

// Update .env: MAINTENANCE_MODE=true
// Reload config
appRuntimeConfig.reload()
// Maintenance mode active
```

### Debug Mode

Toggle debug logging:

```typescript
appRuntimeConfig.watch((config) => {
  if (config.enableDebugMode) {
    logger.setLevel('debug')
  } else {
    logger.setLevel('info')
  }
})

// Update .env: DEBUG=true
// Reload triggers watcher
appRuntimeConfig.reload()
```

## Reload Mechanism

### How It Works

1. **Clear env cache**: `env.clearCache()` forces fresh read
2. **Reload config**: Re-reads all env vars and validates
3. **Notify watchers**: Calls all registered watch callbacks
4. **Return new config**: Returns updated values

### Manual Reload

```typescript
// In your code
import { appRuntimeConfig } from '@config/system/runtime.config'

// Reload when needed
appRuntimeConfig.reload()
```

### Automatic Reload

Create a reload endpoint:

```typescript
// app/server/routes/admin.ts
import { Elysia, t } from 'elysia'
import { appRuntimeConfig } from '@config/system/runtime.config'

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .post('/reload-config', async () => {
    const newConfig = appRuntimeConfig.reload()
    
    return {
      success: true,
      message: 'Configuration reloaded',
      config: {
        maintenanceMode: newConfig.maintenanceMode,
        debugMode: newConfig.enableDebugMode
      }
    }
  }, {
    detail: {
      tags: ['Admin'],
      summary: 'Reload runtime configuration'
    },
    response: t.Object({
      success: t.Boolean(),
      message: t.String(),
      config: t.Object({
        maintenanceMode: t.Boolean(),
        debugMode: t.Boolean()
      })
    })
  })
```

## Watch Callbacks

### Multiple Watchers

```typescript
// Watcher 1: Update logger
appRuntimeConfig.watch((config) => {
  logger.setLevel(config.enableDebugMode ? 'debug' : 'info')
})

// Watcher 2: Update metrics
appRuntimeConfig.watch((config) => {
  if (config.enableMetrics) {
    metricsCollector.start()
  } else {
    metricsCollector.stop()
  }
})

// Both called on reload
```

### Cleanup

```typescript
const unwatch1 = appRuntimeConfig.watch(callback1)
const unwatch2 = appRuntimeConfig.watch(callback2)

// Later: cleanup
unwatch1()
unwatch2()
```

### Error Handling

```typescript
appRuntimeConfig.watch((config) => {
  try {
    // Apply config changes
    applyRateLimits(config.rateLimitMax)
  } catch (error) {
    logger.error('Failed to apply config:', error)
  }
})
```

## Static vs Reactive Config

### Static Config (defineConfig)

```typescript
// Loaded once on startup
const serverConfig = defineConfig({
  port: config.number('PORT', 3000)
})

// Cannot reload
// serverConfig.reload() ❌ Not available
```

Use for:
- Server port/host
- Build settings
- Database connection
- Settings that require restart

### Reactive Config (defineReactiveConfig)

```typescript
// Can reload at runtime
const runtimeConfig = defineReactiveConfig({
  feature: config.boolean('FEATURE_FLAG', false)
})

// Can reload
runtimeConfig.reload() ✅
```

Use for:
- Feature flags
- Rate limits
- Maintenance mode
- Debug settings
- Non-critical settings

## Performance Considerations

### Reload Cost

- Clears env cache
- Re-validates all fields
- Notifies all watchers
- Minimal overhead (~1-5ms)

### When to Reload

- On admin request (manual trigger)
- On file watch (advanced)
- On schedule (cron job)
- NOT on every request (too expensive)

### Caching

```typescript
// Cache config values if accessed frequently
let cachedRateLimit = appRuntimeConfig.values.rateLimitMax

appRuntimeConfig.watch((config) => {
  cachedRateLimit = config.rateLimitMax
})

// Use cached value
if (requestCount > cachedRateLimit) {
  // ...
}
```

## Validation on Reload

Validation runs on every reload:

```typescript
const config = defineReactiveConfig({
  maxRequests: {
    type: 'number',
    env: 'MAX_REQUESTS',
    default: 100,
    validate: (value) => {
      if (value < 1) {
        return 'Max requests must be positive'
      }
      return true
    }
  }
})

// Update .env: MAX_REQUESTS=-10
// Reload throws validation error
config.reload()
// ❌ Configuration validation failed:
//   - Max requests must be positive (got: -10)
```

## Integration with Plugins

Plugins can use reactive config:

```typescript
// plugins/my-plugin/index.ts
import { appRuntimeConfig } from '@config/system/runtime.config'

export default {
  name: 'my-plugin',
  version: '1.0.0',
  
  setup: async (app, config) => {
    // Watch for config changes
    appRuntimeConfig.watch((runtimeConfig) => {
      if (runtimeConfig.maintenanceMode) {
        // Disable plugin features
      }
    })
  }
}
```

## Related

- [Declarative System](./declarative-system.md) - Config schema and defineConfig
- [Environment Variables](./environment-vars.md) - All available env vars
- [Plugin System](../core/plugin-system.md) - Plugin lifecycle hooks
