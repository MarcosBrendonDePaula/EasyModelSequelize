// LiveLocalCounter - Contador sem eventos de sala

import { LiveComponent } from '@core/types/types'

// Componente Cliente (Ctrl+Click para navegar)
import type { CounterDemo as _Client } from '@client/src/live/CounterDemo'

export class LiveLocalCounter extends LiveComponent<typeof LiveLocalCounter.defaultState> {
  static componentName = 'LiveLocalCounter'
  static publicActions = ['increment', 'decrement', 'reset'] as const
  static defaultState = {
    count: 0,
    clicks: 0
  }

  // Declarar propriedades (criadas dinamicamente pelo LiveComponent)
  declare count: number
  declare clicks: number

  // 🔥 Agora usa this.count diretamente!
  async increment() {
    this.count++
    this.clicks++
    return { success: true, count: this.count }
  }

  async decrement() {
    this.count--
    this.clicks++
    return { success: true, count: this.count }
  }

  async reset() {
    this.count = 0
    this.clicks++
    return { success: true, count: 0 }
  }
}
