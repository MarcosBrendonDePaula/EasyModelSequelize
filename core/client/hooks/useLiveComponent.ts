// 🔥 FluxStack Live Component Hook - Proxy-based State Access
// Acesse estado do servidor como se fossem variáveis locais (estilo Livewire)
//
// Uso:
//   const clock = useLiveComponent('LiveClock', { currentTime: '', format: '24h' })
//
//   // Lê estado como variável normal
//   console.log(clock.currentTime)  // "14:30:25"
//
//   // Escreve estado - sincroniza automaticamente com servidor
//   clock.format = '12h'
//
//   // Chama actions diretamente
//   await clock.setTimeFormat({ format: '24h' })
//
//   // Metadata via $ prefix
//   clock.$connected  // boolean
//   clock.$loading    // boolean
//   clock.$error      // string | null

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useLiveComponents } from '../LiveComponentsProvider'
import { StateValidator } from './state-validator'
import { RoomManager } from './useRoomProxy'
import type { RoomProxy, RoomServerMessage } from './useRoomProxy'
import type {
  HybridState,
  HybridComponentOptions,
  WebSocketMessage,
  WebSocketResponse
} from '@core/types/types'

// ===== Tipos =====

// Opções para $field()
export interface FieldOptions {
  /** Quando sincronizar: 'change' (debounced), 'blur' (ao sair), 'manual' (só $sync) */
  syncOn?: 'change' | 'blur' | 'manual'
  /** Debounce em ms (só para syncOn: 'change'). Default: 150 */
  debounce?: number
  /** Transformar valor antes de sincronizar */
  transform?: (value: any) => any
}

// Retorno do $field()
export interface FieldBinding {
  value: any
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onBlur: () => void
  name: string
}

export interface LiveComponentProxy<
  TState extends Record<string, any>,
  TRoomState = any,
  TRoomEvents extends Record<string, any> = Record<string, any>
> {
  // Propriedades de estado são acessadas diretamente: proxy.propertyName

  // Metadata ($ prefix)
  readonly $state: TState
  readonly $connected: boolean
  readonly $loading: boolean
  readonly $error: string | null
  readonly $status: 'synced' | 'disconnected' | 'connecting' | 'reconnecting' | 'loading' | 'mounting' | 'error'
  readonly $componentId: string | null
  readonly $dirty: boolean
  /** Whether the WebSocket connection is authenticated on the server */
  readonly $authenticated: boolean

  // Methods
  $call: (action: string, payload?: any) => Promise<void>
  $callAndWait: <R = any>(action: string, payload?: any, timeout?: number) => Promise<R>
  $mount: () => Promise<void>
  $unmount: () => Promise<void>
  $refresh: () => Promise<void>
  $set: <K extends keyof TState>(key: K, value: TState[K]) => Promise<void>

  /** Bind de campo com controle de sincronização */
  $field: <K extends keyof TState>(key: K, options?: FieldOptions) => FieldBinding

  /** Sincroniza todos os campos pendentes (para syncOn: 'manual') */
  $sync: () => Promise<void>

  /** Registra handler para broadcasts recebidos de outros usuários (sem tipagem) */
  $onBroadcast: (handler: (type: string, data: any) => void) => void

  /** Atualiza estado local diretamente (para processar broadcasts) */
  $updateLocal: (updates: Partial<TState>) => void

  /**
   * Sistema de salas - acessa sala padrão ou específica
   * @example
   * // Sala padrão (definida em options.room)
   * component.$room.emit('typing', { user: 'João' })
   * component.$room.on('message:new', handler)
   *
   * // Sala específica
   * component.$room('sala-vip').join()
   * component.$room('sala-vip').emit('typing', { user: 'João' })
   * component.$room('sala-vip').leave()
   */
  readonly $room: RoomProxy<TRoomState, TRoomEvents>

  /** Lista de IDs das salas que está participando */
  readonly $rooms: string[]
}

// Helper type para criar union de broadcasts
type BroadcastEvent<T extends Record<string, any>> = {
  [K in keyof T]: { type: K; data: T[K] }
}[keyof T]

// Proxy com broadcasts tipados
export interface LiveComponentProxyWithBroadcasts<
  TState extends Record<string, any>,
  TBroadcasts extends Record<string, any> = Record<string, any>,
  TRoomState = any,
  TRoomEvents extends Record<string, any> = Record<string, any>
> extends Omit<LiveComponentProxy<TState, TRoomState, TRoomEvents>, '$onBroadcast'> {
  /**
   * Registra handler para broadcasts tipados
   * @example
   * // Uso com tipagem:
   * chat.$onBroadcast<LiveChatBroadcasts>((event) => {
   *   if (event.type === 'NEW_MESSAGE') {
   *     console.log(event.data.message) // ✅ Tipado como ChatMessage
   *   }
   * })
   */
  $onBroadcast: <T extends TBroadcasts = TBroadcasts>(
    handler: (event: BroadcastEvent<T>) => void
  ) => void
}

// Actions são qualquer método que não existe no state
export type LiveProxy<
  TState extends Record<string, any>,
  TActions = {},
  TRoomState = any,
  TRoomEvents extends Record<string, any> = Record<string, any>
> = TState & LiveComponentProxy<TState, TRoomState, TRoomEvents> & TActions

// Proxy com broadcasts tipados
export type LiveProxyWithBroadcasts<
  TState extends Record<string, any>,
  TActions = {},
  TBroadcasts extends Record<string, any> = Record<string, any>,
  TRoomState = any,
  TRoomEvents extends Record<string, any> = Record<string, any>
> = TState & LiveComponentProxyWithBroadcasts<TState, TBroadcasts, TRoomState, TRoomEvents> & TActions

export interface UseLiveComponentOptions extends HybridComponentOptions {
  /** Debounce para sets (ms). Default: 150 */
  debounce?: number
  /** Atualização otimista (UI atualiza antes do servidor confirmar). Default: true */
  optimistic?: boolean
  /** Modo de sync: 'immediate' | 'debounced' | 'manual'. Default: 'debounced' */
  syncMode?: 'immediate' | 'debounced' | 'manual'
  /** Persistir estado em localStorage (rehydration). Default: true */
  persistState?: boolean
  /**
   * Label de debug para identificar esta instância no Live Debugger.
   * Aparece no lugar do componentId no painel de debug.
   * Só tem efeito em development.
   *
   * @example
   * Live.use(LiveCounter, { debugLabel: 'Header Counter' })
   * Live.use(LiveChat, { debugLabel: 'Main Chat' })
   */
  debugLabel?: string
}

// ===== Propriedades Reservadas =====

const RESERVED_PROPS = new Set([
  '$state', '$connected', '$loading', '$error', '$status', '$componentId', '$dirty', '$authenticated',
  '$call', '$callAndWait', '$mount', '$unmount', '$refresh', '$set', '$onBroadcast', '$updateLocal',
  '$room', '$rooms', '$field', '$sync',
  'then', 'toJSON', 'valueOf', 'toString',
  Symbol.toStringTag, Symbol.iterator,
])

// ===== Persistência de Estado =====

const STORAGE_KEY_PREFIX = 'fluxstack_component_'
const STATE_MAX_AGE = 24 * 60 * 60 * 1000

interface PersistedState {
  componentName: string
  signedState: any
  room?: string
  userId?: string
  lastUpdate: number
}

const persistState = (enabled: boolean, name: string, signedState: any, room?: string, userId?: string) => {
  if (!enabled) return
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${name}`, JSON.stringify({
      componentName: name, signedState, room, userId, lastUpdate: Date.now()
    }))
  } catch {}
}

const getPersistedState = (enabled: boolean, name: string): PersistedState | null => {
  if (!enabled) return null
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${name}`)
    if (!stored) return null
    const state: PersistedState = JSON.parse(stored)
    if (Date.now() - state.lastUpdate > STATE_MAX_AGE) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${name}`)
      return null
    }
    return state
  } catch { return null }
}

const clearPersistedState = (enabled: boolean, name: string) => {
  if (!enabled) return
  try { localStorage.removeItem(`${STORAGE_KEY_PREFIX}${name}`) } catch {}
}

// ===== Zustand Store =====

interface Store<T> {
  state: T
  status: 'synced' | 'disconnected'
  updateState: (newState: T) => void
}

function createStore<T>(initialState: T) {
  return create<Store<T>>()(
    subscribeWithSelector((set) => ({
      state: initialState,
      status: 'disconnected',
      updateState: (newState: T) => set({ state: newState, status: 'synced' })
    }))
  )
}

// ===== Hook Principal =====

export function useLiveComponent<
  TState extends Record<string, any>,
  TActions = {},
  TBroadcasts extends Record<string, any> = Record<string, any>
>(
  componentName: string,
  initialState: TState,
  options: UseLiveComponentOptions = {}
): LiveProxyWithBroadcasts<TState, TActions, TBroadcasts> {
  const {
    debounce = 150,
    optimistic = true,
    syncMode = 'debounced',
    persistState: persistEnabled = true,
    fallbackToLocal = true,
    room,
    userId,
    autoMount = true,
    debug = false,
    onConnect,
    onMount,
    onDisconnect,
    onRehydrate,
    onError,
    onStateChange
  } = options

  // WebSocket context
  const {
    connected,
    authenticated: wsAuthenticated,
    sendMessage,
    sendMessageAndWait,
    registerComponent,
    unregisterComponent
  } = useLiveComponents()

  // Refs
  const instanceId = useRef(`${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const storeRef = useRef<ReturnType<typeof createStore<TState>> | null>(null)
  if (!storeRef.current) storeRef.current = createStore(initialState)
  const store = storeRef.current

  const pendingChanges = useRef<Map<keyof TState, { value: any; synced: boolean }>>(new Map())
  const debounceTimers = useRef<Map<keyof TState, NodeJS.Timeout>>(new Map())
  const localFieldValues = useRef<Map<keyof TState, any>>(new Map()) // Valores locais para campos com syncOn: blur/manual
  const fieldOptions = useRef<Map<keyof TState, FieldOptions>>(new Map()) // Opções por campo
  const [localVersion, setLocalVersion] = useState(0) // Força re-render quando valores locais mudam
  const mountedRef = useRef(false)
  const mountingRef = useRef(false)
  const rehydratingRef = useRef(false) // Previne múltiplas tentativas de rehydrate
  const lastComponentIdRef = useRef<string | null>(null)
  const broadcastHandlerRef = useRef<((event: { type: string; data: any }) => void) | null>(null)
  const roomMessageHandlers = useRef<Set<(msg: RoomServerMessage) => void>>(new Set())
  const roomManagerRef = useRef<RoomManager | null>(null)
  const mountFnRef = useRef<(() => Promise<void>) | null>(null)

  // State
  const stateData = store((s) => s.state)
  const updateState = store((s) => s.updateState)
  const [componentId, setComponentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rehydrating, setRehydrating] = useState(false)
  const [mountFailed, setMountFailed] = useState(false) // Previne loop infinito de mount
  const [authDenied, setAuthDenied] = useState(false) // Track if mount failed due to AUTH_DENIED

  const log = useCallback((msg: string, data?: any) => {
    if (debug) console.log(`[${componentName}] ${msg}`, data || '')
  }, [debug, componentName])

  // ===== Set Property =====
  const setProperty = useCallback(async <K extends keyof TState>(key: K, value: TState[K]) => {
    // Clear existing timer
    const timer = debounceTimers.current.get(key)
    if (timer) clearTimeout(timer)

    // Track pending
    pendingChanges.current.set(key, { value, synced: false })

    const doSync = async () => {
      try {
        const id = componentId || lastComponentIdRef.current
        if (!id || !connected) return

        await sendMessageAndWait({
          type: 'CALL_ACTION',
          componentId: id,
          action: 'setValue',
          payload: { key, value }
        }, 5000)

        pendingChanges.current.get(key)!.synced = true
      } catch (err: any) {
        pendingChanges.current.delete(key)
        setError(err.message)
      }
    }

    if (syncMode === 'immediate') {
      await doSync()
    } else if (syncMode === 'debounced') {
      debounceTimers.current.set(key, setTimeout(doSync, debounce))
    }
  }, [componentId, connected, sendMessageAndWait, debounce, syncMode])

  // ===== Mount =====
  const mount = useCallback(async () => {
    // Usa refs para prevenir chamadas duplicadas (React StrictMode)
    if (!connected || mountedRef.current || mountingRef.current || rehydratingRef.current || mountFailed) return

    mountingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const response = await sendMessageAndWait({
        type: 'COMPONENT_MOUNT',
        componentId: instanceId.current,
        payload: { component: componentName, props: initialState, room, userId, debugLabel: options.debugLabel }
      }, 5000)

      if (response?.success && response?.result?.componentId) {
        const newId = response.result.componentId
        setComponentId(newId)
        lastComponentIdRef.current = newId
        mountedRef.current = true

        if (response.result.signedState) {
          persistState(persistEnabled, componentName, response.result.signedState, room, userId)
        }
        if (response.result.initialState) {
          updateState(response.result.initialState)
        }

        log('Mounted', newId)
        setTimeout(() => onMount?.(), 0)
      } else {
        throw new Error(response?.error || 'Mount failed')
      }
    } catch (err: any) {
      setError(err.message)
      // Track if auth was the reason for failure
      if (err.message?.includes('AUTH_DENIED')) {
        setAuthDenied(true)
      }
      setMountFailed(true) // Previne loop infinito para TODOS os erros
      onError?.(err.message)
      if (!fallbackToLocal) throw err
    } finally {
      setLoading(false)
      mountingRef.current = false
    }
  }, [connected, componentName, initialState, room, userId, sendMessageAndWait, updateState, log, onMount, onError, fallbackToLocal, mountFailed])

  // Keep mount function ref updated
  mountFnRef.current = mount

  // ===== Unmount =====
  const unmount = useCallback(async () => {
    if (!componentId || !connected) return
    try {
      await sendMessage({ type: 'COMPONENT_UNMOUNT', componentId })
      setComponentId(null)
      mountedRef.current = false
    } catch {}
  }, [componentId, connected, sendMessage])

  // ===== Rehydrate =====
  const rehydrate = useCallback(async () => {
    // Usa ref para prevenir chamadas duplicadas (React StrictMode)
    if (!connected || rehydratingRef.current || mountingRef.current || mountedRef.current) return false

    const persisted = getPersistedState(persistEnabled, componentName)
    if (!persisted) return false

    // Skip if too old (> 1 hour)
    if (Date.now() - persisted.lastUpdate > 60 * 60 * 1000) {
      clearPersistedState(persistEnabled, componentName)
      return false
    }

    rehydratingRef.current = true
    setRehydrating(true)
    try {
      const response = await sendMessageAndWait({
        type: 'COMPONENT_REHYDRATE',
        componentId: lastComponentIdRef.current || instanceId.current,
        payload: {
          componentName,
          signedState: persisted.signedState,
          room: persisted.room,
          userId: persisted.userId
        }
      }, 2000)

      if (response?.success && response?.result?.newComponentId) {
        setComponentId(response.result.newComponentId)
        lastComponentIdRef.current = response.result.newComponentId
        mountedRef.current = true
        setTimeout(() => onRehydrate?.(), 0)
        return true
      }
      clearPersistedState(persistEnabled, componentName)
      return false
    } catch {
      clearPersistedState(persistEnabled, componentName)
      return false
    } finally {
      rehydratingRef.current = false
      setRehydrating(false)
    }
  }, [connected, componentName, sendMessageAndWait, onRehydrate])

  // ===== Call Action =====
  const call = useCallback(async (action: string, payload?: any) => {
    const id = componentId || lastComponentIdRef.current
    if (!id || !connected) throw new Error('Not connected')

    const response = await sendMessageAndWait({
      type: 'CALL_ACTION',
      componentId: id,
      action,
      payload
    }, 5000)

    if (!response.success) throw new Error(response.error || 'Action failed')
  }, [componentId, connected, sendMessageAndWait])

  const callAndWait = useCallback(async <R = any>(action: string, payload?: any, timeout = 10000): Promise<R> => {
    const id = componentId || lastComponentIdRef.current
    if (!id || !connected) throw new Error('Not connected')

    const response = await sendMessageAndWait({
      type: 'CALL_ACTION',
      componentId: id,
      action,
      payload
    }, timeout)

    return response as R
  }, [componentId, connected, sendMessageAndWait])

  // ===== Refresh =====
  const refresh = useCallback(async () => {
    for (const [key, change] of pendingChanges.current) {
      if (!change.synced) {
        await setProperty(key, change.value)
      }
    }
  }, [setProperty])

  // ===== Sync (para campos com syncOn: manual) =====
  const sync = useCallback(async () => {
    const promises: Promise<void>[] = []

    for (const [key, value] of localFieldValues.current) {
      const currentServerValue = stateData[key]
      if (value !== currentServerValue) {
        promises.push(setProperty(key, value))
      }
    }

    await Promise.all(promises)
  }, [stateData, setProperty])

  // ===== Field Binding =====
  const createFieldBinding = useCallback(<K extends keyof TState>(
    key: K,
    options: FieldOptions = {}
  ): FieldBinding => {
    const {
      syncOn = 'change',
      debounce: fieldDebounce = debounce,
      transform
    } = options

    // Salvar opções do campo
    fieldOptions.current.set(key, options)

    // Valor atual: local (se existir) ou do servidor
    const currentValue = localFieldValues.current.has(key)
      ? localFieldValues.current.get(key)
      : stateData[key]

    return {
      name: String(key),
      value: currentValue ?? '',

      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        let value: any = e.target.value

        // Checkbox support
        if (e.target.type === 'checkbox') {
          value = (e.target as HTMLInputElement).checked
        }

        // Transform
        if (transform) {
          value = transform(value)
        }

        // Sempre salvar localmente primeiro (para UI responsiva)
        localFieldValues.current.set(key, value)

        // Forçar re-render
        setLocalVersion(v => v + 1)
        pendingChanges.current.set(key, { value, synced: false })

        if (syncOn === 'change') {
          // Debounced sync
          const timer = debounceTimers.current.get(key)
          if (timer) clearTimeout(timer)

          debounceTimers.current.set(key, setTimeout(async () => {
            await setProperty(key, value)
            localFieldValues.current.delete(key) // Limpar valor local após sync
          }, fieldDebounce))
        }
        // blur e manual: não faz nada aqui, espera onBlur ou $sync()
      },

      onBlur: () => {
        if (syncOn === 'blur') {
          const value = localFieldValues.current.get(key)
          if (value !== undefined && value !== stateData[key]) {
            setProperty(key, value).then(() => {
              localFieldValues.current.delete(key)
            })
          }
        }
      }
    }
  }, [stateData, debounce, setProperty, localVersion])

  // ===== Register with WebSocket =====
  useEffect(() => {
    if (!componentId) return

    const unregister = registerComponent(componentId, (message: WebSocketResponse) => {
      switch (message.type) {
        case 'STATE_UPDATE':
          if (message.payload?.state) {
            const oldState = stateData
            updateState(message.payload.state)
            onStateChange?.(message.payload.state, oldState)
            if (message.payload?.signedState) {
              persistState(persistEnabled, componentName, message.payload.signedState, room, userId)
            }
          }
          break
        case 'STATE_DELTA':
          if (message.payload?.delta) {
            const oldState = storeRef.current?.getState().state ?? stateData
            const mergedState = { ...oldState, ...message.payload.delta } as TState
            updateState(mergedState)
            onStateChange?.(mergedState, oldState)
          }
          break
        case 'STATE_REHYDRATED':
          if (message.payload?.state && message.payload?.newComponentId) {
            setComponentId(message.payload.newComponentId)
            lastComponentIdRef.current = message.payload.newComponentId
            updateState(message.payload.state)
            setRehydrating(false)
            onRehydrate?.()
          }
          break
        case 'BROADCAST':
          // Handle broadcast messages from other users in the same room
          if (message.payload?.type) {
            // Emit broadcast event for component to handle (as { type, data } object)
            broadcastHandlerRef.current?.({ type: message.payload.type, data: message.payload.data })
          }
          break
        case 'ERROR':
          setError(message.payload?.error || 'Unknown error')
          onError?.(message.payload?.error)
          break

        // Room system messages
        case 'ROOM_EVENT':
        case 'ROOM_STATE':
        case 'ROOM_SYSTEM':
        case 'ROOM_JOINED':
        case 'ROOM_LEFT':
          // Forward to room handlers
          for (const handler of roomMessageHandlers.current) {
            handler(message as unknown as RoomServerMessage)
          }
          break
      }
    })

    return () => unregister()
  }, [componentId, registerComponent, updateState, stateData, componentName, room, userId, onStateChange, onRehydrate, onError])

  // ===== Auto Mount =====
  useEffect(() => {
    if (connected && autoMount && !mountedRef.current && !componentId && !mountingRef.current && !rehydrating && !mountFailed) {
      rehydrate().then(ok => {
        if (!ok && !mountedRef.current && !mountFailed) mount()
      })
    }
  }, [connected, autoMount, mount, componentId, rehydrating, rehydrate, mountFailed])

  // ===== Auto Re-mount on Auth Change =====
  // When auth changes from false to true and component failed due to AUTH_DENIED, retry mount
  const prevAuthRef = useRef(wsAuthenticated)
  useEffect(() => {
    const wasNotAuthenticated = !prevAuthRef.current
    const isNowAuthenticated = wsAuthenticated
    prevAuthRef.current = wsAuthenticated

    // Only retry if: auth changed from false→true AND we had an auth denial
    if (wasNotAuthenticated && isNowAuthenticated && authDenied) {
      log('Auth changed to authenticated, retrying mount...')
      // Reset flags to allow retry
      setAuthDenied(false)
      setMountFailed(false)
      setError(null)
      mountedRef.current = false
      mountingRef.current = false
      // Small delay to ensure state is updated, use ref to avoid stale closure
      setTimeout(() => mountFnRef.current?.(), 50)
    }
  }, [wsAuthenticated, authDenied, log])

  // ===== Connection Changes =====
  const prevConnected = useRef(connected)
  useEffect(() => {
    if (prevConnected.current && !connected && mountedRef.current) {
      mountedRef.current = false
      setComponentId(null)
      onDisconnect?.()
    }
    if (!prevConnected.current && connected) {
      onConnect?.()
      if (!mountedRef.current && !mountingRef.current) {
        setTimeout(() => {
          const persisted = getPersistedState(persistEnabled, componentName)
          if (persisted?.signedState) rehydrate()
          else mount()
        }, 100)
      }
    }
    prevConnected.current = connected
  }, [connected, mount, rehydrate, componentName, onConnect, onDisconnect])

  // ===== Room Manager =====
  const roomManager = useMemo(() => {
    if (roomManagerRef.current) {
      roomManagerRef.current.setComponentId(componentId)
      return roomManagerRef.current
    }

    const manager = new RoomManager({
      componentId,
      defaultRoom: room,
      sendMessage,
      sendMessageAndWait,
      onMessage: (handler) => {
        roomMessageHandlers.current.add(handler)
        return () => {
          roomMessageHandlers.current.delete(handler)
        }
      }
    })

    roomManagerRef.current = manager
    return manager
  }, [componentId, room, sendMessage, sendMessageAndWait])

  // Atualizar componentId no RoomManager quando mudar
  useEffect(() => {
    roomManagerRef.current?.setComponentId(componentId)
  }, [componentId])

  // ===== Cleanup =====
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(t => clearTimeout(t))
      roomManagerRef.current?.destroy()
      if (mountedRef.current) unmount()
    }
  }, [unmount])

  // ===== Status =====
  const getStatus = () => {
    if (!connected) return 'connecting'
    if (rehydrating) return 'reconnecting'
    if (loading) return 'loading'
    if (error) return 'error'
    if (!componentId) return 'mounting'
    return 'synced'
  }

  // ===== Proxy =====
  const proxy = useMemo(() => {
    return new Proxy({} as LiveProxyWithBroadcasts<TState, TActions, TBroadcasts>, {
      get(_, prop: string | symbol) {
        if (typeof prop === 'symbol') {
          if (prop === Symbol.toStringTag) return 'LiveComponent'
          return undefined
        }

        // Metadata ($ prefix)
        switch (prop) {
          // $state returns FRESH state from store (not stale closure)
          case '$state': return storeRef.current?.getState().state ?? stateData
          case '$connected': return connected
          case '$loading': return loading
          case '$error': return error
          case '$status': return getStatus()
          case '$componentId': return componentId
          case '$dirty': return pendingChanges.current.size > 0
          case '$authenticated': return wsAuthenticated
          case '$call': return call
          case '$callAndWait': return callAndWait
          case '$mount': return mount
          case '$unmount': return unmount
          case '$refresh': return refresh
          case '$set': return setProperty
          case '$field': return createFieldBinding
          case '$sync': return sync
          case '$onBroadcast': return (handler: (event: { type: string; data: any }) => void) => {
            broadcastHandlerRef.current = handler
          }
          case '$updateLocal': return (updates: Partial<TState>) => {
            const currentState = storeRef.current?.getState().state
            if (currentState) {
              updateState({ ...currentState, ...updates } as TState)
            }
          }
          case '$room': return roomManager.createProxy()
          case '$rooms': return roomManager.getJoinedRooms()
        }

        // Se é propriedade do state → retorna valor
        if (prop in stateData) {
          // Valor local tem prioridade (para UI responsiva com $field)
          if (localFieldValues.current.has(prop as keyof TState)) {
            return localFieldValues.current.get(prop as keyof TState)
          }
          // Optimistic update
          if (optimistic) {
            const pending = pendingChanges.current.get(prop as keyof TState)
            if (pending && !pending.synced) return pending.value
          }
          return stateData[prop as keyof TState]
        }

        // Se NÃO é propriedade do state → é uma action!
        // Retorna uma função que chama a action no servidor
        return async (payload?: any) => {
          const id = componentId || lastComponentIdRef.current
          if (!id || !connected) throw new Error('Not connected')

          const response = await sendMessageAndWait({
            type: 'CALL_ACTION',
            componentId: id,
            action: prop,
            payload
          }, 10000)

          if (!response.success) throw new Error(response.error || 'Action failed')
          return response.result
        }
      },

      set(_, prop: string | symbol, value) {
        if (typeof prop === 'symbol' || RESERVED_PROPS.has(prop as string)) return false
        setProperty(prop as keyof TState, value)
        return true
      },

      has(_, prop) {
        if (typeof prop === 'symbol') return false
        return RESERVED_PROPS.has(prop) || prop in stateData
      },

      ownKeys() {
        return [...Object.keys(stateData), '$state', '$connected', '$loading', '$error', '$status', '$componentId', '$dirty', '$authenticated', '$call', '$callAndWait', '$mount', '$unmount', '$refresh', '$set', '$field', '$sync', '$onBroadcast', '$updateLocal', '$room', '$rooms']
      }
    })
  }, [stateData, connected, wsAuthenticated, loading, error, componentId, call, callAndWait, mount, unmount, refresh, setProperty, optimistic, sendMessageAndWait, createFieldBinding, sync, localVersion, roomManager])

  return proxy
}

// ===== Factory =====

export function createLiveComponent<
  TState extends Record<string, any>,
  TActions = {},
  TBroadcasts extends Record<string, any> = Record<string, any>
>(
  componentName: string,
  defaultOptions: Omit<UseLiveComponentOptions, keyof HybridComponentOptions> = {}
) {
  return function useComponent(
    initialState: TState,
    options: UseLiveComponentOptions = {}
  ): LiveProxyWithBroadcasts<TState, TActions, TBroadcasts> {
    return useLiveComponent<TState, TActions, TBroadcasts>(componentName, initialState, { ...defaultOptions, ...options })
  }
}
