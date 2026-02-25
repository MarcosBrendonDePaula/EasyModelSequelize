/**
 * Build system types
 * Type definitions for build processes, bundling, and optimization
 */

export type BuildTarget = 'bun' | 'node' | 'docker' | 'static'
export type BuildMode = 'development' | 'production' | 'test'
export type BundleFormat = 'esm' | 'cjs' | 'iife' | 'umd'

export interface BuildOptions {
  target: BuildTarget
  mode: BuildMode
  outDir: string
  sourceMaps: boolean
  minify: boolean
  treeshake: boolean
  splitting: boolean
  watch: boolean
  clean: boolean
}

export interface BuildResult {
  success: boolean
  duration: number
  outputFiles: BuildOutputFile[]
  warnings: BuildWarning[]
  errors: BuildError[]
  stats: BuildStats
}

export interface BuildOutputFile {
  path: string
  size: number
  type: 'js' | 'css' | 'html' | 'asset'
  hash?: string
  sourcemap?: string
}

export interface BuildWarning {
  message: string
  file?: string
  line?: number
  column?: number
  code?: string
}

export interface BuildError {
  message: string
  file?: string
  line?: number
  column?: number
  code?: string
  stack?: string
}

export interface BuildStats {
  totalSize: number
  gzippedSize: number
  chunkCount: number
  assetCount: number
  entryPoints: string[]
  dependencies: string[]
}



export interface BundleResult {
  success: boolean
  duration: number
  outputPath?: string
  entryPoint?: string
  assets?: string[]
  error?: string
  code?: string
  map?: string
  imports?: string[]
  exports?: string[]
  warnings?: BuildWarning[]
}

export interface BundleOptions {
  env?: Record<string, string>
  external?: string[]
  minify?: boolean
  sourceMaps?: boolean
  target?: string
  executable?: ExecutableOptions
}

/**
 * Options for compiling standalone executables
 * Note: Cross-platform compilation is limited - executables are built for the current platform.
 * To build for different platforms, run the build on that platform.
 */
export interface ExecutableOptions {
  // Windows-specific options
  windows?: {
    hideConsole?: boolean
    icon?: string
    title?: string
    publisher?: string
    version?: string
    description?: string
    copyright?: string
  }
  // Additional custom build arguments
  customArgs?: string[]
}

export interface OptimizationOptions {
  minify: boolean
  treeshake: boolean
  deadCodeElimination: boolean
  constantFolding: boolean
  inlining: boolean
  compression: boolean
}

export interface OptimizationResult {
  success: boolean
  duration: number
  originalSize: number
  optimizedSize: number
  compressionRatio: number
  optimizations: OptimizationStep[]
  error?: string
  warnings?: BuildWarning[]
}

export interface OptimizationStep {
  type: string
  description: string
  sizeSaved: number
}

export interface OptimizationConfig {
  minify: boolean
  treeshake: boolean
  compress: boolean
  removeUnusedCSS: boolean
  optimizeImages: boolean
  bundleAnalysis: boolean
}

export interface BuildManifest {
  version: string
  timestamp: string
  target: BuildTarget
  mode: BuildMode
  client: ClientBuildManifest
  server: ServerBuildManifest
  assets: AssetManifest[]
  optimization: OptimizationManifest
  metrics: BuildMetrics
}

export interface ClientBuildManifest {
  entryPoints: string[]
  chunks: ChunkManifest[]
  assets: AssetManifest[]
  publicPath: string
}

export interface ServerBuildManifest {
  entryPoint: string
  dependencies: string[]
  externals: string[]
}

export interface ChunkManifest {
  name: string
  file: string
  size: number
  hash: string
  imports: string[]
  dynamicImports: string[]
}

export interface AssetManifest {
  name: string
  file: string
  size: number
  hash: string
  type: string
}

export interface OptimizationManifest {
  minified: boolean
  treeshaken: boolean
  compressed: boolean
  originalSize: number
  optimizedSize: number
  compressionRatio: number
}

export interface BuildMetrics {
  buildTime: number
  bundleTime: number
  optimizationTime: number
  totalSize: number
  gzippedSize: number
  chunkCount: number
  assetCount: number
}

export interface BuildCache {
  enabled: boolean
  directory: string
  strategy: 'filesystem' | 'memory' | 'hybrid'
  maxSize: number
  ttl: number
}

export interface BuildWatcher {
  enabled: boolean
  ignored: string[]
  polling: boolean
  interval: number
  debounce: number
}