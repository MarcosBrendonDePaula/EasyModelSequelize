// 🔥 FluxStack Live - Server Exports

export { roomState, createTypedRoomState } from './RoomStateManager'
export type { RoomStateData, RoomInfo } from './RoomStateManager'

export { roomEvents, createTypedRoomEventBus } from './RoomEventBus'
export type { EventHandler, RoomSubscription } from './RoomEventBus'

export { componentRegistry } from './ComponentRegistry'
export { liveComponentsPlugin } from './websocket-plugin'
export { connectionManager } from './WebSocketConnectionManager'
export { fileUploadManager } from './FileUploadManager'
export { stateSignature } from './StateSignature'
export { performanceMonitor } from './LiveComponentPerformanceMonitor'
export { liveLog, liveWarn, registerComponentLogging, unregisterComponentLogging } from './LiveLogger'
export type { LiveLogCategory, LiveLogConfig } from './LiveLogger'

// 🔒 Auth system
export { liveAuthManager, LiveAuthManager } from './auth/LiveAuthManager'
export { AuthenticatedContext, AnonymousContext, ANONYMOUS_CONTEXT } from './auth/LiveAuthContext'
export type {
  LiveAuthProvider,
  LiveAuthCredentials,
  LiveAuthUser,
  LiveAuthContext,
  LiveComponentAuth,
  LiveActionAuth,
  LiveActionAuthMap,
  LiveAuthResult,
} from './auth/types'
