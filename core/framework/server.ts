import { Elysia } from "elysia"
import type { FluxStackConfig, FluxStackContext } from "@core/types"
import type { FluxStack, PluginContext, PluginUtils } from "@core/plugins/types"
import { PluginRegistry } from "@core/plugins/registry"
import { PluginManager } from "@core/plugins/manager"
import { fluxStackConfig } from "@config"
import { getEnvironmentInfo } from "@core/config"
import { logger } from "@core/utils/logger"
import { displayStartupBanner, type StartupInfo } from "@core/utils/logger/startup-banner"
import { componentRegistry } from "@core/server/live/ComponentRegistry"
import { FluxStackError } from "@core/utils/errors"
import { createTimer, formatBytes, isProduction, isDevelopment } from "@core/utils/helpers"
import type { Plugin } from "@core/plugins"

export class FluxStackFramework {
  private app: Elysia
  private context: FluxStackContext
  private pluginRegistry: PluginRegistry
  private pluginManager: PluginManager
  private pluginContext: PluginContext
  private isStarted: boolean = false
  private requestTimings: Map<string, number> = new Map()

  /**
   * Helper to safely parse request.url which might be relative or absolute
   */
  private parseRequestURL(request: Request): URL {
    try {
      // Try parsing as absolute URL first
      return new URL(request.url)
    } catch {
      // If relative, use host from headers or default to localhost
      const host = request.headers.get('host') || 'localhost'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      return new URL(request.url, `${protocol}://${host}`)
    }
  }

  /**
   * Extract client IP from request headers (supports proxies)
   */
  private getClientIP(request: Request): string {
    // Check common proxy headers in order of priority
    const xForwardedFor = request.headers.get('x-forwarded-for')
    if (xForwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first (original client)
      return xForwardedFor.split(',')[0].trim()
    }

    const xRealIP = request.headers.get('x-real-ip')
    if (xRealIP) {
      return xRealIP.trim()
    }

    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    if (cfConnectingIP) {
      return cfConnectingIP.trim()
    }

    // Fallback: try to get from Bun's server socket (if available)
    // This is set by Bun when running in server mode
    const socketIP = (request as any).ip || (request as any).remoteAddress
    if (socketIP) {
      return socketIP
    }

    return '127.0.0.1'
  }

  constructor(config?: Partial<FluxStackConfig>) {
    // Load the full configuration
    const fullConfig = config ? { ...fluxStackConfig, ...config } : fluxStackConfig
    const envInfo = getEnvironmentInfo()

    this.context = {
      config: fullConfig,
      isDevelopment: envInfo.isDevelopment,
      isProduction: envInfo.isProduction,
      isTest: envInfo.isTest,
      environment: envInfo.name
    }

    this.app = new Elysia()
    this.pluginRegistry = new PluginRegistry()

    // Execute onConfigLoad hooks will be called during plugin initialization
    // We defer this until plugins are loaded in initializeAutomaticPlugins()



    // Create plugin utilities
    const pluginUtils: PluginUtils = {
      createTimer,
      formatBytes,
      isProduction,
      isDevelopment,
      getEnvironment: () => envInfo.name,
      createHash: (data: string) => {
        const crypto = require('crypto')
        return crypto.createHash('sha256').update(data).digest('hex')
      },
      deepMerge: (target: any, source: any) => {
        const result = { ...target }
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = pluginUtils.deepMerge(result[key] || {}, source[key])
          } else {
            result[key] = source[key]
          }
        }
        return result
      },
      validateSchema: (_data: any, _schema: any) => {
        // Simple validation - in a real implementation you'd use a proper schema validator
        try {
          // Basic validation logic
          return { valid: true, errors: [] }
        } catch (error) {
          return { valid: false, errors: [error instanceof Error ? error.message : 'Validation failed'] }
        }
      }
    }

    // Create plugin-compatible logger interface
    interface PluginLogger {
      debug: (message: string, meta?: unknown) => void
      info: (message: string, meta?: unknown) => void
      warn: (message: string, meta?: unknown) => void
      error: (message: string, meta?: unknown) => void
      child: (context: Record<string, unknown>) => PluginLogger
      time: (label: string) => void
      timeEnd: (label: string) => void
      request: (method: string, path: string, status?: number, duration?: number, ip?: string) => void
    }

    const pluginLogger: PluginLogger = {
      debug: (message: string, meta?: unknown) => logger.debug(message, meta),
      info: (message: string, meta?: unknown) => logger.info(message, meta),
      warn: (message: string, meta?: unknown) => logger.warn(message, meta),
      error: (message: string, meta?: unknown) => logger.error(message, meta),
      child: (context: Record<string, unknown>) => pluginLogger,
      time: (label: string) => logger.time(label),
      timeEnd: (label: string) => logger.timeEnd(label),
      request: (method: string, path: string, status?: number, duration?: number, ip?: string) =>
        logger.request(method, path, status, duration, ip)
    }

    this.pluginContext = {
      config: fullConfig,
      logger: pluginLogger as any,
      app: this.app,
      utils: pluginUtils
    }

    // Initialize plugin manager
    this.pluginManager = new PluginManager({
      config: fullConfig,
      logger: pluginLogger as any,
      app: this.app
    })

    this.setupCors()
    this.setupHeadHandler()
    this.setupElysiaHeadBugFilter()
    this.setupHooks()
    this.setupErrorHandling()

    logger.debug('FluxStack framework initialized', {
      environment: envInfo.name,
      port: fullConfig.server.port
    })

    // Initialize automatic plugin discovery in background
    this.initializeAutomaticPlugins().catch(error => {
      logger.error('Failed to initialize automatic plugins', { error })
    })
  }

  private async initializeAutomaticPlugins() {
    try {
      await this.pluginManager.initialize()

      // Sync discovered plugins from PluginManager to main registry
      const discoveredPlugins = this.pluginManager.getRegistry().getAll()
      for (const plugin of discoveredPlugins) {
        if (!this.pluginRegistry.has(plugin.name)) {
          // Register in main registry (synchronously, will call setup in start())
          (this.pluginRegistry as any).plugins.set(plugin.name, plugin)
          if (plugin.dependencies) {
            (this.pluginRegistry as any).dependencies.set(plugin.name, plugin.dependencies)
          }
        }
      }

      // Update load order
      try {
        (this.pluginRegistry as any).updateLoadOrder()
      } catch (error) {
        // Fallback: create basic load order
        const plugins = (this.pluginRegistry as any).plugins as Map<string, FluxStack.Plugin>
        const loadOrder = Array.from(plugins.keys())
        ;(this.pluginRegistry as any).loadOrder = loadOrder
      }

      // Execute onConfigLoad hooks for all plugins
      const configLoadContext = {
        config: this.context.config,
        envVars: process.env as Record<string, string | undefined>,
        configPath: undefined
      }

      const loadOrder = this.pluginRegistry.getLoadOrder()
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)
        if (plugin && plugin.onConfigLoad) {
          try {
            await plugin.onConfigLoad(configLoadContext)
          } catch (error) {
            logger.error(`Plugin '${pluginName}' onConfigLoad hook failed`, {
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      }

      const stats = this.pluginManager.getRegistry().getStats()
      logger.debug('Automatic plugins loaded successfully', {
        pluginCount: stats.totalPlugins,
        enabledPlugins: stats.enabledPlugins,
        disabledPlugins: stats.disabledPlugins
      })
    } catch (error) {
      logger.error('Failed to initialize automatic plugins', { error })
    }
  }

  private setupCors() {
    const cors = this.context.config.cors

    this.app
      .onRequest(({ set }) => {
        set.headers["Access-Control-Allow-Origin"] = cors.origins.join(", ") || "*"
        set.headers["Access-Control-Allow-Methods"] = cors.methods.join(", ") || "*"
        set.headers["Access-Control-Allow-Headers"] = cors.headers.join(", ") || "*"
        if (cors.credentials) {
          set.headers["Access-Control-Allow-Credentials"] = "true"
        }
      })
      .options("*", ({ set }) => {
        set.status = 200
        return ""
      })
  }

  private setupHeadHandler() {
    // Global HEAD handler to prevent Elysia's automatic HEAD conversion bug
    this.app.head("*", ({ request, set }) => {
      const url = this.parseRequestURL(request)

      // Handle API routes
      if (url.pathname.startsWith(this.context.config.server.apiPrefix)) {
        set.status = 200
        set.headers['Content-Type'] = 'application/json'
        set.headers['Content-Length'] = '0'
        return ""
      }

      // Handle static files (assume they're HTML if no extension)
      const isStatic = url.pathname === '/' || !url.pathname.includes('.')
      if (isStatic) {
        set.status = 200
        set.headers['Content-Type'] = 'text/html'
        set.headers['Content-Length'] = '478' // approximate size of index.html
        set.headers['Cache-Control'] = 'no-cache'
        return ""
      }

      // Handle other file types
      set.status = 200
      set.headers['Content-Type'] = 'application/octet-stream'
      set.headers['Content-Length'] = '0'
      return ""
    })
  }

  private setupElysiaHeadBugFilter() {
    // Only filter in development mode to avoid affecting production logs
    if (process.env.NODE_ENV !== 'development') {
      return
    }

    // Store original stderr.write to restore if needed
    const originalStderrWrite = process.stderr.write

    // Override stderr.write to filter Elysia HEAD bug errors
    process.stderr.write = function (
      chunk: string | Uint8Array,
      encoding?: BufferEncoding | ((error?: Error) => void),
      callback?: (error?: Error) => void
    ): boolean {
      const str = chunk.toString()

      // Filter out known Elysia HEAD bug error patterns
      if (str.includes("TypeError: undefined is not an object (evaluating '_res.headers.set')") ||
        str.includes("HEAD - / failed") ||
        (str.includes("HEAD - ") && str.includes(" failed"))) {
        // Silently ignore these specific errors
        if (typeof encoding === 'function') {
          encoding() // encoding is actually the callback
        } else if (callback) {
          callback()
        }
        return true
      }

      // Pass through all other stderr output
      if (typeof encoding === 'function') {
        return (originalStderrWrite as Function).call(process.stderr, chunk, encoding)
      } else {
        return (originalStderrWrite as Function).call(process.stderr, chunk, encoding, callback)
      }
    }

      // Store reference to restore original behavior if needed
      ; (this as any)._originalStderrWrite = originalStderrWrite
  }

  private setupHooks() {
    // Setup onRequest hook and onBeforeRoute hook
    this.app.onRequest(async ({ request, set }) => {
      const startTime = Date.now()
      const url = this.parseRequestURL(request)

      // Store start time for duration calculation (using request URL as key)
      const requestKey = `${request.method}-${url.pathname}-${startTime}`
      this.requestTimings.set(requestKey, startTime)

      // Store key in set.headers for retrieval in onAfterHandle
      set.headers['x-request-timing-key'] = requestKey

      const requestContext = {
        request,
        path: url.pathname,
        method: request.method,
        headers: (() => {
          const headers: Record<string, string> = {}
          request.headers.forEach((value: string, key: string) => {
            headers[key] = value
          })
          return headers
        })(),
        query: Object.fromEntries(url.searchParams.entries()),
        params: {},
        body: undefined, // Will be populated if request has body
        startTime,
        handled: false,
        response: undefined
      }

      // Try to parse body for validation
      try {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          const contentType = request.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            requestContext.body = await request.clone().json().catch(() => undefined)
          }
        }
      } catch (error) {
        // Ignore body parsing errors for now
      }

      // Execute onRequest hooks for all plugins first (logging, auth, etc.)
      await this.executePluginHooks('onRequest', requestContext)

      // Execute onRequestValidation hooks (for custom validation)
      const validationContext = {
        ...requestContext,
        errors: [] as Array<{ field: string; message: string; code: string }>,
        isValid: true
      }
      await this.executePluginHooks('onRequestValidation', validationContext)

      // If validation failed, return error response
      if (!validationContext.isValid && validationContext.errors.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          errors: validationContext.errors
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Execute onBeforeRoute hooks - allow plugins to handle requests before routing
      const handledResponse = await this.executePluginBeforeRouteHooks(requestContext)

      // If a plugin handled the request, return the response
      if (handledResponse) {
        return handledResponse
      }
    })

    // Setup onAfterHandle hook (covers onBeforeResponse, onResponseTransform, onResponse)
    this.app.onAfterHandle(async ({ request, response, set, path }) => {
      const url = this.parseRequestURL(request)

      // Retrieve start time using the timing key
      const requestKey = set.headers['x-request-timing-key']
      const startTime = requestKey ? this.requestTimings.get(String(requestKey)) : undefined
      const duration = startTime ? Date.now() - startTime : 0

      // Clean up timing entry
      if (requestKey) {
        this.requestTimings.delete(String(requestKey))
      }

      let currentResponse = response

      // Create response context
      const responseContext = {
        request,
        path: url.pathname,
        method: request.method,
        headers: (() => {
          const headers: Record<string, string> = {}
          request.headers.forEach((value: string, key: string) => {
            headers[key] = value
          })
          return headers
        })(),
        query: Object.fromEntries(url.searchParams.entries()),
        params: {},
        response: currentResponse,
        statusCode: Number((currentResponse as any)?.status || set.status || 200),
        duration,
        startTime
      }

      // Execute onAfterRoute hooks (route was matched, params available)
      const routeContext = {
        ...responseContext,
        route: path || url.pathname,
        handler: undefined
      }
      await this.executePluginHooks('onAfterRoute', routeContext)

      // Execute onBeforeResponse hooks (can modify headers, response)
      await this.executePluginHooks('onBeforeResponse', responseContext)
      currentResponse = responseContext.response

      // Execute onResponseTransform hooks (can transform response body)
      const transformContext = {
        ...responseContext,
        response: currentResponse,
        transformed: false,
        originalResponse: currentResponse
      }
      await this.executePluginHooks('onResponseTransform', transformContext)

      // Use transformed response if any plugin transformed it
      if (transformContext.transformed && transformContext.response) {
        currentResponse = transformContext.response
        responseContext.response = currentResponse
      }

      // Log the request automatically (if not disabled in config)
      if (this.context.config.server.enableRequestLogging !== false) {
        // Ensure status is always a number (HTTP status code)
        const status = typeof responseContext.statusCode === 'number'
          ? responseContext.statusCode
          : Number(set.status) || 200

        const clientIP = this.getClientIP(request)
        logger.request(request.method, url.pathname, status, duration, clientIP)
      }

      // Execute onResponse hooks for all plugins (final logging, metrics)
      await this.executePluginHooks('onResponse', responseContext)

      // Return the potentially transformed response
      return currentResponse
    })
  }

  private setupErrorHandling() {
    this.app.onError(async ({ error, request, code, set }) => {
      const url = this.parseRequestURL(request)

      // Let plugins handle errors first (e.g. Vite SPA fallback)
      const errorContext = {
        request,
        path: url.pathname,
        method: request.method,
        error: error instanceof Error ? error : new Error(String(error)),
        handled: false,
        startTime: Date.now()
      }

      const handledResponse = await this.executePluginErrorHooks(errorContext)
      if (handledResponse) {
        return handledResponse
      }

      // For Elysia's own errors (validation, not found, parse), let them pass through
      // Elysia sets proper status codes and messages natively
      if (code === 'VALIDATION' || code === 'PARSE' || code === 'NOT_FOUND') {
        return
      }

      // For FluxStackErrors, use their status code and message
      if (error instanceof FluxStackError) {
        set.status = error.statusCode
        return {
          error: error.code,
          message: error.userMessage || error.message,
          ...(this.context.isDevelopment && { stack: error.stack })
        }
      }

      // Log unexpected errors (actual 500s)
      logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`, {
        path: url.pathname,
        method: request.method
      })

      set.status = 500
      return {
        error: 'INTERNAL_SERVER_ERROR',
        message: this.context.isDevelopment
          ? (error instanceof Error ? error.message : String(error))
          : 'An unexpected error occurred'
      }
    })
  }

  private async executePluginHooks(hookName: string, context: any): Promise<void> {
    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const pluginName of loadOrder) {
      const plugin = this.pluginRegistry.get(pluginName)
      if (!plugin) continue

      const hookFn = (plugin as any)[hookName]
      if (typeof hookFn === 'function') {
        try {
          await hookFn(context)
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          logger.error(`Plugin '${pluginName}' ${hookName} hook failed`, {
            error: err.message
          })

          // Execute onPluginError hooks on all plugins (except the one that failed)
          await this.executePluginErrorHook(pluginName, plugin.version, err)
        }
      }
    }
  }

  private async executePluginErrorHook(pluginName: string, pluginVersion: string | undefined, error: Error): Promise<void> {
    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const otherPluginName of loadOrder) {
      if (otherPluginName === pluginName) continue // Don't notify the plugin that failed

      const otherPlugin = this.pluginRegistry.get(otherPluginName)
      if (!otherPlugin) continue

      const hookFn = (otherPlugin as any).onPluginError
      if (typeof hookFn === 'function') {
        try {
          await hookFn({
            pluginName,
            pluginVersion,
            timestamp: Date.now(),
            error
          })
        } catch (hookError) {
          logger.error(`Plugin '${otherPluginName}' onPluginError hook failed`, {
            error: hookError instanceof Error ? hookError.message : String(hookError)
          })
        }
      }
    }
  }

  private async executePluginBeforeRouteHooks(requestContext: any): Promise<Response | null> {
    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const pluginName of loadOrder) {
      const plugin = this.pluginRegistry.get(pluginName)
      if (!plugin) continue

      const onBeforeRouteFn = (plugin as any).onBeforeRoute
      if (typeof onBeforeRouteFn === 'function') {
        try {
          await onBeforeRouteFn(requestContext)

          // If this plugin handled the request, return the response
          if (requestContext.handled && requestContext.response) {
            return requestContext.response
          }
        } catch (error) {
          logger.error(`Plugin '${pluginName}' onBeforeRoute hook failed`, {
            error: (error as Error).message
          })
        }
      }
    }

    return null
  }

  private async executePluginErrorHooks(errorContext: any): Promise<Response | null> {
    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const pluginName of loadOrder) {
      const plugin = this.pluginRegistry.get(pluginName)
      if (!plugin) continue

      const onErrorFn = (plugin as any).onError
      if (typeof onErrorFn === 'function') {
        try {
          await onErrorFn(errorContext)

          // If this plugin handled the error, check if it provides a response
          if (errorContext.handled) {
            // For Vite plugin, we'll handle the proxy here
            if (pluginName === 'vite' && errorContext.error.constructor.name === 'NotFoundError') {
              return await this.handleViteProxy(errorContext)
            }

            // For other plugins, return a basic success response
            return new Response('OK', { status: 200 })
          }
        } catch (error) {
          logger.error(`Plugin '${pluginName}' onError hook failed`, {
            error: (error as Error).message
          })
        }
      }
    }

    return null
  }

  private async handleViteProxy(errorContext: any): Promise<Response> {
    const vitePort = this.context.config.client?.port || 5173
    const url = this.parseRequestURL(errorContext.request)

    try {
      const viteUrl = `http://localhost:${vitePort}${url.pathname}${url.search}`

      // Forward request to Vite
      const response = await fetch(viteUrl, {
        method: errorContext.method,
        headers: errorContext.headers
      })

      // Return a proper Response object with all headers and status
      const body = await response.arrayBuffer()

      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })

    } catch (viteError) {
      // If Vite fails, return error response
      return new Response(`Vite server not ready on port ${vitePort}. Error: ${viteError}`, {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  }

  use(plugin: Plugin) {
    try {
      // Use the registry's public register method, but don't await it since we need sync operation
      if (this.pluginRegistry.has(plugin.name)) {
        throw new Error(`Plugin '${plugin.name}' is already registered`)
      }

      // Store plugin without calling setup - setup will be called in start()
      // We need to manually set the plugin since register() is async but we need sync
      (this.pluginRegistry as any).plugins.set(plugin.name, plugin)

      // Update dependencies tracking
      if ((plugin as FluxStack.Plugin).dependencies) {
        (this.pluginRegistry as any).dependencies.set(plugin.name, (plugin as FluxStack.Plugin).dependencies)
      }

      // Update load order by calling the private method
      try {
        (this.pluginRegistry as any).updateLoadOrder()
      } catch (error) {
        // Fallback: create basic load order
        const plugins = (this.pluginRegistry as any).plugins as Map<string, Plugin>
        const loadOrder = Array.from(plugins.keys())
          ; (this.pluginRegistry as any).loadOrder = loadOrder
      }

      logger.debug(`Plugin '${plugin.name}' registered`, {
        version: (plugin as FluxStack.Plugin).version,
        dependencies: (plugin as FluxStack.Plugin).dependencies
      })
      return this
    } catch (error) {
      logger.error(`Failed to register plugin '${plugin.name}'`, { error: (error as Error).message })
      throw error
    }
  }

  routes(routeModule: any) {
    this.app.use(routeModule)
    return this
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Framework is already started')
      return
    }

    try {
      // Validate plugin dependencies before starting
      const plugins = (this.pluginRegistry as any).plugins as Map<string, FluxStack.Plugin>
      for (const [pluginName, plugin] of plugins) {
        if (plugin.dependencies) {
          for (const depName of plugin.dependencies) {
            if (!plugins.has(depName)) {
              throw new Error(`Plugin '${pluginName}' depends on '${depName}' which is not registered`)
            }
          }
        }
      }

      // Get load order
      const loadOrder = this.pluginRegistry.getLoadOrder()

      // Call setup hooks for all plugins
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        // Call setup hook if it exists and hasn't been called
        if (plugin.setup) {
          await plugin.setup(this.pluginContext)
        }
      }

      // Call onBeforeServerStart hooks
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onBeforeServerStart) {
          await plugin.onBeforeServerStart(this.pluginContext)
        }
      }

      // Mount plugin routes if they have a plugin property
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if ((plugin as any).plugin) {
          this.app.use((plugin as any).plugin)
          logger.debug(`Plugin '${pluginName}' routes mounted`)
        }
      }

      // Call onServerStart hooks
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onServerStart) {
          await plugin.onServerStart(this.pluginContext)
        }
      }

      // Call onAfterServerStart hooks
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onAfterServerStart) {
          await plugin.onAfterServerStart(this.pluginContext)
        }
      }

      this.isStarted = true
      logger.debug('All plugins loaded successfully', {
        pluginCount: loadOrder.length
      })

    } catch (error) {
      logger.error('Failed to start framework', { error: (error as Error).message })
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return
    }

    try {
      // Call onBeforeServerStop hooks in reverse order
      const loadOrder = this.pluginRegistry.getLoadOrder().reverse()

      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onBeforeServerStop) {
          await plugin.onBeforeServerStop(this.pluginContext)
        }
      }

      // Call onServerStop hooks in reverse order
      for (const pluginName of loadOrder) {
        const plugin = this.pluginRegistry.get(pluginName)!

        if (plugin.onServerStop) {
          await plugin.onServerStop(this.pluginContext)
          logger.framework(`Plugin '${pluginName}' server stop hook completed`)
        }
      }

      this.isStarted = false
      logger.framework('Framework stopped successfully')

    } catch (error) {
      logger.error('Error during framework shutdown', { error: (error as Error).message })
      throw error
    }
  }

  getApp() {
    return this.app
  }

  getContext() {
    return this.context
  }

  getPluginRegistry() {
    return this.pluginRegistry
  }

  async listen(callback?: () => void) {
    // Start the framework (load plugins)
    await this.start()

    const port = this.context.config.server.port
    const apiPrefix = this.context.config.server.apiPrefix

    this.app.listen(port, () => {
      const showBanner = this.context.config.server.showBanner !== false // default: true
      const vitePluginActive = this.pluginRegistry.has('vite')

      // Prepare startup info for banner or callback
      const startupInfo: StartupInfo = {
        port,
        host: this.context.config.server.host || 'localhost',
        apiPrefix,
        environment: this.context.environment,
        pluginCount: this.pluginRegistry.getAll().length,
        vitePort: this.context.config.client?.port,
        viteEmbedded: vitePluginActive, // Vite is embedded when plugin is active
        swaggerPath: '/swagger', // TODO: Get from swagger plugin config
        liveComponents: componentRegistry.getRegisteredComponentNames()
      }

      // Display banner if enabled
      if (showBanner) {
        displayStartupBanner(startupInfo)
      }

      // Call user callback with startup info
      callback?.()
    })

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.framework('Received SIGTERM, shutting down gracefully')
      await this.stop()
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      logger.framework('Received SIGINT, shutting down gracefully')
      await this.stop()
      process.exit(0)
    })
  }
}