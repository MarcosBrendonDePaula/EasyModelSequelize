// 🔥 FluxStack Live - Hook para componentes real-time
//
// Uso:
//   import { Live } from '@/core/client'
//   import { LiveForm } from '@server/live/LiveForm'
//
//   // Sem estado inicial - usa defaultState do componente
//   const form = Live.use(LiveForm)
//
//   // Com estado inicial parcial (override)
//   const form = Live.use(LiveForm, { name: 'João' })
//
//   return (
//     <input {...form.$field('name', { syncOn: 'blur' })} />
//     <button onClick={() => form.submit()}>Enviar</button>
//   )
//
// 🔥 Broadcasts Tipados (Discriminated Union):
//   // No servidor, defina a interface de broadcasts:
//   export interface LiveFormBroadcasts {
//     FORM_SUBMITTED: { formId: string; data: any }
//     FIELD_CHANGED: { field: string; value: any }
//   }
//
//   // No cliente, use com tipagem automática (discriminated union):
//   import { LiveForm, type LiveFormBroadcasts } from '@server/live/LiveForm'
//
//   const form = Live.use(LiveForm)
//   form.$onBroadcast<LiveFormBroadcasts>((event) => {
//     switch (event.type) {
//       case 'FORM_SUBMITTED':
//         console.log(event.data.formId) // ✅ Tipado como string!
//         break
//       case 'FIELD_CHANGED':
//         console.log(event.data.field)  // ✅ Tipado como string!
//         break
//     }
//   })

import { useLiveComponent } from '../hooks/useLiveComponent'
import type { UseLiveComponentOptions, LiveProxy, LiveProxyWithBroadcasts } from '../hooks/useLiveComponent'

// ===== Tipos para Inferência do Servidor =====

// Extrai o defaultState estático da classe
type ExtractDefaultState<T> = T extends { defaultState: infer S }
  ? S extends Record<string, any> ? S : Record<string, any>
  : Record<string, any>

// Extrai o State da classe do servidor (via instance.state)
type ExtractState<T> = T extends { new(...args: any[]): { state: infer S } }
  ? S extends Record<string, any> ? S : Record<string, any>
  : ExtractDefaultState<T>

// Extrai os nomes de publicActions como union type
type ExtractPublicActionNames<T> = T extends { publicActions: readonly (infer A)[] }
  ? A extends string ? A : never
  : never

// Extrai as Actions respeitando publicActions (MANDATORY)
// - Se publicActions está definido: somente métodos listados são expostos
// - Se publicActions NÃO está definido: nenhuma action disponível (secure by default)
type ExtractActions<T> = T extends { new(...args: any[]): infer Instance }
  ? T extends { publicActions: readonly string[] }
    ? {
        [K in keyof Instance as K extends ExtractPublicActionNames<T>
          ? Instance[K] extends (...args: any[]) => Promise<any> ? K : never
          : never
        ]: Instance[K]
      }
    : Record<string, never>
  : Record<string, never>

// ===== Opções do Live.use() =====

interface LiveUseOptions<TState> extends UseLiveComponentOptions {
  /** Estado inicial para o componente */
  initialState?: Partial<TState>
}

// ===== Hook Principal =====

function useLive<
  T extends { new(...args: any[]): any; defaultState?: Record<string, any>; componentName: string; publicActions?: readonly string[] },
  TBroadcasts extends Record<string, any> = Record<string, any>
>(
  ComponentClass: T,
  options?: LiveUseOptions<ExtractState<T>>
): LiveProxyWithBroadcasts<ExtractState<T>, ExtractActions<T>, TBroadcasts> {
  // Use static componentName (required for production builds with minification)
  const componentName = ComponentClass.componentName

  // Usa defaultState da classe se não passar initialState
  const defaultState = (ComponentClass as any).defaultState || {}
  const { initialState, ...restOptions } = options || {}
  const mergedState = { ...defaultState, ...initialState } as ExtractState<T>

  return useLiveComponent<ExtractState<T>, ExtractActions<T>, TBroadcasts>(
    componentName,
    mergedState,
    restOptions
  )
}

// ===== Export =====

export const Live = {
  use: useLive
}

export default Live
