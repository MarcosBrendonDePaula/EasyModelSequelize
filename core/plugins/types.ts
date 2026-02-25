import type { FluxStackConfig } from "@config"
import type { Logger } from "@core/utils/logger/index"

export type PluginHook =
  // Lifecycle hooks
  | 'setup'
  | 'onConfigLoad'
  | 'onBeforeServerStart'
  | 'onServerStart'
  | 'onAfterServerStart'
  | 'onBeforeServerStop'
  | 'onServerStop'
  // Request/Response pipeline hooks
  | 'onRequest'
  | 'onBeforeRoute'
  | 'onAfterRoute'
  | 'onBeforeResponse'
  | 'onResponse'
  | 'onRequestValidation'
  | 'onResponseTransform'
  // Error handling hooks
  | 'onError'
  // Build pipeline hooks
  | 'onBeforeBuild'
  | 'onBuild'
  | 'onBuildAsset'
  | 'onBuildComplete'
  | 'onBuildError'
  // Plugin system hooks
  | 'onPluginRegister'
  | 'onPluginUnregister'
  | 'onPluginError'

export type PluginPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest' | number

export interface PluginContext {
  config: FluxStackConfig
  logger: Logger
  app: any // Elysia app
  utils: PluginUtils
  registry?: any // Plugin registry reference
}

export interface PluginUtils {
  // Utility functions that plugins can use
  createTimer: (label: string) => { end: () => number }
  formatBytes: (bytes: number) => string
  isProduction: () => boolean
  isDevelopment: () => boolean
  getEnvironment: () => string
  createHash: (data: string) => string
  deepMerge: (target: any, source: any) => any
  validateSchema: (data: any, schema: any) => { valid: boolean; errors: string[] }
}

export interface RequestContext {
  request: Request
  path: string
  method: string
  headers: Record<string, string>
  query: Record<string, string>
  params: Record<string, string>
  body?: any
  user?: any
  startTime: number
  handled?: boolean
  response?: Response
}

export interface ResponseContext extends RequestContext {
  response: Response
  statusCode: number
  duration: number
  size?: number
}

export interface ErrorContext extends RequestContext {
  error: Error
  duration: number
  handled: boolean
}

export interface BuildContext {
  target: string
  outDir: string
  mode: 'development' | 'production'
  config: FluxStackConfig
}

export interface ConfigLoadContext {
  config: FluxStackConfig
  envVars: Record<string, string | undefined>
  configPath?: string
}

export interface RouteContext extends RequestContext {
  route?: string
  handler?: Function
  params: Record<string, string>
}

export interface ValidationContext extends RequestContext {
  errors: Array<{ field: string; message: string; code: string }>
  isValid: boolean
}

export interface TransformContext extends ResponseContext {
  transformed: boolean
  originalResponse?: Response
}

export interface BuildAssetContext {
  assetPath: string
  assetType: 'js' | 'css' | 'html' | 'image' | 'font' | 'other'
  size: number
  content?: string | Buffer
}

export interface BuildErrorContext {
  error: Error
  file?: string
  line?: number
  column?: number
}

export interface PluginEventContext {
  pluginName: string
  pluginVersion?: string
  timestamp: number
  data?: any
}

export interface PluginConfigSchema {
  type: 'object'
  properties: Record<string, any>
  required?: string[]
  additionalProperties?: boolean
}

export namespace FluxStack {
  export interface Plugin {
  name: string
  version?: string
  description?: string
  author?: string
  dependencies?: string[]
  priority?: number | PluginPriority
  category?: string
  tags?: string[]

  // Lifecycle hooks
  setup?: (context: PluginContext) => void | Promise<void>
  onConfigLoad?: (context: ConfigLoadContext) => void | Promise<void>
  onBeforeServerStart?: (context: PluginContext) => void | Promise<void>
  onServerStart?: (context: PluginContext) => void | Promise<void>
  onAfterServerStart?: (context: PluginContext) => void | Promise<void>
  onBeforeServerStop?: (context: PluginContext) => void | Promise<void>
  onServerStop?: (context: PluginContext) => void | Promise<void>

  // Request/Response pipeline hooks
  onRequest?: (context: RequestContext) => void | Promise<void>
  onBeforeRoute?: (context: RequestContext) => void | Promise<void>
  onAfterRoute?: (context: RouteContext) => void | Promise<void>
  onBeforeResponse?: (context: ResponseContext) => void | Promise<void>
  onResponse?: (context: ResponseContext) => void | Promise<void>
  onRequestValidation?: (context: ValidationContext) => void | Promise<void>
  onResponseTransform?: (context: TransformContext) => void | Promise<void>

  // Error handling hooks
  onError?: (context: ErrorContext) => void | Promise<void>

  // Build pipeline hooks
  onBeforeBuild?: (context: BuildContext) => void | Promise<void>
  onBuild?: (context: BuildContext) => void | Promise<void>
  onBuildAsset?: (context: BuildAssetContext) => void | Promise<void>
  onBuildComplete?: (context: BuildContext) => void | Promise<void>
  onBuildError?: (context: BuildErrorContext) => void | Promise<void>

  // Plugin system hooks
  onPluginRegister?: (context: PluginEventContext) => void | Promise<void>
  onPluginUnregister?: (context: PluginEventContext) => void | Promise<void>
  onPluginError?: (context: PluginEventContext & { error: Error }) => void | Promise<void>

  // Configuration
  /**
   * @deprecated Use declarative config system instead (plugins/[name]/config/)
   * Create a config/ folder with defineConfig() for type-safe configuration.
   * This property is kept for backward compatibility with built-in plugins.
   *
   * @example
   * // ✅ New way (recommended):
   * // plugins/my-plugin/config/index.ts
   * import { defineConfig, config } from '@core/utils/config-schema'
   * export const myConfig = defineConfig({ ... })
   *
   * // ❌ Old way (deprecated):
   * configSchema: { type: 'object', properties: { ... } }
   */
  configSchema?: PluginConfigSchema

  /**
   * @deprecated Use declarative config system with defineConfig()
   * This property will be removed in a future major version.
   * Use the config/ folder structure for automatic type inference.
   */
  defaultConfig?: any

  // CLI commands
  commands?: CliCommand[]
  }
}


export interface PluginManifest {
  name: string
  version: string
  description: string
  author: string
  license: string
  homepage?: string
  repository?: string
  keywords: string[]
  dependencies: Record<string, string>
  peerDependencies?: Record<string, string>
  fluxstack: {
    version: string
    hooks: PluginHook[]
    config?: PluginConfigSchema
    category?: string
    tags?: string[]
  }
}

export interface PluginLoadResult {
  success: boolean
  plugin?: FluxStack.Plugin
  error?: string
  warnings?: string[]
}

export interface PluginRegistryState {
  plugins: Map<string, FluxStack.Plugin>
  manifests: Map<string, PluginManifest>
  loadOrder: string[]
  dependencies: Map<string, string[]>
  conflicts: string[]
}

export interface PluginHookResult {
  success: boolean
  error?: Error
  duration: number
  plugin: string
  hook: PluginHook
  context?: any
}

export interface PluginMetrics {
  loadTime: number
  setupTime: number
  hookExecutions: Map<PluginHook, number>
  errors: number
  warnings: number
  lastExecution?: Date
}

export interface PluginDiscoveryOptions {
  directories?: string[]
  patterns?: string[]
  includeBuiltIn?: boolean
  includeExternal?: boolean
  includeNpm?: boolean
}

export interface PluginInstallOptions {
  version?: string
  registry?: string
  force?: boolean
  dev?: boolean
  source?: 'npm' | 'git' | 'local'
}

export interface PluginExecutionContext {
  plugin: FluxStack.Plugin
  hook: PluginHook
  startTime: number
  timeout?: number
  retries?: number
}

export interface PluginValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Plugin hook execution options
export interface HookExecutionOptions {
  timeout?: number
  parallel?: boolean
  stopOnError?: boolean
  retries?: number
}

// Plugin lifecycle events
export type PluginLifecycleEvent = 
  | 'plugin:registered'
  | 'plugin:unregistered'
  | 'plugin:enabled'
  | 'plugin:disabled'
  | 'plugin:error'
  | 'hook:before'
  | 'hook:after'
  | 'hook:error'

// CLI Command interfaces
export interface CliArgument {
  name: string
  description: string
  required?: boolean
  type?: 'string' | 'number' | 'boolean'
  default?: any
  choices?: string[]
}

export interface CliOption {
  name: string
  short?: string
  description: string
  type?: 'string' | 'number' | 'boolean' | 'array'
  default?: any
  required?: boolean
  choices?: string[]
}

export interface CliCommand {
  name: string
  description: string
  usage?: string
  examples?: string[]
  arguments?: CliArgument[]
  options?: CliOption[]
  aliases?: string[]
  category?: string
  hidden?: boolean
  handler: (args: any[], options: any, context: CliContext) => Promise<void> | void
}

export interface CliContext {
  config: FluxStackConfig
  logger: Logger
  utils: PluginUtils
  workingDir: string
  packageInfo: {
    name: string
    version: string
  }
}

// Live Components Types - Re-exported from core/types/types.ts
// See core/types/types.ts for full implementation
// Note: These are re-exported at the end of this file

// File Upload Types
export interface ActiveUpload {
  uploadId: string
  componentId?: string
  filename: string
  fileType?: string
  fileSize?: number
  totalChunks: number
  receivedChunks: Map<number, any>
  startTime: number
  lastChunkTime?: number
}

export interface FileUploadStartMessage {
  type: 'upload:start' | 'FILE_UPLOAD_START'
  uploadId: string
  filename: string
  totalChunks: number
  fileSize: number
  componentId?: string
  fileType?: string
  chunkSize?: number
  requestId?: string
}

export interface FileUploadChunkMessage {
  type: 'upload:chunk' | 'FILE_UPLOAD_CHUNK'
  uploadId: string
  chunkIndex: number
  data: string | ArrayBuffer
  totalChunks?: number
  componentId?: string
  requestId?: string
}

export interface FileUploadCompleteMessage {
  type: 'upload:complete' | 'FILE_UPLOAD_COMPLETE'
  uploadId: string
  requestId?: string
}

export interface FileUploadProgressResponse {
  type: 'upload:progress' | 'FILE_UPLOAD_PROGRESS'
  uploadId: string
  receivedChunks?: number
  totalChunks?: number
  percentage?: number
  componentId?: string
  chunkIndex?: number
  bytesUploaded?: number
  totalBytes?: number
  progress?: number
  timestamp?: number
}

export interface FileUploadCompleteResponse {
  type: 'upload:complete' | 'FILE_UPLOAD_COMPLETE'
  uploadId: string
  url?: string
  filename?: string
  size?: number
  componentId?: string
  success?: boolean
  error?: string
  message?: string
  fileUrl?: string
  timestamp?: number
}

// Plugin Type Export
export type Plugin = FluxStack.Plugin

// Re-export all WebSocket and LiveComponent types from core/types/types.ts
export {
  LiveComponent,
  type FluxStackWebSocket,
  type FluxStackWSData,
  type FluxStackServerWebSocket,
  type LiveMessage,
  type BroadcastMessage,
  type ComponentState,
  type ComponentDefinition,
  type WebSocketData
} from '@core/types/types'