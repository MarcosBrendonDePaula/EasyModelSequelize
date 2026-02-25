// Re-export all configuration types
export * from "./config"

// Ensure critical types are explicitly exported
export type {
  FluxStackConfig,
  AppConfig,
  ServerConfig,
  ClientConfig,
  BuildConfig,
  LoggerConfig,
  MonitoringConfig,
  PluginsConfig
} from "@config"

// Re-export plugin types (explicitly handling conflicts)
export type {
  Plugin,
  PluginContext,
  PluginUtils,
  PluginManifest,
  PluginLoadResult,
  PluginDiscoveryOptions,
  // PluginHooks,
  // PluginConfig as PluginConfigOptions,
  PluginHook,
  PluginPriority,
  RequestContext,
  ResponseContext,
  ErrorContext
} from "./plugin"

// Re-export additional plugin types from core plugins
export type {
  FluxStack as CorePlugin,
  PluginContext as CorePluginContext,
  PluginUtils as CorePluginUtils,
  RequestContext as CoreRequestContext,
  ResponseContext as CoreResponseContext,
  ErrorContext as CoreErrorContext
} from "../plugins/types"

// Re-export API types
export type {
  HttpMethod,
  ApiEndpoint,
  ApiSchema,
  ApiResponse,
  ApiError,
  ApiMeta,
  PaginationMeta,
  TimingMeta
} from "./api"

// Re-export build types (explicitly handle BuildTarget conflict)
export type {
  BuildTarget,
  BuildMode,
  BundleFormat,
  BuildOptions,
  BuildResult,
  BuildOutputFile,
  BuildWarning,
  BuildError,
  BuildStats
} from "./build"

// Re-export framework types
export type {
  FluxStackFrameworkOptions,
  FrameworkContext,
  FrameworkStats,
  FrameworkHooks,
  RouteDefinition,
  MiddlewareDefinition,
  ServiceDefinition
} from "../framework/types"

// Re-export utility types
export type {
  Logger
} from "../utils/logger/index"

export type {
  FluxStackError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError
} from "../utils/errors"

export type {
  Metric,
  Counter,
  Gauge,
  Histogram,
  SystemMetrics,
  HttpMetrics
} from "../utils/monitoring"

// Legacy configuration interface for backward compatibility
export interface LegacyFluxStackConfig {
  port?: number
  vitePort?: number
  clientPath?: string
  apiPrefix?: string
  cors?: {
    origins?: string[]
    methods?: string[]
    headers?: string[]
  }
  build?: {
    outDir?: string
    target?: string
  }
}

export interface FluxStackContext {
  config: any // Use any to avoid circular dependency
  isDevelopment: boolean
  isProduction: boolean
  isTest: boolean
  environment: string
}