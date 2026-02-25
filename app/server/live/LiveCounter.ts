// LiveCounter - Contador compartilhado usando Room Events

import { LiveComponent, type FluxStackWebSocket } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { CounterDemo as _Client } from '@client/src/live/CounterDemo'

export class LiveCounter extends LiveComponent<typeof LiveCounter.defaultState> {
  static componentName = 'LiveCounter'
  static publicActions = ['increment', 'decrement', 'reset'] as const
  static defaultState = {
    count: 0,
    lastUpdatedBy: null as string | null,
    connectedUsers: 0
  }
  protected roomType = 'counter'

  constructor(initialState: Partial<typeof LiveCounter.defaultState> = {}, ws: FluxStackWebSocket, options?: { room?: string; userId?: string }) {
    super(initialState, ws, options)

    this.onRoomEvent<{ count: number; userId: string }>('COUNT_CHANGED', (data) => {
      this.setState({ count: data.count, lastUpdatedBy: data.userId })
    })

    this.onRoomEvent<{ connectedUsers: number }>('USER_COUNT_CHANGED', (data) => {
      this.setState({ connectedUsers: data.connectedUsers })
    })

    this.notifyUserJoined()
  }

  private notifyUserJoined() {
    const newCount = this.state.connectedUsers + 1
    this.emitRoomEventWithState('USER_COUNT_CHANGED', { connectedUsers: newCount }, { connectedUsers: newCount })
  }

  async increment() {
    const newCount = this.state.count + 1
    this.emitRoomEventWithState('COUNT_CHANGED', { count: newCount, userId: this.userId || 'anonymous' }, {
      count: newCount,
      lastUpdatedBy: this.userId || 'anonymous'
    })
    return { success: true, count: newCount }
  }

  async decrement() {
    const newCount = this.state.count - 1
    this.emitRoomEventWithState('COUNT_CHANGED', { count: newCount, userId: this.userId || 'anonymous' }, {
      count: newCount,
      lastUpdatedBy: this.userId || 'anonymous'
    })
    return { success: true, count: newCount }
  }

  async reset() {
    this.emitRoomEventWithState('COUNT_CHANGED', { count: 0, userId: this.userId || 'anonymous' }, {
      count: 0,
      lastUpdatedBy: this.userId || 'anonymous'
    })
    return { success: true, count: 0 }
  }

  destroy() {
    const newCount = Math.max(0, this.state.connectedUsers - 1)
    this.emitRoomEvent('USER_COUNT_CHANGED', { connectedUsers: newCount })
    super.destroy()
  }
}
