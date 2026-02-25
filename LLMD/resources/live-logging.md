# Live Logging

**Version:** 1.12.1 | **Updated:** 2025-02-22

## Quick Facts

- Per-component logging control — silent by default
- Two output channels: **console** (`LIVE_LOGGING`) and **debug panel** (`DEBUG_LIVE`)
- Both off by default — opt-in only
- 6 categories: `lifecycle`, `messages`, `state`, `performance`, `rooms`, `websocket`
- `console.error` always visible regardless of config
- All `liveLog`/`liveWarn` calls are forwarded to the Live Debugger as `LOG` events when `DEBUG_LIVE=true`

## Two Logging Channels

| Channel | Env Var | Default | Purpose |
|---------|---------|---------|---------|
| **Console** | `LIVE_LOGGING` | `false` | Server terminal output |
| **Debug Panel** | `DEBUG_LIVE` | `false` | Live Debugger WebSocket stream |

The debug panel receives **all** `liveLog`/`liveWarn` calls as `LOG` events (with `category`, `level`, `message`, and `details`) regardless of the `LIVE_LOGGING` console setting. This keeps the console clean while making everything visible in the debug panel.

### Recommended Workflow

- **Normal development**: both off — clean console, no debug overhead
- **Debugging live components**: `DEBUG_LIVE=true` — open the debug panel at `/api/live/debug/ws`
- **Quick console debugging**: `LIVE_LOGGING=lifecycle,state` — targeted categories to console
- **Per-component debugging**: `static logging = true` on the specific component class

## Console Logging

### Per-Component (static logging)

```typescript
// app/server/live/LiveChat.ts
export class LiveChat extends LiveComponent<typeof LiveChat.defaultState> {
  static componentName = 'LiveChat'

  // ✅ All categories to console
  static logging = true

  // ✅ Specific categories only
  static logging = ['lifecycle', 'rooms'] as const

  // ✅ Silent (default — omit property or set false)
  // No static logging needed
}
```

### Global (LIVE_LOGGING env var)

Logs not tied to a specific component (connection cleanup, key rotation, etc.):

```bash
# .env
LIVE_LOGGING=true                  # All global logs to console
LIVE_LOGGING=lifecycle,rooms       # Specific categories only
# (unset or 'false')              # Silent (default)
```

## Debug Panel (DEBUG_LIVE)

When `DEBUG_LIVE=true`, all `liveLog`/`liveWarn` calls emit `LOG` events to the Live Debugger, regardless of `LIVE_LOGGING` or `static logging` settings.

```bash
# .env
DEBUG_LIVE=true   # Enable debug panel events
```

Each `LOG` event contains:

```typescript
{
  type: 'LOG',
  componentId: string | null,
  componentName: null,
  data: {
    category: 'lifecycle' | 'messages' | 'state' | 'performance' | 'rooms' | 'websocket',
    level: 'info' | 'warn',
    message: string,
    details?: unknown   // Extra args passed to liveLog/liveWarn
  }
}
```

The debug panel also receives all other debug events (`COMPONENT_MOUNT`, `STATE_CHANGE`, `ACTION_CALL`, etc.) — see [Live Components](./live-components.md) for the full event list.

## Categories

| Category | What It Logs |
|----------|-------------|
| `lifecycle` | Mount, unmount, rehydration, recovery, migration |
| `messages` | Received/sent WebSocket messages, file uploads, queue operations |
| `state` | Signing, backup, compression, encryption, validation |
| `performance` | Monitoring init, alerts, optimization suggestions |
| `rooms` | Room create/join/leave, emit, broadcast |
| `websocket` | Connection open/close/cleanup, pool management, auth |

## Type Definition

```typescript
type LiveLogCategory = 'lifecycle' | 'messages' | 'state' | 'performance' | 'rooms' | 'websocket'

type LiveLogConfig = boolean | readonly LiveLogCategory[]
```

Use `as const` on arrays to get readonly tuple type:

```typescript
// ✅ Works with as const
static logging = ['lifecycle', 'messages'] as const
```

## API (Framework Internal)

These functions are used by the framework — app developers only need `static logging` or env vars:

```typescript
import { liveLog, liveWarn, registerComponentLogging, unregisterComponentLogging } from '@core/server/live'

// Log gated by component config (console) + always forwarded to debug panel
liveLog('lifecycle', componentId, '🚀 Mounted component')
liveLog('rooms', componentId, `📡 Joined room '${roomId}'`)

// Warn-level (for perf alerts, non-error warnings)
liveWarn('performance', componentId, '⚠️ Slow render detected')

// Register/unregister (called on mount/unmount by ComponentRegistry)
registerComponentLogging(componentId, config)
unregisterComponentLogging(componentId)
```

## How It Works

1. **Mount**: `ComponentRegistry` reads `static logging` from the class and calls `registerComponentLogging(componentId, config)`
2. **Runtime**: All `liveLog()`/`liveWarn()` calls:
   - Forward to the Live Debugger as `LOG` events (when `DEBUG_LIVE=true`)
   - Check the registry before emitting to console (when `LIVE_LOGGING` or `static logging` is active)
3. **Unmount**: `unregisterComponentLogging(componentId)` removes the entry
4. **Global logs**: Fall back to `LIVE_LOGGING` env var when `componentId` is `null`

## Examples

### Debug via Panel (Recommended)

```bash
# .env
DEBUG_LIVE=true
# No LIVE_LOGGING needed — console stays clean
```

Open the debug panel WebSocket at `/api/live/debug/ws` to see all events in real-time.

### Debug a Specific Component (Console)

```typescript
// Only this component will show console logs
export class LiveChat extends LiveComponent<typeof LiveChat.defaultState> {
  static componentName = 'LiveChat'
  static logging = true  // See everything for this component in console
}

// All other components remain silent in console
export class LiveCounter extends LiveComponent<typeof LiveCounter.defaultState> {
  static componentName = 'LiveCounter'
  // No static logging → silent in console
}
```

### Monitor Only Room Activity (Console)

```typescript
export class LiveChat extends LiveComponent<typeof LiveChat.defaultState> {
  static componentName = 'LiveChat'
  static logging = ['rooms'] as const  // Only room events in console
}
```

### Production: Silent Everywhere

```bash
# .env (no LIVE_LOGGING, no DEBUG_LIVE)
# Console: silent
# Debug panel: disabled
```

## Files Reference

| File | Purpose |
|------|---------|
| `core/server/live/LiveLogger.ts` | Logger implementation, registry, shouldLog logic, debugger forwarding |
| `core/server/live/LiveDebugger.ts` | Debug event bus, `LOG` event type, debug client management |
| `core/server/live/ComponentRegistry.ts` | Reads `static logging` on mount/unmount, uses `liveLog` |
| `core/server/live/websocket-plugin.ts` | Uses `liveLog` for WebSocket events |
| `core/server/live/WebSocketConnectionManager.ts` | Uses `liveLog`/`liveWarn` for connection pool management |
| `core/server/live/FileUploadManager.ts` | Uses `liveLog`/`liveWarn` for upload operations |
| `core/server/live/StateSignature.ts` | Uses `liveLog`/`liveWarn` for state operations |
| `core/server/live/LiveRoomManager.ts` | Uses `liveLog` for room lifecycle |
| `core/server/live/LiveComponentPerformanceMonitor.ts` | Uses `liveLog`/`liveWarn` for perf |
| `config/system/runtime.config.ts` | `DEBUG_LIVE` env var config |
| `core/types/types.ts` | `LiveComponent` base class with `static logging` property |

## Critical Rules

**ALWAYS:**
- Use `as const` on logging arrays for type safety
- Keep components silent by default (no `static logging`)
- Use `DEBUG_LIVE=true` for debugging instead of `static logging` on components
- Use specific categories instead of `true` when possible

**NEVER:**
- Use `console.log` directly in Live Component code — use `liveLog()`
- Forget that `console.error` is always visible (not gated)
- Enable `LIVE_LOGGING` or `DEBUG_LIVE` in production

## Related

- [Live Components](./live-components.md) - Base component system
- [Live Rooms](./live-rooms.md) - Room system (logged under `rooms` category)
- [Environment Variables](../config/environment-vars.md) - `LIVE_LOGGING` and `DEBUG_LIVE` reference
