import { copyFileSync, writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"
import type { FluxStackConfig } from "../config"
import type { BuildResult, BuildManifest } from "../types/build"
import { Bundler } from "./bundler"
import { Optimizer } from "./optimizer"
import { FLUXSTACK_VERSION } from "../utils/version"
import { buildLogger } from "../utils/build-logger"
import type { PluginRegistry } from "../plugins/registry"
import type { BuildContext, BuildAssetContext, BuildErrorContext } from "../plugins/types"

export class FluxStackBuilder {
  private config: FluxStackConfig
  private bundler: Bundler
  private optimizer: Optimizer
  private pluginRegistry?: PluginRegistry

  constructor(config: FluxStackConfig, pluginRegistry?: PluginRegistry) {
    this.config = config
    this.pluginRegistry = pluginRegistry

    const optimization = this.config.optimization || {
      minify: true,
      treeshake: true,
      compress: true,
      removeUnusedCSS: false,
      optimizeImages: false,
      bundleAnalyzer: false
    }

    // Initialize bundler with configuration
    this.bundler = new Bundler({
      target: config.build.target ?? 'bun',
      outDir: config.build.outDir ?? 'dist',
      sourceMaps: config.build.sourceMaps ?? false,
      minify: optimization.minify,
      external: config.build.external || []
    })

    // Initialize optimizer with configuration
    this.optimizer = new Optimizer({
      treeshake: optimization.treeshake ?? true,
      compress: optimization.compress || false,
      removeUnusedCSS: optimization.removeUnusedCSS || false,
      optimizeImages: optimization.optimizeImages || false,
      bundleAnalysis: optimization.bundleAnalyzer || false
    })
  }

  async buildClient() {
    return await this.bundler.bundleClient({
      env: {
        VITE_BUILD_OUTDIR: this.config.clientBuild.outDir ?? 'dist/client',
        VITE_BUILD_SOURCEMAPS: (this.config.clientBuild.sourceMaps ?? false).toString()
      }
    })
  }

  async buildServer() {
    return await this.bundler.bundleServer("app/server/index.ts")
  }

  async buildExecutable(outputName?: string, options?: import("../types/build").BundleOptions) {
    // Use app name from config as default, fallback to "FluxStack"
    const name = outputName || this.config.app.name || "FluxStack"
    return await this.bundler.compileToExecutable("app/server/index.ts", name, options)
  }

  async createDockerFiles() {
    buildLogger.section('Docker Configuration', '🐳')

    const distDir = this.config.build.outDir ?? 'dist'
    buildLogger.step(`Output directory: ${distDir}`)

    // Ensure dist directory exists
    if (!existsSync(distDir)) {
      buildLogger.step(`Creating directory: ${distDir}`)
      mkdirSync(distDir, { recursive: true })
      buildLogger.success('Directory created successfully')
    } else {
      buildLogger.success('Directory already exists')
    }

    // Get current Bun version for Docker image
    const bunVersion = typeof Bun !== 'undefined' ? Bun.version : '1.3'

    // Dockerfile optimizado para produção
    const dockerfile = `# FluxStack Production Docker Image
FROM oven/bun:${bunVersion}-alpine AS production

WORKDIR /app

# Copy package.json first for better caching
COPY package.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy built application
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S fluxstack && \\
    adduser -S fluxstack -u 1001

# Set permissions
RUN chown -R fluxstack:fluxstack /app
USER fluxstack

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD bun run -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1))" || exit 1

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "index.js"]
`

    // docker-compose.yml para deploy rápido
    const dockerCompose = `version: '3.8'

services:
  fluxstack:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "bun", "run", "-e", "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1))"]
      interval: 30s
      timeout: 3s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  # Opcional: adicionar nginx reverse proxy
  # nginx:
  #   image: nginx:alpine
  #   ports:
  #     - "80:80"
  #   volumes:
  #     - ./nginx.conf:/etc/nginx/nginx.conf
  #   depends_on:
  #     - fluxstack
  #   restart: unless-stopped
`

    // .dockerignore otimizado
    const dockerignore = `node_modules
.git
.gitignore
README.md
.env.local
.env.*.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.log
coverage
.nyc_output
.vscode
.idea
*.swp
*.swo
`

    // Escrever arquivos no dist
    try {
      buildLogger.step('Writing Dockerfile...')
      writeFileSync(join(distDir, "Dockerfile"), dockerfile)
      buildLogger.step('Writing docker-compose.yml...')
      writeFileSync(join(distDir, "docker-compose.yml"), dockerCompose)
      buildLogger.step('Writing .dockerignore...')
      writeFileSync(join(distDir, ".dockerignore"), dockerignore)
    } catch (error) {
      buildLogger.error(`Error writing Docker files: ${error}`)
      throw error
    }

    // Copiar .env ou criar um de exemplo
    const envPath = join(process.cwd(), '.env')
    const envExamplePath = join(process.cwd(), '.env.example')
    const distEnvPath = join(distDir, ".env")

    buildLogger.step('Configuring environment files...')

    if (existsSync(envPath)) {
      // Read .env content
      let envContent = readFileSync(envPath, 'utf-8')
      // Replace development with production
      envContent = envContent.replace(/NODE_ENV=development/g, 'NODE_ENV=production')
      envContent = envContent.replace(/VITE_NODE_ENV=development/g, 'VITE_NODE_ENV=production')
      // Write to dist
      writeFileSync(distEnvPath, envContent)
      buildLogger.success("Environment file copied (NODE_ENV=production)")
    } else if (existsSync(envExamplePath)) {
      copyFileSync(envExamplePath, distEnvPath)
      buildLogger.success("Example environment file copied")
    } else {
      // Criar um .env básico para produção
      const defaultEnv = `NODE_ENV=production
PORT=3000
FLUXSTACK_APP_NAME=fluxstack-app
FLUXSTACK_APP_VERSION=${FLUXSTACK_VERSION}
LOG_LEVEL=info
MONITORING_ENABLED=true
`
      writeFileSync(distEnvPath, defaultEnv)
      buildLogger.success("Default environment file created")
    }

    // Copy package.json for Docker build
    const packageJsonPath = join(process.cwd(), 'package.json')
    const distPackageJsonPath = join(distDir, 'package.json')

    buildLogger.step('Copying package.json...')

    if (existsSync(packageJsonPath)) {
      copyFileSync(packageJsonPath, distPackageJsonPath)
      buildLogger.success("Package.json copied successfully")
    } else {
      buildLogger.warn("package.json not found, creating minimal version...")
      const minimalPackageJson = {
        name: "fluxstack-app",
        version: "1.0.0",
        type: "module",
        scripts: {
          start: "bun run index.js"
        },
        dependencies: {}
      }
      writeFileSync(distPackageJsonPath, JSON.stringify(minimalPackageJson, null, 2))
    }

    buildLogger.success("Docker configuration completed")
  }


  async build(): Promise<BuildResult> {
    buildLogger.header('⚡ FluxStack Build')
    buildLogger.startTimer()

    const startTime = Date.now()

    const buildContext: BuildContext = {
      target: this.config.build.target ?? 'bun',
      outDir: this.config.build.outDir ?? 'dist',
      mode: (this.config.build.mode ?? 'production') as 'development' | 'production',
      config: this.config
    }

    try {
      // Execute onBeforeBuild hooks
      await this.executePluginHooks('onBeforeBuild', buildContext)

      // Pre-build checks (version sync, etc.)
      await this.runPreBuildChecks()

      // Validate configuration
      await this.validateConfig()

      // Clean output directory if requested
      if (this.config.build.clean) {
        await this.clean()
      }

      // Execute onBuild hooks
      await this.executePluginHooks('onBuild', buildContext)

      // Build client and server
      const clientResult = await this.buildClient()
      const serverResult = await this.buildServer()

      // Check if builds were successful
      if (!clientResult.success || !serverResult.success) {
        const errorMessage = clientResult.error || serverResult.error || "Build failed"

        // Execute onBuildError hooks
        const buildErrorContext: BuildErrorContext = {
          error: new Error(errorMessage),
          file: undefined,
          line: undefined,
          column: undefined
        }
        await this.executePluginHooks('onBuildError', buildErrorContext)

        return {
          success: false,
          duration: Date.now() - startTime,
          outputFiles: [],
          warnings: [],
          errors: [{
            message: errorMessage,
            code: 'BUILD_FAILED'
          }],
          stats: {
            totalSize: 0,
            gzippedSize: 0,
            chunkCount: 0,
            assetCount: 0,
            entryPoints: [],
            dependencies: []
          }
        }
      }

      // Process assets and execute onBuildAsset hooks
      await this.processAssets(this.config.build.outDir ?? 'dist')

      // Optimize build if enabled
      let optimizationResult
      if (this.config.build.optimize) {
        optimizationResult = await this.optimizer.optimize(this.config.build.outDir ?? 'dist')
      }

      // Create Docker files
      await this.createDockerFiles()

      // Generate build manifest
      const manifest = await this.generateManifest(clientResult, serverResult, optimizationResult)

      const duration = Date.now() - startTime

      // Execute onBuildComplete hooks
      await this.executePluginHooks('onBuildComplete', buildContext)

      // Print build summary
      buildLogger.summary('Build Completed Successfully', [
        { label: 'Build Time', value: buildLogger.formatDuration(duration), highlight: true },
        { label: 'Output Directory', value: this.config.build.outDir ?? 'dist' },
        { label: 'Client Assets', value: clientResult.assets?.length || 0 },
        { label: 'Total Size', value: buildLogger.formatSize(optimizationResult?.optimizedSize || 0) },
        { label: 'Compression', value: optimizationResult?.compressionRatio ? `${optimizationResult.compressionRatio.toFixed(2)}%` : 'N/A' },
        { label: 'Docker Ready', value: '✓', highlight: true }
      ])

      return {
        success: true,
        duration,
        outputFiles: [],
        warnings: [],
        errors: [],
        stats: {
          totalSize: optimizationResult?.optimizedSize || 0,
          gzippedSize: 0,
          chunkCount: 0,
          assetCount: clientResult.assets?.length || 0,
          entryPoints: [serverResult.entryPoint || ""].filter(Boolean),
          dependencies: []
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : "Unknown build error"

      buildLogger.error(`Build failed: ${errorMessage}`)

      // Execute onBuildError hooks
      const buildErrorContext: BuildErrorContext = {
        error: error instanceof Error ? error : new Error(errorMessage),
        file: undefined,
        line: undefined,
        column: undefined
      }
      await this.executePluginHooks('onBuildError', buildErrorContext)

      return {
        success: false,
        duration,
        outputFiles: [],
        warnings: [],
        errors: [{
          message: errorMessage,
          code: 'BUILD_EXCEPTION',
          stack: error instanceof Error ? error.stack : undefined
        }],
        stats: {
          totalSize: 0,
          gzippedSize: 0,
          chunkCount: 0,
          assetCount: 0,
          entryPoints: [],
          dependencies: []
        }
      }
    }
  }

  private async runPreBuildChecks(): Promise<void> {
    try {
      // Import and run version sync silently
      const { syncVersion } = await import("../utils/sync-version")
      syncVersion(true) // Pass true for silent mode
    } catch (error) {
      // Silently handle pre-build check failures
      // Don't fail the build for pre-build check failures
    }
  }

  private async validateConfig(): Promise<void> {
    // Validate build configuration
    if (!this.config.build.outDir) {
      throw new Error("Build output directory not specified")
    }

    if (!this.config.build.target) {
      throw new Error("Build target not specified")
    }
  }

  private async clean(): Promise<void> {
    // Clean output directory - implementation would go here
    buildLogger.step("Cleaning output directory...")
  }

  private async generateManifest(
    clientResult: any,
    serverResult: any,
    optimizationResult?: any
  ): Promise<BuildManifest> {
    return {
      version: this.config.app.version ?? '0.0.0',
      timestamp: new Date().toISOString(),
      target: this.config.build.target ?? 'bun',
      mode: this.config.build.mode ?? 'production',
      client: {
        entryPoints: [],
        chunks: [],
        assets: clientResult.assets || [],
        publicPath: '/'
      },
      server: {
        entryPoint: serverResult.entryPoint || '',
        dependencies: [],
        externals: this.config.build.external || []
      },
      assets: [],
      optimization: {
        minified: this.config.optimization?.minify ?? false,
        treeshaken: this.config.optimization?.treeshake ?? false,
        compressed: this.config.optimization?.compress ?? false,
        originalSize: optimizationResult?.originalSize || 0,
        optimizedSize: optimizationResult?.optimizedSize || 0,
        compressionRatio: optimizationResult?.compressionRatio || 0
      },
      metrics: {
        buildTime: clientResult.duration + serverResult.duration,
        bundleTime: 0,
        optimizationTime: optimizationResult?.duration || 0,
        totalSize: optimizationResult?.optimizedSize || 0,
        gzippedSize: 0,
        chunkCount: 0,
        assetCount: clientResult.assets?.length || 0
      }
    }
  }

  /**
   * Execute plugin hooks for build process
   */
  private async executePluginHooks(hookName: string, context: any): Promise<void> {
    if (!this.pluginRegistry) return

    const loadOrder = this.pluginRegistry.getLoadOrder()

    for (const pluginName of loadOrder) {
      const plugin = this.pluginRegistry.get(pluginName)
      if (!plugin) continue

      const hookFn = (plugin as any)[hookName]
      if (typeof hookFn === 'function') {
        try {
          await hookFn(context)
        } catch (error) {
          buildLogger.error(`Plugin '${pluginName}' ${hookName} hook failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }

  /**
   * Process build assets and execute onBuildAsset hooks
   */
  private async processAssets(outDir: string): Promise<void> {
    if (!this.pluginRegistry) return
    if (!existsSync(outDir)) return

    try {
      const processDirectory = async (dir: string) => {
        const entries = readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = join(dir, entry.name)

          if (entry.isDirectory()) {
            await processDirectory(fullPath)
          } else if (entry.isFile()) {
            const stat = statSync(fullPath)
            const assetType = this.getAssetType(entry.name)

            const assetContext: BuildAssetContext = {
              assetPath: fullPath,
              assetType,
              size: stat.size,
              content: undefined // Could read file if plugins need it
            }

            await this.executePluginHooks('onBuildAsset', assetContext)
          }
        }
      }

      await processDirectory(outDir)
    } catch (error) {
      buildLogger.warn(`Failed to process assets: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Determine asset type from file extension
   */
  private getAssetType(filename: string): 'js' | 'css' | 'html' | 'image' | 'font' | 'other' {
    const ext = filename.split('.').pop()?.toLowerCase()

    if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'js'
    if (ext === 'css') return 'css'
    if (ext === 'html' || ext === 'htm') return 'html'
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'svg' || ext === 'webp') return 'image'
    if (ext === 'woff' || ext === 'woff2' || ext === 'ttf' || ext === 'eot' || ext === 'otf') return 'font'

    return 'other'
  }
}
