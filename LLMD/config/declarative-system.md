# Declarative Configuration System

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- Laravel-inspired schema-based configuration with automatic validation
- Type-safe config with full TypeScript inference
- Environment variable mapping with type casting
- Runtime reload support via `ReactiveConfig`
- Located in `config/system/*.config.ts`
- Core implementation: `core/utils/config-schema.ts`

## defineConfig Function

Creates a static configuration object from a schema:

```typescript
import { defineConfig, config } from '@core/utils/config-schema'

const appConfig = defineConfig({
  name: config.string('APP_NAME', 'MyApp', true),
  port: config.number('PORT', 3000, true),
  env: config.enum('NODE_ENV', ['development', 'production'] as const, 'development')
})

// Type-safe access
appConfig.name  // string
appConfig.port  // number
appConfig.env   // "development" | "production"
```

## ConfigField Types

### string

```typescript
{
  type: 'string',
  env: 'VAR_NAME',
  default: 'value',
  required: false
}

// Shorthand
config.string('VAR_NAME', 'default', required)
```

### number

```typescript
{
  type: 'number',
  env: 'PORT',
  default: 3000,
  required: true,
  validate: (value) => value > 0 && value < 65536
}

// Shorthand
config.number('PORT', 3000, true)
```

Casts string env vars to numbers automatically.

### boolean

```typescript
{
  type: 'boolean',
  env: 'ENABLE_FEATURE',
  default: false
}

// Shorthand
config.boolean('ENABLE_FEATURE', false)
```

Accepts: `true`, `1`, `yes`, `on` (case-insensitive) as true.

### array

```typescript
{
  type: 'array',
  env: 'ALLOWED_HOSTS',
  default: ['localhost']
}

// Shorthand
config.array('ALLOWED_HOSTS', ['localhost'])
```

Parses comma-separated strings: `"host1,host2,host3"` → `['host1', 'host2', 'host3']`

### object

```typescript
{
  type: 'object',
  env: 'METADATA',
  default: {}
}
```

Parses JSON strings from env vars.

### enum

```typescript
{
  type: 'enum',
  env: 'NODE_ENV',
  values: ['development', 'production', 'test'] as const,
  default: 'development',
  validate: (value) => value !== 'test' || 'Test mode not allowed'
}

// Shorthand
config.enum('NODE_ENV', ['development', 'production'] as const, 'development')
```

Validates value is in allowed list. TypeScript infers union type.

## Validation

### Built-in Validation

- **Required fields**: Throws error if missing
- **Type casting**: Automatic conversion from env strings
- **Enum validation**: Ensures value in allowed list

### Custom Validation

```typescript
{
  type: 'number',
  env: 'PORT',
  default: 3000,
  validate: (value: number) => {
    if (value < 1 || value > 65535) {
      return 'Port must be between 1 and 65535'
    }
    return true
  }
}
```

Return `true` for valid, `false` or error string for invalid.

### Validation Errors

```typescript
// Throws on startup if validation fails:
// ❌ Configuration validation failed:
//   - Field 'port' is required but not provided
//   - Field 'env' must be one of: development, production (got: "staging")
```

## ReactiveConfig (Runtime Reload)

For configs that need runtime updates:

```typescript
import { defineReactiveConfig } from '@core/utils/config-schema'

const reactiveConfig = defineReactiveConfig({
  feature: config.boolean('FEATURE_FLAG', false)
})

// Access values
reactiveConfig.values.feature  // false

// Watch for changes
const unwatch = reactiveConfig.watch((newConfig) => {
  console.log('Config updated:', newConfig.feature)
})

// Reload from environment
reactiveConfig.reload()

// Stop watching
unwatch()
```

See [runtime-reload.md](./runtime-reload.md) for detailed usage.

## Nested Configuration

Group related configs:

```typescript
import { defineNestedConfig } from '@core/utils/config-schema'

const serverConfig = defineNestedConfig({
  server: {
    port: config.number('PORT', 3000),
    host: config.string('HOST', 'localhost')
  },
  cors: {
    origins: config.array('CORS_ORIGINS', ['http://localhost:3000']),
    credentials: config.boolean('CORS_CREDENTIALS', false)
  }
})

// Access nested
serverConfig.server.port    // 3000
serverConfig.cors.origins   // ['http://localhost:3000']
```

## Helper Functions

```typescript
import { config } from '@core/utils/config-schema'

// All helpers: (envVar, default, required)
config.string('VAR', 'default', false)
config.number('VAR', 42, true)
config.boolean('VAR', false)
config.array('VAR', ['item'])
config.enum('VAR', ['a', 'b'] as const, 'a')
```

## Custom Transformers

Apply custom logic before validation:

```typescript
{
  type: 'string',
  env: 'API_URL',
  default: 'http://localhost:3000',
  transform: (value) => value.endsWith('/') ? value.slice(0, -1) : value
}
```

## Configuration Files

All system configs in `config/system/`:

- `app.config.ts` - Application metadata
- `server.config.ts` - Server and CORS settings
- `client.config.ts` - Frontend configuration
- `build.config.ts` - Build settings
- `database.config.ts` - Database connection
- `plugins.config.ts` - Plugin system settings
- `services.config.ts` - External services
- `monitoring.config.ts` - Logging and metrics

## Type Inference

Full TypeScript type safety:

```typescript
const config = defineConfig({
  port: config.number('PORT', 3000),
  env: config.enum('NODE_ENV', ['dev', 'prod'] as const, 'dev')
})

// Inferred types:
config.port  // number
config.env   // "dev" | "prod"
```

## Related

- [Environment Variables](./environment-vars.md) - Complete env var reference
- [Runtime Reload](./runtime-reload.md) - ReactiveConfig usage patterns
