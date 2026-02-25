/**
 * Core Framework Types
 * Defines the main interfaces and types for the FluxStack framework
 */

import type { FluxStackConfig } from "@core/types"
import type { Logger } from "@core/utils/logger/index"

export interface FluxStackFrameworkOptions {
  config?: Partial<FluxStackConfig>
  plugins?: string[]
  autoStart?: boolean
}

export interface FrameworkContext {
  config: FluxStackConfig
  isDevelopment: boolean
  isProduction: boolean
  isTest: boolean
  environment: string
  logger: Logger
  startTime: Date
}

export interface FrameworkStats {
  uptime: number
  pluginCount: number
  requestCount: number
  errorCount: number
  memoryUsage: NodeJS.MemoryUsage
}

export interface FrameworkHooks {
  beforeStart?: () => void | Promise<void>
  afterStart?: () => void | Promise<void>
  beforeStop?: () => void | Promise<void>
  afterStop?: () => void | Promise<void>
  onError?: (error: Error) => void | Promise<void>
}

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'
  path: string
  handler: Function
  schema?: any
  middleware?: Function[]
  description?: string
  tags?: string[]
}

export interface MiddlewareDefinition {
  name: string
  handler: Function
  priority?: number
  routes?: string[]
}

export interface ServiceDefinition {
  name: string
  instance: any
  dependencies?: string[]
  singleton?: boolean
}