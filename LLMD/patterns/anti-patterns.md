# Anti-Patterns

**Version:** 1.11.0 | **Updated:** 2025-02-08

## Quick Facts

- FluxStack has strict rules to maintain type safety and stability
- Violations break type inference, cause runtime errors, or introduce security issues
- Most issues stem from ignoring the core/app separation

## Core Directory Violations

### Never Modify `core/`

```typescript
// ❌ NEVER do this
// Editing core/server/framework.ts
// Editing core/plugins/manager.ts
// Editing core/utils/config-schema.ts

// ✅ Use extension points instead
// Create plugins in plugins/
// Override configs in config/
// Add business logic in app/
```

**Why**: `core/` is framework code. Changes break on updates and can't be merged upstream.

## Eden Treaty Anti-Patterns

### Never Wrap Eden Treaty

```typescript
// ❌ WRONG - Wrapping breaks type inference
async function apiCall<T>(fn: () => Promise<any>): Promise<T> {
  try {
    const result = await fn()
    return result.data as T  // Type cast = lost inference
  } catch (error) {
    throw error
  }
}

const user = await apiCall<User>(() => api.users({ id: 1 }).get())
// user type is manually cast, not inferred

// ✅ CORRECT - Use Eden Treaty directly
const { data, error } = await api.users({ id: 1 }).get()
// data is automatically typed as UserResponse
```

**Why**: Eden Treaty's power is automatic type inference. Wrappers destroy this.

### Never Omit Response Schemas

```typescript
// ❌ WRONG - No response schema
export const usersRoutes = new Elysia({ prefix: '/users' })
  .get('/', () => {
    return { users: [] }  // Response type is 'unknown' in Eden
  })

// ✅ CORRECT - Always define response schema
export const usersRoutes = new Elysia({ prefix: '/users' })
  .get('/', () => {
    return { users: [] }
  }, {
    response: t.Object({
      users: t.Array(t.Object({
        id: t.Number(),
        name: t.String()
      }))
    })
  })
```

**Why**: Response schemas enable type inference AND generate Swagger docs.

### Never Define Types Manually for API Responses

```typescript
// ❌ WRONG - Manual type definitions
interface UserResponse {
  id: number
  name: string
}
const { data } = await api.users.get()
const users = data as UserResponse[]  // Type assertion

// ✅ CORRECT - Let Eden Treaty infer types
const { data, error } = await api.users.get()
// TypeScript automatically knows data.users is User[]
```

## Configuration Anti-Patterns

### Never Use process.env Directly

```typescript
// ❌ WRONG - No validation, no type safety
const port = process.env.PORT || 3000
const debug = process.env.DEBUG === 'true'

// ✅ CORRECT - Use config system
import { appConfig } from '@config/app.config'
const port = appConfig.port  // number, validated
const debug = appConfig.debug  // boolean, validated
```

### Never Hardcode Configuration

```typescript
// ❌ WRONG - Hardcoded values
const corsOrigins = ['http://localhost:5173', 'https://myapp.com']

// ✅ CORRECT - Use environment-based config
import { serverConfig } from '@config/server.config'
const corsOrigins = serverConfig.cors.origins
```

### Never Mix Config Layers

```typescript
// ❌ WRONG - Accessing system config from app code
import { systemConfig } from '@config/system.config'
console.log(systemConfig.framework.name)  // Framework details in app

// ✅ CORRECT - Use appropriate config layer
import { appConfig } from '@config/app.config'
console.log(appConfig.name)
```

## Import Path Anti-Patterns

### Never Use Deep Relative Imports

```typescript
// ❌ WRONG - Brittle, hard to refactor
import { api } from '../../../lib/eden-api'
import type { User } from '../../../../shared/types'

// ✅ CORRECT - Use path aliases
import { api } from '@client/lib/eden-api'
import type { User } from '@shared/types'
```

### Never Import Core Internals

```typescript
// ❌ WRONG - Internal implementation details
import { internalHelper } from '@core/framework/internal/utils'

// ✅ CORRECT - Use public exports only
import { publicUtil } from '@core/utils'
```

## Plugin Security Anti-Patterns

### Never Enable NPM Discovery Without Whitelist

```bash
# ❌ WRONG - All NPM plugins auto-loaded (dangerous!)
PLUGINS_DISCOVER_NPM=true
# No PLUGINS_ALLOWED set

# ✅ CORRECT - Whitelist required packages
PLUGINS_DISCOVER_NPM=true
PLUGINS_ALLOWED=fluxstack-plugin-auth,@acme/fplugin-payments
```

### Never Skip Plugin Auditing

```bash
# ❌ WRONG - Installing without audit
bun add some-random-plugin

# ✅ CORRECT - Use plugin:add with audit
bun run fluxstack plugin:add some-random-plugin
# Automatically audits before install
```

### Never Trust Plugin Config Blindly

```typescript
// ❌ WRONG - Using unvalidated plugin config
const pluginConfig = await loadPluginConfig(pluginName)
database.connect(pluginConfig.connectionString)  // Potential injection

// ✅ CORRECT - Validate with schema
const schema = {
  connectionString: config.string('DB_URL', '', true)
}
const validatedConfig = defineConfig(schema)
```

## Route Definition Anti-Patterns

### Never Mix Business Logic in Routes

```typescript
// ❌ WRONG - Database logic in route
export const usersRoutes = new Elysia({ prefix: '/users' })
  .get('/', async () => {
    const db = await connectDB()
    const users = await db.query('SELECT * FROM users')
    await db.close()
    return { users }
  })

// ✅ CORRECT - Use controller/service pattern
export const usersRoutes = new Elysia({ prefix: '/users' })
  .get('/', async () => {
    return await userController.list()
  })
```

### Never Forget Error Handling

```typescript
// ❌ WRONG - Unhandled errors
.post('/', async ({ body }) => {
  const user = await createUser(body)  // May throw
  return { user }
})

// ✅ CORRECT - Handle errors properly
.post('/', async ({ body, error }) => {
  try {
    const user = await createUser(body)
    return { success: true, user }
  } catch (e) {
    return error(400, { success: false, message: e.message })
  }
})
```

## Testing Anti-Patterns

### Never Test Against Real API

```typescript
// ❌ WRONG - Real API calls in tests
it('should fetch users', async () => {
  const { data } = await api.users.get()  // Hits real backend
  expect(data.users).toBeDefined()
})

// ✅ CORRECT - Mock Eden Treaty
vi.mock('@client/lib/eden-api', () => ({
  api: {
    users: {
      get: vi.fn().mockResolvedValue({
        data: { users: [{ id: 1, name: 'Test' }] },
        error: undefined
      })
    }
  }
}))
```

## Build Anti-Patterns

### Never Import Dev Dependencies in Production

```typescript
// ❌ WRONG - Conditional import that still bundles
import { DevTools } from 'react-devtools'  // Always bundled

if (process.env.NODE_ENV === 'development') {
  DevTools.init()
}

// ✅ CORRECT - Dynamic import for dev-only
if (import.meta.env.DEV) {
  const { DevTools } = await import('react-devtools')
  DevTools.init()
}
```

## Live Component Security Anti-Patterns

### Never Omit publicActions

```typescript
// ❌ WRONG - No publicActions = ALL remote actions blocked (secure by default)
export class MyComponent extends LiveComponent<State> {
  static componentName = 'MyComponent'
  static defaultState = { count: 0 }

  async increment() { this.state.count++ }  // Client CANNOT call this!
}

// ✅ CORRECT - Explicitly whitelist callable methods
export class MyComponent extends LiveComponent<State> {
  static componentName = 'MyComponent'
  static publicActions = ['increment'] as const  // Only increment is callable
  static defaultState = { count: 0 }

  async increment() { this.state.count++ }

  // Internal helper - not in publicActions, so not callable from client
  private _recalculate() { /* ... */ }
}
```

**Why**: Components without `publicActions` deny ALL remote actions. This is secure by default - if you forget, nothing is exposed rather than everything.

### Never Include setValue Without Careful Consideration

```typescript
// ❌ DANGEROUS - setValue allows client to set ANY state key
static publicActions = ['sendMessage', 'setValue'] as const
// Client can now do: component.setValue({ key: 'isAdmin', value: true })

// ✅ CORRECT - Only expose specific, safe actions
static publicActions = ['sendMessage', 'deleteMessage'] as const
```

**Why**: `setValue` is a generic action that allows the client to modify any state property. Only include it if all state fields are safe for clients to modify.

### Never Trust MIME Types Alone for Uploads

```typescript
// ❌ WRONG - Only checking MIME type header (easily spoofed)
if (file.type === 'image/jpeg') {
  // Accept file - but it could be an EXE with a fake MIME header!
}

// ✅ CORRECT - Framework validates magic bytes automatically
// FileUploadManager.validateContentMagicBytes() runs on completeUpload()
// No manual code needed - the framework handles this
```

**Why**: MIME types come from the client and can be spoofed. The framework validates actual file content (magic bytes) against the claimed type.

### Never Store Sensitive Data in State

```typescript
// ❌ WRONG - Token goes to the client via STATE_UPDATE/STATE_DELTA
export class Chat extends LiveComponent<State> {
  static defaultState = { messages: [], token: '' }  // token synced to client!
  static publicActions = ['connect'] as const

  async connect(payload: { token: string }) {
    this.state.token = payload.token  // 💀 Visible in browser DevTools!
  }
}

// ✅ CORRECT - Use $private for server-only data
export class Chat extends LiveComponent<State> {
  static defaultState = { messages: [] as string[] }
  static publicActions = ['connect'] as const

  async connect(payload: { token: string }) {
    this.$private.token = payload.token  // 🔒 Never leaves the server
    this.state.messages = await fetch(this.$private.token)
  }
}
```

**Why**: Everything in `state` is serialized and sent to the client via WebSocket. Use `$private` for tokens, API keys, internal IDs, or any data the client should not see.

### Never Ignore Double Extensions

```typescript
// ❌ WRONG - Only checking last extension
const ext = filename.split('.').pop()  // Returns 'jpg' for 'malware.exe.jpg'

// ✅ CORRECT - Framework checks all intermediate extensions automatically
// FileUploadManager blocks files like 'malware.exe.jpg'
// No manual code needed - handled at framework level
```

## Summary Table

| Anti-Pattern | Impact | Solution |
|-------------|--------|----------|
| Modifying `core/` | Update conflicts | Use plugins/app |
| Wrapping Eden Treaty | Lost type inference | Use directly |
| Missing response schemas | Unknown types | Always define schemas |
| Direct process.env | No validation | Use config system |
| Deep relative imports | Fragile paths | Use aliases |
| NPM plugins without whitelist | Security risk | Set PLUGINS_ALLOWED |
| Business logic in routes | Unmaintainable | Use controllers |
| Missing `publicActions` | All actions blocked | Always define whitelist |
| Including `setValue` carelessly | Privilege escalation | Use specific actions |
| Sensitive data in `state` | Data leak to client | Use `$private` instead |
| Trusting MIME types alone | File disguise attacks | Framework validates magic bytes |

## Related

- [Project Structure](./project-structure.md)
- [Type Safety](./type-safety.md)
- [Plugin Security](../core/plugin-system.md)
- [Routes with Eden Treaty](../resources/routes-eden.md)
- [Live Components](../resources/live-components.md)
- [Live Upload](../resources/live-upload.md)
