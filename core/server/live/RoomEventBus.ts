// 🔥 FluxStack Live - Room Event Bus (Pub/Sub server-side)

type EventHandler<T = any> = (data: T) => void

interface RoomSubscription {
  roomType: string
  roomId: string
  event: string
  handler: EventHandler
  componentId: string
}

export function createTypedRoomEventBus<TRoomEvents extends Record<string, Record<string, any>>>() {
  const subscriptions = new Map<string, Set<RoomSubscription>>()

  const getKey = (roomType: string, roomId: string, event: string) =>
    `${roomType}:${roomId}:${event}`

  const getRoomKey = (roomType: string, roomId: string) =>
    `${roomType}:${roomId}`

  return {
    on<K extends keyof TRoomEvents, E extends keyof TRoomEvents[K]>(
      roomType: K,
      roomId: string,
      event: E,
      componentId: string,
      handler: EventHandler<TRoomEvents[K][E]>
    ): () => void {
      const key = getKey(roomType as string, roomId, event as string)

      if (!subscriptions.has(key)) {
        subscriptions.set(key, new Set())
      }

      const subscription: RoomSubscription = {
        roomType: roomType as string,
        roomId,
        event: event as string,
        handler,
        componentId
      }

      subscriptions.get(key)!.add(subscription)

      return () => {
        subscriptions.get(key)?.delete(subscription)
        if (subscriptions.get(key)?.size === 0) {
          subscriptions.delete(key)
        }
      }
    },

    emit<K extends keyof TRoomEvents, E extends keyof TRoomEvents[K]>(
      roomType: K,
      roomId: string,
      event: E,
      data: TRoomEvents[K][E],
      excludeComponentId?: string
    ): number {
      const key = getKey(roomType as string, roomId, event as string)
      const subs = subscriptions.get(key)

      if (!subs || subs.size === 0) return 0

      let notified = 0
      for (const sub of subs) {
        if (excludeComponentId && sub.componentId === excludeComponentId) continue

        try {
          sub.handler(data)
          notified++
        } catch (error) {
          console.error(`❌ RoomEventBus error [${key}]:`, error)
        }
      }

      return notified
    },

    unsubscribeAll(componentId: string): number {
      let removed = 0

      for (const [key, subs] of subscriptions) {
        for (const sub of subs) {
          if (sub.componentId === componentId) {
            subs.delete(sub)
            removed++
          }
        }
        if (subs.size === 0) {
          subscriptions.delete(key)
        }
      }

      return removed
    },

    clearRoom<K extends keyof TRoomEvents>(roomType: K, roomId: string): number {
      const prefix = getRoomKey(roomType as string, roomId)
      let removed = 0

      for (const key of subscriptions.keys()) {
        if (key.startsWith(prefix)) {
          removed += subscriptions.get(key)?.size ?? 0
          subscriptions.delete(key)
        }
      }

      return removed
    },

    getStats(): { totalSubscriptions: number; rooms: Record<string, { events: Record<string, number> }> } {
      const rooms: Record<string, { events: Record<string, number> }> = {}
      let total = 0

      for (const [key, subs] of subscriptions) {
        const [roomType, roomId, event] = key.split(':')
        const roomKey = `${roomType}:${roomId}`

        if (!rooms[roomKey]) {
          rooms[roomKey] = { events: {} }
        }

        rooms[roomKey].events[event] = subs.size
        total += subs.size
      }

      return { totalSubscriptions: total, rooms }
    }
  }
}

class RoomEventBus {
  private subscriptions = new Map<string, Set<RoomSubscription>>()

  private getKey(roomType: string, roomId: string, event: string): string {
    return `${roomType}:${roomId}:${event}`
  }

  on(roomType: string, roomId: string, event: string, componentId: string, handler: EventHandler): () => void {
    const key = this.getKey(roomType, roomId, event)

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }

    const subscription: RoomSubscription = { roomType, roomId, event, handler, componentId }
    this.subscriptions.get(key)!.add(subscription)

    return () => {
      this.subscriptions.get(key)?.delete(subscription)
      if (this.subscriptions.get(key)?.size === 0) {
        this.subscriptions.delete(key)
      }
    }
  }

  emit(roomType: string, roomId: string, event: string, data: any, excludeComponentId?: string): number {
    const key = this.getKey(roomType, roomId, event)
    const subs = this.subscriptions.get(key)

    if (!subs || subs.size === 0) return 0

    let notified = 0
    for (const sub of subs) {
      if (excludeComponentId && sub.componentId === excludeComponentId) continue

      try {
        sub.handler(data)
        notified++
      } catch (error) {
        console.error(`❌ RoomEventBus error [${key}]:`, error)
      }
    }

    return notified
  }

  unsubscribeAll(componentId: string): number {
    let removed = 0

    for (const [key, subs] of this.subscriptions) {
      for (const sub of subs) {
        if (sub.componentId === componentId) {
          subs.delete(sub)
          removed++
        }
      }
      if (subs.size === 0) {
        this.subscriptions.delete(key)
      }
    }

    return removed
  }

  clearRoom(roomType: string, roomId: string): number {
    const prefix = `${roomType}:${roomId}`
    let removed = 0

    for (const key of this.subscriptions.keys()) {
      if (key.startsWith(prefix)) {
        removed += this.subscriptions.get(key)?.size ?? 0
        this.subscriptions.delete(key)
      }
    }

    return removed
  }

  getStats() {
    const rooms: Record<string, { events: Record<string, number> }> = {}
    let total = 0

    for (const [key, subs] of this.subscriptions) {
      const [roomType, roomId, event] = key.split(':')
      const roomKey = `${roomType}:${roomId}`

      if (!rooms[roomKey]) {
        rooms[roomKey] = { events: {} }
      }

      rooms[roomKey].events[event] = subs.size
      total += subs.size
    }

    return { totalSubscriptions: total, rooms }
  }
}

export const roomEvents = new RoomEventBus()

export type { EventHandler, RoomSubscription }
