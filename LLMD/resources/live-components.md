# Live Components

**Version:** 1.13.0 | **Updated:** 2025-02-09

## Quick Facts

- Server-side state management with WebSocket sync
- **Direct state access** - `this.count++` auto-syncs (v1.13.0)
- **Mandatory `publicActions`** - Only whitelisted methods are callable from client (secure by default)
- Automatic state persistence and re-hydration (with anti-replay nonces)
- Room-based event system for multi-user sync
- Type-safe client-server communication (FluxStackWebSocket)
- Built-in connection management and recovery
- **Client component links** - Ctrl+Click navigation

## LiveComponent Class Structure (v1.13.0)

Server-side component extends `LiveComponent` with **static defaultState**:

```typescript
// app/server/live/LiveCounter.ts
import { LiveComponent } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { CounterDemo as _Client } from '@client/src/live/CounterDemo'

export class LiveCounter extends LiveComponent<typeof LiveCounter.defaultState> {
  static componentName = 'LiveCounter'
  static publicActions = ['increment', 'decrement', 'reset'] as const  // 🔒 REQUIRED
  // static logging = ['lifecycle', 'messages'] as const  // Console logging (optional, prefer DEBUG_LIVE)
  static defaultState = {
    count: 0
  }

  // Declarar propriedades do estado (TypeScript)
  declare count: number

  // ✅ Direct state access - auto-syncs with frontend
  async increment() {
    this.count++
    return { success: true, count: this.count }
  }

  async decrement() {
    this.count--
    return { success: true, count: this.count }
  }

  async reset() {
    this.count = 0
    return { success: true }
  }
}
```

### Key Changes in v1.13.0

1. **Direct state access** - `this.count++` instead of `this.state.count++`
2. **declare keyword** - TypeScript hint for dynamic properties
3. **Cleaner code** - No need to prefix with `this.state.`
4. **Mandatory `publicActions`** - Components without it deny ALL remote actions (secure by default)

### Key Changes in v1.12.0

1. **Static defaultState inside class** - No external export needed
2. **Reactive Proxy** - `this.state.count++` triggers sync automatically
3. **No constructor needed** - Base class handles defaultState merge
4. **Client link** - `import type { Demo as _Client }` enables Ctrl+Click
5. **Type-safe WebSocket** - `FluxStackWebSocket` interface

### With Room Events (Advanced)

```typescript
import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'

export class LiveCounter extends LiveComponent<typeof LiveCounter.defaultState> {
  static componentName = 'LiveCounter'
  static publicActions = ['increment'] as const  // 🔒 REQUIRED
  static defaultState = {
    count: 0,
    lastUpdatedBy: null as string | null,
    connectedUsers: 0
  }
  protected roomType = 'counter'

  // Constructor only needed for room event subscriptions
  constructor(
    initialState: Partial<typeof LiveCounter.defaultState>,
    ws: FluxStackWebSocket,
    options?: { room?: string; userId?: string }
  ) {
    super(initialState, ws, options)

    this.onRoomEvent<{ count: number }>('COUNT_CHANGED', (data) => {
      this.setState({ count: data.count })
    })
  }

  async increment() {
    this.state.count++
    this.emitRoomEventWithState('COUNT_CHANGED',
      { count: this.state.count },
      { count: this.state.count }
    )
    return { success: true, count: this.state.count }
  }

  destroy() {
    super.destroy()
  }
}
```

## Lifecycle Methods

```typescript
export class MyComponent extends LiveComponent<typeof MyComponent.defaultState> {
  static componentName = 'MyComponent'
  static defaultState = {
    // Define state here
  }

  // Constructor ONLY needed if:
  // - Subscribing to room events
  // - Custom initialization logic
  // Otherwise, omit it entirely!

  destroy() {
    // Cleanup subscriptions, timers, etc.
    super.destroy()
  }
}
```

## State Management

### Reactive State Proxy (How It Works)

State mutations auto-sync with the frontend via two layers:

**Layer 1 — Proxy** (`this.state`): A `Proxy` wraps the internal state object. Any `set` on `this.state` compares old vs new value and, if changed, emits `STATE_DELTA` to the client automatically.

**Layer 2 — Direct Accessors** (`this.count`): On construction, `createDirectStateAccessors()` defines a getter/setter via `Object.defineProperty` for each key in `defaultState`. The setter delegates to the proxy, so it also triggers `STATE_DELTA`.

```
this.count++              → accessor setter → proxy set → STATE_DELTA
this.state.count++        → proxy set → STATE_DELTA
this.setState({count: 1}) → Object.assign + single STATE_DELTA (batch)
```

### Direct State Access (v1.13.0) ✨

State properties are accessible directly on `this`:

```typescript
// Declare properties for TypeScript
declare count: number
declare message: string

// ✅ Direct access - auto-syncs via proxy!
this.count++
this.message = 'Hello'

// ✅ Also works (v1.12.0 style) - same proxy underneath
this.state.count++
```

> **Performance note:** Each direct assignment emits one `STATE_DELTA`. For multiple properties at once, use `setState` (single emit).

### setState (Batch Updates)

Use `setState` for multiple properties at once (single emit):

```typescript
// ✅ Batch update - one STATE_DELTA event
this.setState({
  count: newCount,
  lastUpdatedBy: userId,
  updatedAt: new Date().toISOString()
})

// ✅ Function updater (access previous state)
this.setState(prev => ({
  count: prev.count + 1,
  lastUpdatedBy: userId
}))
```

> `setState` writes directly to `_state` (bypasses proxy) and emits a single `STATE_DELTA` with all changed keys. More efficient than N individual assignments.

### setValue (Generic Action)

Built-in action to set any state key from the client. **Must be explicitly included in `publicActions` to be callable:**

```typescript
// Server: opt-in to setValue
static publicActions = ['increment', 'setValue'] as const  // Must include 'setValue'

// Client can then call:
await component.setValue({ key: 'count', value: 42 })
```

> **Security note:** `setValue` is powerful - it allows the client to set any state key. Only add it to `publicActions` if you trust the client to modify any state field.

### $private — Server-Only State

`$private` is a key-value store that lives **exclusively on the server**. It is NEVER synchronized with the client — no `STATE_UPDATE`, no `STATE_DELTA`, not included in `getSerializableState()`.

Use it for sensitive data like tokens, API keys, internal IDs, or any server-side bookkeeping:

```typescript
export class Chat extends LiveComponent<typeof Chat.defaultState> {
  static componentName = 'Chat'
  static publicActions = ['connect', 'sendMessage'] as const
  static defaultState = { messages: [] as string[] }

  async connect(payload: { token: string }) {
    // 🔒 Stays on server — never sent to client
    this.$private.token = payload.token
    this.$private.apiKey = await getApiKey()

    // ✅ Only UI data goes to state (synced with client)
    this.state.messages = await fetchMessages(this.$private.token)
    return { success: true }
  }

  async sendMessage(payload: { text: string }) {
    // Use $private data for server-side logic
    await postToAPI(this.$private.apiKey, payload.text)
    this.state.messages = [...this.state.messages, payload.text]
    return { success: true }
  }
}
```

#### Typed $private (optional)

Pass a second generic to get full autocomplete and type checking:

```typescript
interface ChatPrivate {
  token: string
  apiKey: string
  retryCount: number
}

export class Chat extends LiveComponent<typeof Chat.defaultState, ChatPrivate> {
  static componentName = 'Chat'
  static publicActions = ['connect'] as const
  static defaultState = { messages: [] as string[] }

  async connect(payload: { token: string }) {
    this.$private.token = payload.token     // ✅ autocomplete
    this.$private.retryCount = 0            // ✅ must be number
    this.$private.tokkken = 'x'             // ❌ TypeScript error (typo)
  }
}
```

The second generic defaults to `Record<string, any>`, so existing components work without changes.

**Key facts:**
- Starts as an empty `{}` — no static default needed
- Mutations do NOT trigger any WebSocket messages
- Cleared automatically on `destroy()`
- Lost on rehydration (re-populate in your action handlers)
- Blocked from remote access (`$private` and `_privateState` are in BLOCKED_ACTIONS)
- Optional `TPrivate` generic for full type safety

### getSerializableState

Get current state for serialization (does NOT include `$private`):

```typescript
const currentState = this.getSerializableState()
```

### State Persistence

State is automatically signed and persisted on client. On reconnection, state is re-hydrated:

```typescript
// Automatic - no code needed
// Client stores signed state in localStorage
// On reconnect, sends signed state to server
// Server validates signature and restores component
```

## Room Events System

### Subscribe to Room Events

```typescript
constructor(initialState, ws, options) {
  super(initialState, ws, options)
  
  // Listen for room events
  this.onRoomEvent<{ count: number }>('COUNT_CHANGED', (data) => {
    this.setState({ count: data.count })
  })
  
  this.onRoomEvent<{ message: string }>('MESSAGE_SENT', (data) => {
    // Handle message
  })
}
```

### Emit Room Events

```typescript
// Emit event to all room members
this.emitRoomEvent('MESSAGE_SENT', { 
  message: 'Hello',
  userId: this.userId 
})

// Emit event AND update local state
this.emitRoomEventWithState('COUNT_CHANGED',
  { count: newCount },        // Event data
  { count: newCount }         // State update
)
```

### Room Subscription

Components automatically join rooms specified in options:

```typescript
// Client-side
const counter = Live.use(LiveCounter, {
  room: 'global-counter'  // All instances in this room sync
})
```

## Actions

Actions are methods callable from the client. **Only methods listed in `publicActions` can be called remotely.** Components without `publicActions` deny ALL remote actions.

```typescript
// Server-side
export class LiveForm extends LiveComponent<FormState> {
  static publicActions = ['submit', 'validate'] as const  // 🔒 REQUIRED

  async submit() {
    const { name, email } = this.state
    
    if (!name || !email) {
      throw new Error('Name and email required')
    }
    
    // Process submission
    this.setState({ submitted: true })
    
    return { success: true, data: { name, email } }
  }

  async validate() {
    const errors: Record<string, string> = {}
    
    if (!this.state.name) errors.name = 'Name required'
    if (!this.state.email) errors.email = 'Email required'
    
    return { valid: Object.keys(errors).length === 0, errors }
  }
}
```

## Client-Side Integration

### Provider Setup

Wrap app with LiveComponentsProvider:

```typescript
// app/client/src/App.tsx
import { LiveComponentsProvider } from '@/core/client'

function App() {
  return (
    <LiveComponentsProvider
      url="ws://localhost:3000"
      autoConnect={true}
      reconnectInterval={1000}
      debug={true}
    >
      <AppContent />
    </LiveComponentsProvider>
  )
}
```

### Using Components

```typescript
import { Live } from '@/core/client'
import { LiveCounter } from '@server/live/LiveCounter'

export function CounterDemo() {
  // Mount component with options
  const counter = Live.use(LiveCounter, {
    room: 'global-counter',
    initialState: LiveCounter.defaultState  // ✅ Use static defaultState
  })

  // Access state
  const count = counter.$state.count
  
  // Check connection status
  const isConnected = counter.$connected
  
  // Check loading state
  const isLoading = counter.$loading

  // Call actions
  const handleIncrement = async () => {
    await counter.increment()
  }

  return (
    <div>
      <p>Count: {count}</p>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={handleIncrement} disabled={isLoading}>
        Increment
      </button>
    </div>
  )
}
```

### Field Binding

For form components, use `$field` helper:

```typescript
const form = Live.use(LiveForm)

// Sync on blur
<input {...form.$field('name', { syncOn: 'blur' })} />

// Sync on change with debounce
<input {...form.$field('email', { syncOn: 'change', debounce: 500 })} />

// Manual sync
await form.$sync()
```

### Client API

```typescript
// State access
counter.$state.count

// Connection status
counter.$connected

// Loading state
counter.$loading

// Call action
await counter.increment()

// Field binding (forms)
form.$field('fieldName', options)

// Manual sync
await form.$sync()
```

## Component Registry

Components are auto-discovered from `app/server/live/`:

```typescript
// app/server/live/register-components.ts
import { componentRegistry } from '@core/server/live'

// Auto-discover all components in directory
await componentRegistry.autoDiscoverComponents('./app/server/live')

// Or manually register
componentRegistry.registerComponent({
  name: 'MyComponent',
  component: MyComponent,
  initialState: defaultState
}, '1.0.0')
```

## WebSocket Connection Handling

### Automatic Reconnection

Client automatically reconnects on disconnect:

```typescript
<LiveComponentsProvider
  reconnectInterval={1000}  // Retry every 1 second
  autoConnect={true}
>
```

### State Re-hydration

On reconnect, components restore previous state:

1. Client stores signed state in localStorage
2. On reconnect, sends signed state to server
3. Server validates signature (HMAC-SHA256) and **anti-replay nonce**
4. Component re-hydrated with previous state
5. State expires after 24 hours (configurable)

No manual code needed - automatic. Each signed state includes a cryptographic nonce that is consumed on validation, preventing replay attacks.

## Multi-User Synchronization

### Room-Based Sync

All components in same room receive events:

```typescript
// User A increments
await counter.increment()
// Emits COUNT_CHANGED to room

// User B's component receives event
this.onRoomEvent('COUNT_CHANGED', (data) => {
  this.setState({ count: data.count })
})
// User B sees updated count
```

### User Tracking

Track connected users in room:

```typescript
constructor(initialState, ws, options) {
  super(initialState, ws, options)
  
  // Notify room of new user
  const newCount = this.state.connectedUsers + 1
  this.emitRoomEventWithState('USER_COUNT_CHANGED',
    { connectedUsers: newCount },
    { connectedUsers: newCount }
  )
}

destroy() {
  // Notify room of user leaving
  const newCount = Math.max(0, this.state.connectedUsers - 1)
  this.emitRoomEvent('USER_COUNT_CHANGED', { connectedUsers: newCount })
  super.destroy()
}
```

## Error Handling

```typescript
// Server-side - throw errors
async submit() {
  if (!this.state.email) {
    throw new Error('Email required')
  }
  // Process...
}

// Client-side - catch errors
try {
  await form.submit()
} catch (error) {
  alert(error.message)
}
```

## Performance Monitoring

Built-in performance tracking:

```typescript
// Automatic metrics collection
// - Render times
// - Action execution times
// - Error counts
// - Memory usage

// Access via registry
const health = componentRegistry.getComponentHealth(componentId)
// { status: 'healthy', metrics: {...} }
```

## Component Organization

```
app/server/live/
├── LiveCounter.ts          # Counter component
├── LiveForm.ts             # Form component
├── LiveChat.ts             # Chat component
├── LiveLocalCounter.ts     # Local counter (no room)
└── register-components.ts  # Registration

app/client/src/live/
├── CounterDemo.tsx         # Counter UI
├── FormDemo.tsx            # Form UI
├── ChatDemo.tsx            # Chat UI
└── ...
```

Each server file contains:
- `static componentName` - Component identifier
- `static publicActions` - **REQUIRED** whitelist of client-callable methods
- `static defaultState` - Initial state object
- `static logging` - Per-component console log control (optional, prefer `DEBUG_LIVE=true` for debug panel — see [Live Logging](./live-logging.md))
- Component class extending `LiveComponent`
- Client link via `import type { Demo as _Client }`

## Testing Components

```typescript
// tests/unit/live/LiveCounter.test.ts
import { describe, it, expect } from 'vitest'
import { LiveCounter, defaultState } from '@app/server/live/LiveCounter'

describe('LiveCounter', () => {
  it('should increment count', async () => {
    const mockWs = { send: vi.fn() }
    const counter = new LiveCounter(defaultState, mockWs)
    
    const result = await counter.increment()
    
    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    expect(counter.state.count).toBe(1)
  })
})
```

## Advanced: Dependencies

Register services for dependency injection:

```typescript
// Register service
componentRegistry.registerService('database', () => db)

// Register dependencies
componentRegistry.registerDependencies('MyComponent', [
  { name: 'database', version: '1.0.0', required: true, factory: () => db }
])

// Component receives service
export class MyComponent extends LiveComponent<State> {
  private database: any

  setDatabase(db: any) {
    this.database = db
  }
}
```

## Critical Rules

**ALWAYS:**
- Define `static componentName` matching class name
- Define `static publicActions` listing ALL client-callable methods (MANDATORY)
- Define `static defaultState` inside the class
- Use `typeof ClassName.defaultState` for type parameter
- Use `declare` for each state property (TypeScript type hint)
- Call `super.destroy()` in destroy method if overriding
- Use `emitRoomEventWithState` for state changes in rooms
- Handle errors in actions (throw Error)
- Add client link: `import type { Demo as _Client } from '@client/...'`

**NEVER:**
- Omit `static publicActions` (component will deny ALL remote actions)
- Export separate `defaultState` constant (use static)
- Create constructor just to call super() (not needed)
- Forget `static componentName` (breaks minification)
- Emit room events without subscribing first
- Store non-serializable data in state
- Use reserved names for state properties (id, state, ws, room, userId, $room, $rooms, $private, broadcastToRoom, roomType)
- Include `setValue` in `publicActions` unless you trust clients to modify any state key
- Store sensitive data (tokens, API keys, secrets) in `state` — use `$private` instead

**STATE UPDATES (v1.13.0) — all auto-sync via Proxy:**
```typescript
// ✅ Direct access (1 prop → 1 STATE_DELTA)
declare count: number
this.count++

// ✅ Also works (same proxy underneath)
this.state.count++

// ✅ Multiple properties → use setState (1 STATE_DELTA for all)
this.setState({ a: 1, b: 2, c: 3 })

// ❌ Don't use setState for single property (unnecessary)
this.setState({ count: this.count + 1 })
```

---

## Live Upload (Chunked Upload via WebSocket)

This project includes a Live Component-based upload system that streams file chunks
over the Live Components WebSocket. The client uses a chunked upload hook; the server
tracks progress and assembles the file in `uploads/`.

### Server: LiveUpload Component

Create server-side upload actions inside a Live Component. This example is the base
implementation used by the demos:

```typescript
// app/server/live/LiveUpload.ts
import { LiveComponent } from '@core/types/types'
import { liveUploadDefaultState, type LiveUploadState } from '@app/shared'

export const defaultState: LiveUploadState = liveUploadDefaultState

export class LiveUpload extends LiveComponent<LiveUploadState> {
  static componentName = 'LiveUpload'
  static publicActions = ['startUpload', 'updateProgress', 'completeUpload', 'failUpload', 'reset'] as const
  static defaultState = defaultState

  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
  }

  async startUpload(payload: { fileName: string; fileSize: number; fileType: string }) {
    // Basic validation (example)
    const normalized = payload.fileName.toLowerCase()
    if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) {
      throw new Error('Invalid file name')
    }

    const ext = normalized.includes('.') ? normalized.split('.').pop() || '' : ''
    const blocked = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'jar']
    if (ext && blocked.includes(ext)) {
      throw new Error(`File extension not allowed: .${ext}`)
    }

    this.setState({
      status: 'uploading',
      progress: 0,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.fileType,
      fileUrl: '',
      bytesUploaded: 0,
      totalBytes: payload.fileSize,
      error: null
    })

    return { success: true }
  }

  async updateProgress(payload: { progress: number; bytesUploaded: number; totalBytes: number }) {
    const progress = Math.max(0, Math.min(100, payload.progress))
    this.setState({
      progress,
      bytesUploaded: payload.bytesUploaded,
      totalBytes: payload.totalBytes
    })

    return { success: true, progress }
  }

  async completeUpload(payload: { fileUrl: string }) {
    this.setState({
      status: 'complete',
      progress: 100,
      fileUrl: payload.fileUrl,
      error: null
    })

    return { success: true }
  }

  async failUpload(payload: { error: string }) {
    this.setState({
      status: 'error',
      error: payload.error || 'Upload failed'
    })

    return { success: true }
  }

  async reset() {
    this.setState({ ...defaultState })
    return { success: true }
  }
}
```

### Client: useLiveUpload + Widget

Use the client hook and UI widget to wire the upload to the Live Component:

```typescript
// app/client/src/live/UploadDemo.tsx
import { useLiveUpload } from './useLiveUpload'
import { LiveUploadWidget } from '../components/LiveUploadWidget'

export function UploadDemo() {
  const { live } = useLiveUpload()

  return (
    <LiveUploadWidget live={live} />
  )
}
```

### Chunked Upload Flow

1. Client calls `startUpload()` (Live Component action).
2. Client streams file chunks over WebSocket with `useChunkedUpload`.
3. Server assembles file in `uploads/` and returns `/uploads/...`.
4. Client maps to `/api/uploads/...` for access.

### Error Handling

- If an action throws, the error surfaces in `live.$error` on the client.
- The widget shows `localError || state.error || $error`.

### Files Involved

**Server**
- `app/server/live/LiveUpload.ts`
- `core/server/live/FileUploadManager.ts` (chunk handling + file assembly)
- `core/server/live/websocket-plugin.ts` (upload message routing)

**Client**
- `core/client/hooks/useChunkedUpload.ts` (streaming chunks)
- `core/client/hooks/useLiveUpload.ts` (Live Component wrapper)
- `app/client/src/components/LiveUploadWidget.tsx` (UI)

## Related

- [Live Auth](./live-auth.md) - Authentication for Live Components
- [Live Logging](./live-logging.md) - Per-component logging control
- [Live Rooms](./live-rooms.md) - Multi-room real-time communication
- [Live Upload](./live-upload.md) - Chunked file upload
- [Project Structure](../patterns/project-structure.md)
- [Type Safety Patterns](../patterns/type-safety.md)
- [WebSocket Plugin](../core/plugin-system.md)
