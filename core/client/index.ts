// 🔥 FluxStack Client Core - Main Export

// API Client (Eden Treaty)
export {
  createEdenClient,
  getErrorMessage,
  getDefaultBaseUrl,
  treaty,
  type EdenClientOptions
} from './api'

// Live Components Provider (Singleton WebSocket Connection)
export {
  LiveComponentsProvider,
  useLiveComponents
} from './LiveComponentsProvider'
export type {
  LiveComponentsProviderProps,
  LiveComponentsContextValue,
  LiveAuthOptions
} from './LiveComponentsProvider'

// Chunked Upload Hook
export { useChunkedUpload } from './hooks/useChunkedUpload'
export type { ChunkedUploadOptions, ChunkedUploadState } from './hooks/useChunkedUpload'
export { useLiveChunkedUpload } from './hooks/useLiveChunkedUpload'
export type { LiveChunkedUploadOptions } from './hooks/useLiveChunkedUpload'
export { useLiveUpload } from './hooks/useLiveUpload'

// Live Component Hook (API principal)
export { Live } from './components/Live'

// Live Component Debugger
export { LiveDebugger } from './components/LiveDebugger'
export type { LiveDebuggerProps } from './components/LiveDebugger'
export { useLiveDebugger } from './hooks/useLiveDebugger'
export type {
  DebugEvent,
  DebugEventType,
  ComponentSnapshot,
  DebugSnapshot,
  DebugFilter,
  UseLiveDebuggerReturn,
  UseLiveDebuggerOptions
} from './hooks/useLiveDebugger'
