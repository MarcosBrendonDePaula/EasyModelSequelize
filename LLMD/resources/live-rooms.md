# Live Room System

**Version:** 1.11.0 | **Updated:** 2025-02-09

## Quick Facts

- Server-side room management for real-time communication
- Multiple rooms per component supported
- Events propagate to all room members automatically
- HTTP API integration for external systems (webhooks, bots)
- Type-safe event handling with TypeScript

## Overview

The Room System enables real-time communication between Live Components. It's **server-side first**, meaning:

1. Server controls room membership and event routing
2. Each component updates its own client via `setState()`
3. External systems can emit events via HTTP API

## Core API

### Server-Side ($room)

```typescript
// app/server/live/MyComponent.ts
import { LiveComponent } from '@core/types/types'

export class MyComponent extends LiveComponent<typeof defaultState> {

  // Join a room
  this.$room('room-id').join()

  // Leave a room
  this.$room('room-id').leave()

  // Emit event to all members (except self)
  this.$room('room-id').emit('event-name', { data: 'value' })

  // Listen for events from other members
  this.$room('room-id').on('event-name', (data) => {
    // Handle event, update local state
    this.setState({ ... })
  })

  // Get room state
  const state = this.$room('room-id').state

  // Set room state (broadcasts to all)
  this.$room('room-id').setState({ key: 'value' })

  // List all joined rooms
  const rooms = this.$rooms // ['room-1', 'room-2']
}
```

### Default Room

If component has a default room (via `options.room`), you can use shorthand:

```typescript
// Using default room
this.$room.emit('event', data)
this.$room.on('event', handler)

// Equivalent to:
this.$room('default-room-id').emit('event', data)
```

## Complete Example: Chat Component

### Server Component

```typescript
// app/server/live/LiveRoomChat.ts
import { LiveComponent } from '@core/types/types'

export interface ChatMessage {
  id: string
  user: string
  text: string
  timestamp: number
}

export const defaultState = {
  username: '',
  activeRoom: null as string | null,
  rooms: [] as { id: string; name: string }[],
  messages: {} as Record<string, ChatMessage[]>,
  typingUsers: {} as Record<string, string[]>
}

export class LiveRoomChat extends LiveComponent<typeof defaultState> {
  static defaultState = defaultState

  constructor(initialState: Partial<typeof defaultState>, ws: any, options?: { room?: string; userId?: string }) {
    super({ ...defaultState, ...initialState }, ws, options)
  }

  // Join a chat room
  async joinRoom(payload: { roomId: string; roomName?: string }) {
    const { roomId, roomName } = payload

    // 1. Join the room on server
    this.$room(roomId).join()

    // 2. Listen for messages from OTHER users
    this.$room(roomId).on('message:new', (msg: ChatMessage) => {
      this.addMessageToState(roomId, msg)
    })

    // 3. Listen for typing events
    this.$room(roomId).on('user:typing', (data: { user: string; typing: boolean }) => {
      this.updateTypingUsers(roomId, data.user, data.typing)
    })

    // 4. Update local state (syncs to frontend)
    this.setState({
      activeRoom: roomId,
      rooms: [...this.state.rooms, { id: roomId, name: roomName || roomId }],
      messages: { ...this.state.messages, [roomId]: [] },
      typingUsers: { ...this.state.typingUsers, [roomId]: [] }
    })

    return { success: true, roomId }
  }

  // Send message
  async sendMessage(payload: { text: string }) {
    const roomId = this.state.activeRoom
    if (!roomId) throw new Error('No active room')

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      user: this.state.username,
      text: payload.text,
      timestamp: Date.now()
    }

    // 1. Add to MY state (syncs to MY frontend)
    this.addMessageToState(roomId, message)

    // 2. Emit to OTHERS (they receive via $room.on)
    this.$room(roomId).emit('message:new', message)

    return { success: true, message }
  }

  // Helper: add message to state
  private addMessageToState(roomId: string, msg: ChatMessage) {
    const messages = this.state.messages[roomId] || []
    this.setState({
      messages: {
        ...this.state.messages,
        [roomId]: [...messages, msg].slice(-100) // Keep last 100
      }
    })
  }

  // Helper: update typing users
  private updateTypingUsers(roomId: string, user: string, typing: boolean) {
    const current = this.state.typingUsers[roomId] || []
    const updated = typing
      ? [...current.filter(u => u !== user), user]
      : current.filter(u => u !== user)

    this.setState({
      typingUsers: { ...this.state.typingUsers, [roomId]: updated }
    })
  }

  // Start typing indicator
  async startTyping() {
    const roomId = this.state.activeRoom
    if (!roomId) return { success: false }

    this.$room(roomId).emit('user:typing', {
      user: this.state.username,
      typing: true
    })

    return { success: true }
  }

  // Leave room
  async leaveRoom(payload: { roomId: string }) {
    const { roomId } = payload

    this.$room(roomId).leave()

    const { [roomId]: _, ...restMessages } = this.state.messages
    const { [roomId]: __, ...restTyping } = this.state.typingUsers

    this.setState({
      rooms: this.state.rooms.filter(r => r.id !== roomId),
      activeRoom: this.state.activeRoom === roomId ? null : this.state.activeRoom,
      messages: restMessages,
      typingUsers: restTyping
    })

    return { success: true }
  }
}
```

### Frontend Component

```typescript
// app/client/src/live/RoomChatDemo.tsx
import { Live } from '@/core/client'
import { LiveRoomChat, defaultState } from '@server/live/LiveRoomChat'

export function RoomChatDemo() {
  const [text, setText] = useState('')

  // Connect to Live Component
  const chat = Live.use(LiveRoomChat, {
    initialState: { ...defaultState, username: 'User123' }
  })

  // State comes directly from server
  const activeRoom = chat.$state.activeRoom
  const messages = activeRoom ? (chat.$state.messages[activeRoom] || []) : []
  const typingUsers = activeRoom ? (chat.$state.typingUsers[activeRoom] || []) : []

  // Join room
  const handleJoinRoom = async (roomId: string) => {
    await chat.joinRoom({ roomId, roomName: roomId })
  }

  // Send message
  const handleSend = async () => {
    if (!text.trim()) return
    await chat.sendMessage({ text })
    setText('')
  }

  return (
    <div>
      {/* Room list */}
      <div>
        {['geral', 'tech', 'random'].map(roomId => (
          <button key={roomId} onClick={() => handleJoinRoom(roomId)}>
            {roomId} {chat.$rooms.includes(roomId) && '(joined)'}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div>
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.user}:</strong> {msg.text}
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div>{typingUsers.join(', ')} typing...</div>
      )}

      {/* Input */}
      <input
        value={text}
        onChange={e => {
          setText(e.target.value)
          chat.startTyping()
        }}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  )
}
```

## HTTP API Integration

Send messages from external systems via REST API:

### Routes

```typescript
// app/server/routes/room.routes.ts
import { Elysia, t } from 'elysia'
import { liveRoomManager } from '@core/server/live/LiveRoomManager'

export const roomRoutes = new Elysia({ prefix: '/rooms' })

  // Send message to room
  .post('/:roomId/messages', ({ params, body }) => {
    const message = {
      id: `api-${Date.now()}`,
      user: body.user || 'API Bot',
      text: body.text,
      timestamp: Date.now()
    }

    const notified = liveRoomManager.emitToRoom(
      params.roomId,
      'message:new',
      message
    )

    return { success: true, message, notified }
  }, {
    params: t.Object({ roomId: t.String() }),
    body: t.Object({
      user: t.Optional(t.String()),
      text: t.String()
    })
  })

  // Emit custom event
  .post('/:roomId/emit', ({ params, body }) => {
    const notified = liveRoomManager.emitToRoom(
      params.roomId,
      body.event,
      body.data
    )
    return { success: true, notified }
  }, {
    params: t.Object({ roomId: t.String() }),
    body: t.Object({
      event: t.String(),
      data: t.Any()
    })
  })

  // Get stats
  .get('/stats', () => liveRoomManager.getStats())
```

### Usage Examples

```bash
# Send message via curl
curl -X POST http://localhost:3000/api/rooms/geral/messages \
  -H "Content-Type: application/json" \
  -d '{"user": "Webhook Bot", "text": "New deployment completed!"}'

# Emit custom event
curl -X POST http://localhost:3000/api/rooms/tech/emit \
  -H "Content-Type: application/json" \
  -d '{"event": "notification", "data": {"type": "alert", "message": "Server restarted"}}'

# Get room stats
curl http://localhost:3000/api/rooms/stats
```

## Event Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend A │     │   Server    │     │  Frontend B │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ sendMessage()     │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ 1. setState()     │
       │                   │    (sync to A)    │
       │<──────────────────│                   │
       │                   │                   │
       │                   │ 2. $room.emit()   │
       │                   │    (to others)    │
       │                   │                   │
       │                   │ 3. B's handler    │
       │                   │    receives event │
       │                   │                   │
       │                   │ 4. B's setState() │
       │                   │    (sync to B)    │
       │                   │──────────────────>│
       │                   │                   │
```

## Room Manager API

Direct access to room manager for advanced use cases:

```typescript
import { liveRoomManager } from '@core/server/live/LiveRoomManager'

// Join component to room
liveRoomManager.joinRoom(componentId, roomId, ws, initialState)

// Leave room
liveRoomManager.leaveRoom(componentId, roomId)

// Emit event to room
const count = liveRoomManager.emitToRoom(roomId, event, data, excludeComponentId)

// Update room state
liveRoomManager.setRoomState(roomId, updates, excludeComponentId)

// Get room state
const state = liveRoomManager.getRoomState(roomId)

// Check membership
const isIn = liveRoomManager.isInRoom(componentId, roomId)

// Get component's rooms
const rooms = liveRoomManager.getComponentRooms(componentId)

// Cleanup on disconnect
liveRoomManager.cleanupComponent(componentId)

// Get statistics
const stats = liveRoomManager.getStats()
```

## Room Event Bus

For server-side event handling:

```typescript
import { roomEvents } from '@core/server/live/RoomEventBus'

// Subscribe to events
const unsubscribe = roomEvents.on(
  'room',      // type
  'geral',     // roomId
  'message',   // event
  componentId, // subscriber
  (data) => {  // handler
    console.log('Received:', data)
  }
)

// Emit events
roomEvents.emit('room', 'geral', 'message', { text: 'Hello' }, excludeId)

// Cleanup
roomEvents.unsubscribeAll(componentId)
roomEvents.clearRoom('room', 'geral')

// Stats
const stats = roomEvents.getStats()
```

## Use Cases

| Use Case | Description |
|----------|-------------|
| **Chat** | Multi-room chat with typing indicators |
| **Notifications** | Send alerts to specific groups |
| **Collaboration** | Real-time document editing |
| **Gaming** | Multiplayer game state sync |
| **Dashboards** | Live metrics and alerts |
| **Webhooks** | External events to rooms |
| **Presence** | Online/offline status |

## Best Practices

**DO:**
- Use `setState()` to sync state to your own frontend
- Use `$room.emit()` to notify other components
- Register handlers with `$room.on()` in `joinRoom`
- Clean up with `$room.leave()` when leaving
- Use HTTP API for external integrations

**DON'T:**
- Rely on `$room.emit()` to update your own frontend
- Forget to handle events from other users
- Store non-serializable data in room state
- Skip error handling in event handlers

## Files Reference

| File | Purpose |
|------|---------|
| `core/server/live/LiveRoomManager.ts` | Room membership and broadcasting |
| `core/server/live/RoomEventBus.ts` | Server-side event pub/sub |
| `core/types/types.ts` | `$room` and `$rooms` implementation |
| `app/server/routes/room.routes.ts` | HTTP API for rooms |

## Related

- [Live Components](./live-components.md) - Base component system
- [Routes with Eden Treaty](./routes-eden.md) - HTTP API patterns
- [Type Safety](../patterns/type-safety.md) - TypeScript patterns
