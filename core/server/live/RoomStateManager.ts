// 🔥 FluxStack Live - Room State Manager (In-memory storage per room)

type RoomStateData = Record<string, any>

interface RoomInfo {
  state: RoomStateData
  componentCount: number
  createdAt: number
  lastUpdate: number
}

export function createTypedRoomState<TRoomTypes extends Record<string, RoomStateData>>() {
  const rooms = new Map<string, RoomInfo>()
  const getKey = (type: string, roomId: string) => `${type}:${roomId}`

  return {
    get<K extends keyof TRoomTypes>(type: K, roomId: string, defaultState: TRoomTypes[K]): TRoomTypes[K] {
      const key = getKey(type as string, roomId)
      const room = rooms.get(key)

      if (room) return room.state as TRoomTypes[K]

      rooms.set(key, { state: defaultState, componentCount: 0, createdAt: Date.now(), lastUpdate: Date.now() })
      return defaultState
    },

    update<K extends keyof TRoomTypes>(type: K, roomId: string, updates: Partial<TRoomTypes[K]>): TRoomTypes[K] {
      const key = getKey(type as string, roomId)
      const room = rooms.get(key)

      if (room) {
        room.state = { ...room.state, ...updates }
        room.lastUpdate = Date.now()
        return room.state as TRoomTypes[K]
      }

      const newState = updates as TRoomTypes[K]
      rooms.set(key, { state: newState, componentCount: 0, createdAt: Date.now(), lastUpdate: Date.now() })
      return newState
    },

    set<K extends keyof TRoomTypes>(type: K, roomId: string, state: TRoomTypes[K]): void {
      const key = getKey(type as string, roomId)
      const room = rooms.get(key)

      if (room) {
        room.state = state
        room.lastUpdate = Date.now()
      } else {
        rooms.set(key, { state, componentCount: 0, createdAt: Date.now(), lastUpdate: Date.now() })
      }
    },

    join<K extends keyof TRoomTypes>(type: K, roomId: string): void {
      const room = rooms.get(getKey(type as string, roomId))
      if (room) room.componentCount++
    },

    leave<K extends keyof TRoomTypes>(type: K, roomId: string): void {
      const key = getKey(type as string, roomId)
      const room = rooms.get(key)
      if (room) {
        room.componentCount--
        if (room.componentCount <= 0) {
          setTimeout(() => {
            const current = rooms.get(key)
            if (current && current.componentCount <= 0) {
              rooms.delete(key)
            }
          }, 5 * 60 * 1000)
        }
      }
    },

    has<K extends keyof TRoomTypes>(type: K, roomId: string): boolean {
      return rooms.has(getKey(type as string, roomId))
    },

    delete<K extends keyof TRoomTypes>(type: K, roomId: string): boolean {
      return rooms.delete(getKey(type as string, roomId))
    },

    getStats(): { totalRooms: number; rooms: Record<string, { componentCount: number; stateKeys: string[] }> } {
      const roomStats: Record<string, { componentCount: number; stateKeys: string[] }> = {}
      for (const [key, info] of rooms) {
        roomStats[key] = { componentCount: info.componentCount, stateKeys: Object.keys(info.state) }
      }
      return { totalRooms: rooms.size, rooms: roomStats }
    }
  }
}

class RoomStateManager {
  private rooms = new Map<string, RoomInfo>()

  get<T extends RoomStateData>(roomId: string, defaultState?: T): T {
    const room = this.rooms.get(roomId)
    if (room) return room.state as T

    if (defaultState) {
      this.rooms.set(roomId, { state: defaultState, componentCount: 0, createdAt: Date.now(), lastUpdate: Date.now() })
      return defaultState
    }

    return {} as T
  }

  update<T extends RoomStateData>(roomId: string, updates: Partial<T>): T {
    const room = this.rooms.get(roomId)

    if (room) {
      room.state = { ...room.state, ...updates }
      room.lastUpdate = Date.now()
      return room.state as T
    }

    const newState = updates as T
    this.rooms.set(roomId, { state: newState, componentCount: 0, createdAt: Date.now(), lastUpdate: Date.now() })
    return newState
  }

  set<T extends RoomStateData>(roomId: string, state: T): void {
    const room = this.rooms.get(roomId)

    if (room) {
      room.state = state
      room.lastUpdate = Date.now()
    } else {
      this.rooms.set(roomId, { state, componentCount: 0, createdAt: Date.now(), lastUpdate: Date.now() })
    }
  }

  join(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (room) room.componentCount++
  }

  leave(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (room) {
      room.componentCount--
      if (room.componentCount <= 0) {
        setTimeout(() => {
          const current = this.rooms.get(roomId)
          if (current && current.componentCount <= 0) {
            this.rooms.delete(roomId)
          }
        }, 5 * 60 * 1000)
      }
    }
  }

  has(roomId: string): boolean {
    return this.rooms.has(roomId)
  }

  delete(roomId: string): boolean {
    return this.rooms.delete(roomId)
  }

  getStats(): { totalRooms: number; rooms: Record<string, { componentCount: number; stateKeys: string[] }> } {
    const rooms: Record<string, { componentCount: number; stateKeys: string[] }> = {}
    for (const [roomId, info] of this.rooms) {
      rooms[roomId] = { componentCount: info.componentCount, stateKeys: Object.keys(info.state) }
    }
    return { totalRooms: this.rooms.size, rooms }
  }
}

export const roomState = new RoomStateManager()

export type { RoomStateData, RoomInfo }
