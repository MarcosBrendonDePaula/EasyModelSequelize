# Live Components Authentication

**Version:** 1.14.0 | **Updated:** 2025-02-12

## Quick Facts

- **`publicActions` is the foundation** - Only whitelisted methods can be called remotely
- Declarative auth configuration via `static auth` and `static actionAuth`
- Role-based access control (RBAC) with OR logic
- Permission-based access control with AND logic
- Auto re-mount when authentication changes
- Pluggable auth providers (JWT, Crypto, Custom)
- `$auth` helper available in component actions

## Server-Side: Protected Components

### Basic Protection (Auth Required)

```typescript
// app/server/live/ProtectedChat.ts
import { LiveComponent } from '@core/types/types'
import type { LiveComponentAuth } from '@core/server/live/auth/types'

export class ProtectedChat extends LiveComponent<typeof ProtectedChat.defaultState> {
  static componentName = 'ProtectedChat'
  static publicActions = ['sendMessage'] as const  // 🔒 REQUIRED
  static defaultState = {
    messages: [] as string[]
  }

  // Auth required to mount this component
  static auth: LiveComponentAuth = {
    required: true
  }

  async sendMessage(payload: { text: string }) {
    // Only authenticated users can call this
    return { success: true }
  }
}
```

### Role-Based Protection

```typescript
// app/server/live/AdminPanel.ts
import { LiveComponent } from '@core/types/types'
import type { LiveComponentAuth } from '@core/server/live/auth/types'

export class AdminPanel extends LiveComponent<typeof AdminPanel.defaultState> {
  static componentName = 'AdminPanel'
  static publicActions = ['deleteUser'] as const  // 🔒 REQUIRED
  static defaultState = {
    users: [] as { id: string; name: string; role: string }[]
  }

  // Requires auth + admin OR moderator role (OR logic)
  static auth: LiveComponentAuth = {
    required: true,
    roles: ['admin', 'moderator']
  }

  async deleteUser(payload: { userId: string }) {
    // User info available via $auth
    console.log(`User ${this.$auth.user?.id} deleting ${payload.userId}`)
    return { success: true }
  }
}
```

### Permission-Based Protection

```typescript
// app/server/live/ContentEditor.ts
import { LiveComponent } from '@core/types/types'
import type { LiveComponentAuth } from '@core/server/live/auth/types'

export class ContentEditor extends LiveComponent<typeof ContentEditor.defaultState> {
  static componentName = 'ContentEditor'
  static publicActions = ['editContent', 'saveContent'] as const  // 🔒 REQUIRED
  static defaultState = {
    content: ''
  }

  // Requires ALL permissions (AND logic)
  static auth: LiveComponentAuth = {
    required: true,
    permissions: ['content.read', 'content.write']
  }
}
```

### Per-Action Protection

```typescript
// app/server/live/ModerationPanel.ts
import { LiveComponent } from '@core/types/types'
import type { LiveComponentAuth, LiveActionAuthMap } from '@core/server/live/auth/types'

export class ModerationPanel extends LiveComponent<typeof ModerationPanel.defaultState> {
  static componentName = 'ModerationPanel'
  static publicActions = ['getReports', 'deleteReport', 'banUser'] as const  // 🔒 REQUIRED
  static defaultState = {
    reports: [] as any[]
  }

  // Component-level: any authenticated user
  static auth: LiveComponentAuth = {
    required: true
  }

  // Per-action auth (works together with publicActions)
  static actionAuth: LiveActionAuthMap = {
    deleteReport: { permissions: ['reports.delete'] },
    banUser: { roles: ['admin', 'moderator'] }
  }

  // Anyone authenticated can view
  async getReports() {
    return { reports: this.state.reports }
  }

  // Requires reports.delete permission
  async deleteReport(payload: { reportId: string }) {
    return { success: true }
  }

  // Requires admin OR moderator role
  async banUser(payload: { userId: string }) {
    return { success: true }
  }
}
```

## Using $auth in Actions

The `$auth` helper provides access to the authenticated user context:

```typescript
export class MyComponent extends LiveComponent<State> {
  async myAction() {
    // Check if authenticated
    if (!this.$auth.authenticated) {
      throw new Error('Not authenticated')
    }

    // Get user info
    const userId = this.$auth.user?.id
    const userName = this.$auth.user?.name

    // Check roles
    if (this.$auth.hasRole('admin')) {
      // Admin-only logic
    }

    if (this.$auth.hasAnyRole(['admin', 'moderator'])) {
      // Admin OR moderator logic
    }

    // Check permissions
    if (this.$auth.hasPermission('users.delete')) {
      // Has specific permission
    }

    if (this.$auth.hasAllPermissions(['users.read', 'users.write'])) {
      // Has ALL permissions
    }

    return { userId }
  }
}
```

### $auth API

```typescript
interface LiveAuthContext {
  readonly authenticated: boolean
  readonly user?: {
    id: string
    roles?: string[]
    permissions?: string[]
    [key: string]: unknown  // Custom fields
  }
  readonly token?: string
  readonly authenticatedAt?: number

  hasRole(role: string): boolean
  hasAnyRole(roles: string[]): boolean
  hasAllRoles(roles: string[]): boolean
  hasPermission(permission: string): boolean
  hasAnyPermission(permissions: string[]): boolean
  hasAllPermissions(permissions: string[]): boolean
}
```

## Client-Side: Authentication

### Authenticate on Connection

Pass auth credentials when the WebSocket connects:

```typescript
// app/client/src/App.tsx
import { LiveComponentsProvider } from '@/core/client'

function App() {
  const token = localStorage.getItem('auth_token')

  return (
    <LiveComponentsProvider
      auth={{ token }}  // Sent as query param on connect
      autoConnect={true}
    >
      <AppContent />
    </LiveComponentsProvider>
  )
}
```

### Dynamic Authentication

Authenticate after connection via `useLiveComponents`:

```typescript
import { useLiveComponents } from '@/core/client'

function LoginForm() {
  const { authenticated, authenticate } = useLiveComponents()
  const [token, setToken] = useState('')

  const handleLogin = async () => {
    const success = await authenticate({ token })
    if (success) {
      // Components with auth errors will auto re-mount
      console.log('Authenticated!')
    }
  }

  return (
    <div>
      <p>Status: {authenticated ? 'Logged in' : 'Not logged in'}</p>
      <input value={token} onChange={e => setToken(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}
```

### Checking Auth Status in Components

```typescript
import { Live } from '@/core/client'
import { AdminPanel } from '@server/live/AdminPanel'

function AdminSection() {
  const panel = Live.use(AdminPanel)

  // Check if authenticated on WebSocket level
  if (!panel.$authenticated) {
    return <p>Please log in</p>
  }

  // Check for auth errors
  if (panel.$error?.includes('AUTH_DENIED')) {
    return <p>Access denied: {panel.$error}</p>
  }

  return <div>{/* Admin content */}</div>
}
```

### Auto Re-mount on Auth Change

When authentication changes from `false` to `true`, components that failed with `AUTH_DENIED` automatically retry mounting:

```typescript
// No manual code needed!
// 1. User tries to mount AdminPanel → AUTH_DENIED
// 2. User calls authenticate({ token: 'admin-token' })
// 3. AdminPanel automatically re-mounts with auth context
```

## Auth Providers

### Creating a Custom Provider

```typescript
// app/server/auth/MyAuthProvider.ts
import type {
  LiveAuthProvider,
  LiveAuthCredentials,
  LiveAuthContext
} from '@core/server/live/auth/types'
import { AuthenticatedContext } from '@core/server/live/auth/LiveAuthContext'

export class MyAuthProvider implements LiveAuthProvider {
  readonly name = 'my-auth'

  async authenticate(credentials: LiveAuthCredentials): Promise<LiveAuthContext | null> {
    const token = credentials.token as string
    if (!token) return null

    // Validate token (JWT decode, database lookup, etc.)
    const user = await validateToken(token)
    if (!user) return null

    return new AuthenticatedContext(
      {
        id: user.id,
        name: user.name,
        roles: user.roles,
        permissions: user.permissions
      },
      token
    )
  }

  // Optional: Custom action authorization
  async authorizeAction(
    context: LiveAuthContext,
    componentName: string,
    action: string
  ): Promise<boolean> {
    // Custom logic (rate limiting, business rules, etc.)
    return true
  }

  // Optional: Custom room authorization
  async authorizeRoom(
    context: LiveAuthContext,
    roomId: string
  ): Promise<boolean> {
    // Example: VIP rooms require premium role
    if (roomId.startsWith('vip-') && !context.hasRole('premium')) {
      return false
    }
    return true
  }
}
```

### Registering Providers

```typescript
// app/server/index.ts
import { liveAuthManager } from '@core/server/live/auth'
import { MyAuthProvider } from './auth/MyAuthProvider'

// Register provider
liveAuthManager.register(new MyAuthProvider())

// Optional: Set as default (first registered is default)
liveAuthManager.setDefault('my-auth')
```

### Built-in DevAuthProvider (Development)

For testing, a `DevAuthProvider` with simple tokens is available:

```typescript
// Tokens available in development:
// - 'admin-token' → role: admin, all permissions
// - 'user-token'  → role: user, basic permissions
// - 'mod-token'   → role: moderator

// Already registered in dev mode automatically
```

## Auth Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT                                  │
├─────────────────────────────────────────────────────────────┤
│  1. Connect WebSocket (optional: ?token=xxx)                │
│  2. authenticate({ token }) → AUTH message                  │
│  3. Live.use(ProtectedComponent) → COMPONENT_MOUNT          │
│  4. If AUTH_DENIED, wait for auth change                    │
│  5. Auth changes → auto re-mount                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     SERVER                                  │
├─────────────────────────────────────────────────────────────┤
│  1. WebSocket connect → store authContext on ws.data        │
│  2. AUTH message → liveAuthManager.authenticate()           │
│  3. COMPONENT_MOUNT → check static auth config              │
│  4. CALL_ACTION → check blocklist → publicActions → actionAuth │
│  5. Component has access to this.$auth                      │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Types

```typescript
// Component-level auth
interface LiveComponentAuth {
  required?: boolean      // Must be authenticated to mount
  roles?: string[]        // Required roles (OR logic - any role)
  permissions?: string[]  // Required permissions (AND logic - all)
}

// Action-level auth
interface LiveActionAuth {
  roles?: string[]        // Required roles (OR logic)
  permissions?: string[]  // Required permissions (AND logic)
}

type LiveActionAuthMap = Record<string, LiveActionAuth>

// Credentials from client
interface LiveAuthCredentials {
  token?: string
  publicKey?: string      // For crypto auth
  signature?: string      // For crypto auth
  timestamp?: number
  nonce?: string
  [key: string]: unknown  // Custom fields
}
```

## Security Layers (Action Execution Order)

When a client calls an action, the server checks in this order:

1. **Blocklist** - Internal methods (destroy, setState, emit, etc.) are always blocked
2. **Private methods** - Methods starting with `_` or `#` are blocked
3. **publicActions** - Action must be in the whitelist (mandatory, no fallback)
4. **actionAuth** - Per-action role/permission check (if defined)
5. **Method exists** - Action must exist on the component instance
6. **Object.prototype** - Blocks toString, valueOf, hasOwnProperty

## Critical Rules

**ALWAYS:**
- Define `static publicActions` listing all client-callable methods (MANDATORY)
- Define `static auth` for protected components
- Define `static actionAuth` for protected actions
- Use `$auth.hasRole()` / `$auth.hasPermission()` in action logic
- Register auth providers before server starts
- Handle `AUTH_DENIED` errors in client UI

**NEVER:**
- Omit `publicActions` (component will deny ALL remote actions)
- Store sensitive data in component state
- Trust client-side auth checks alone (always verify server-side)
- Expose tokens in error messages
- Skip auth on actions that modify data

**AUTH LOGIC:**
```typescript
// Roles: OR logic (any role grants access)
roles: ['admin', 'moderator']  // admin OR moderator

// Permissions: AND logic (all permissions required)
permissions: ['users.read', 'users.write']  // BOTH required
```

## Related

- [Live Components](./live-components.md) - Base component documentation
- [Live Rooms](./live-rooms.md) - Room-based communication
- [Plugin System](../core/plugin-system.md) - Auth as plugin
