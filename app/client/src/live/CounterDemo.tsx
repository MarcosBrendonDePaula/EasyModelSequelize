// 🔥 CounterDemo - Contador isolado e compartilhado

import { useMemo } from 'react'
import { Live } from '@/core/client'
import { LiveCounter } from '@server/live/LiveCounter'
import { LiveLocalCounter } from '@server/live/LiveLocalCounter'

export function CounterDemo() {
  const isolatedRoom = useMemo(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `local-${crypto.randomUUID()}`
    }
    return `local-${Math.random().toString(36).slice(2)}`
  }, [])

  const sharedCounter = Live.use(LiveCounter, {
    room: 'global-counter',
    initialState: LiveCounter.defaultState
  })

  const isolatedCounter = Live.use(LiveCounter, {
    room: isolatedRoom,
    initialState: LiveCounter.defaultState,
    persistState: false
  })

  const localCounter = Live.use(LiveLocalCounter, {
    initialState: LiveLocalCounter.defaultState,
    persistState: false
  })
  
  const renderCounter = (
    title: string,
    description: string,
    counter: ReturnType<typeof Live.use>
  ) => {
    const handleIncrement = async () => {
      await counter.increment()
    }

    const handleDecrement = async () => {
      await counter.decrement()
    }

    const handleReset = async () => {
      await counter.reset()
    }

    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 max-w-md w-full flex flex-col">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center">
          {title}
        </h2>

        <p className="text-gray-400 text-xs sm:text-sm text-center mb-4 sm:mb-6">
          {description}
        </p>

        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            counter.$connected
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-red-500/20 text-red-300'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              counter.$connected ? 'bg-emerald-400' : 'bg-red-400'
            }`} />
            {counter.$connected ? 'Conectado' : 'Desconectado'}
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300">
            <span>👥</span>
            {counter.$state.connectedUsers} usuário(s)
          </div>
        </div>

        <div className="text-center mb-6 sm:mb-8 flex-1 flex flex-col justify-center">
          <div className="text-6xl sm:text-8xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            {counter.$state.count}
          </div>

          {counter.$state.lastUpdatedBy && (
            <p className="text-gray-500 text-sm mt-2">
              Última atualização: {counter.$state.lastUpdatedBy}
            </p>
          )}
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={handleDecrement}
            disabled={counter.$loading}
            className="w-14 h-14 flex items-center justify-center text-3xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl transition-all disabled:opacity-50"
          >
            −
          </button>

          <button
            onClick={handleReset}
            disabled={counter.$loading}
            className="px-6 h-14 flex items-center justify-center text-sm bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 text-gray-300 rounded-xl transition-all disabled:opacity-50"
          >
            Reset
          </button>

          <button
            onClick={handleIncrement}
            disabled={counter.$loading}
            className="w-14 h-14 flex items-center justify-center text-3xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl transition-all disabled:opacity-50"
          >
            +
          </button>
        </div>

        {counter.$loading && (
          <div className="flex justify-center mt-4">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-gray-500 text-xs text-center">
            ✨ Usando <code className="text-purple-400">Room Events</code>
          </p>
        </div>
      </div>
    )
  }

  const renderLocalCounter = () => {
    const handleIncrement = async () => {
      await localCounter.increment()
    }
    const handleDecrement = async () => {
      await localCounter.decrement()
    }
    const handleReset = async () => {
      await localCounter.reset()
    }

    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 max-w-md w-full flex flex-col">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center">
          Contador Local (sem Room)
        </h2>
        <p className="text-gray-400 text-xs sm:text-sm text-center mb-4 sm:mb-6">
          Estado local do componente, sem eventos de sala.
        </p>

        <div className="text-center mb-6 sm:mb-8 flex-1 flex flex-col justify-center">
          <div className="text-6xl sm:text-8xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
            {localCounter.$state.count}
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={handleDecrement}
            disabled={localCounter.$loading}
            className="w-14 h-14 flex items-center justify-center text-3xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl transition-all disabled:opacity-50"
          >
            −
          </button>

          <button
            onClick={handleReset}
            disabled={localCounter.$loading}
            className="px-6 h-14 flex items-center justify-center text-sm bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 text-gray-300 rounded-xl transition-all disabled:opacity-50"
          >
            Reset
          </button>

          <button
            onClick={handleIncrement}
            disabled={localCounter.$loading}
            className="w-14 h-14 flex items-center justify-center text-3xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl transition-all disabled:opacity-50"
          >
            +
          </button>
        </div>

        {localCounter.$loading && (
          <div className="flex justify-center mt-4">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch justify-center">
      {renderLocalCounter()}
      {renderCounter(
        'Contador Isolado',
        'Cada aba tem seu próprio valor (room único).',
        isolatedCounter
      )}
      {renderCounter(
        'Contador Compartilhado',
        'Abra em várias abas - todos veem o mesmo valor!',
        sharedCounter
      )}
    </div>
  )
}
