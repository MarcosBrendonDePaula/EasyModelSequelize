/**
 * Module Resolver para Plugins
 * Implementa resolução em cascata: plugin local → projeto principal
 */

import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import type { Logger } from '@core/utils/logger'

export interface ModuleResolverConfig {
  projectRoot: string
  logger?: Logger
}

export class PluginModuleResolver {
  private config: ModuleResolverConfig
  private logger?: Logger
  private static readonly MAX_CACHE_SIZE = 1000
  private resolveCache: Map<string, string> = new Map()

  constructor(config: ModuleResolverConfig) {
    this.config = config
    this.logger = config.logger
  }

  private cacheSet(key: string, value: string): void {
    if (this.resolveCache.size >= PluginModuleResolver.MAX_CACHE_SIZE) {
      const firstKey = this.resolveCache.keys().next().value
      if (firstKey !== undefined) {
        this.resolveCache.delete(firstKey)
      }
    }
    this.resolveCache.set(key, value)
  }

  /**
   * Resolve um módulo com estratégia em cascata:
   * 1. node_modules local do plugin
   * 2. node_modules do projeto principal
   */
  resolveModule(moduleName: string, pluginPath: string): string | null {
    const cacheKey = `${pluginPath}::${moduleName}`

    // Verificar cache
    if (this.resolveCache.has(cacheKey)) {
      return this.resolveCache.get(cacheKey)!
    }

    this.logger?.debug(`Resolvendo módulo '${moduleName}' para plugin em '${pluginPath}'`)

    // 1. Tentar no node_modules local do plugin
    const localPath = this.tryResolveLocal(moduleName, pluginPath)
    if (localPath) {
      this.logger?.debug(`✅ Módulo '${moduleName}' encontrado localmente: ${localPath}`)
      this.cacheSet(cacheKey, localPath)
      return localPath
    }

    // 2. Tentar no node_modules do projeto principal
    const projectPath = this.tryResolveProject(moduleName)
    if (projectPath) {
      this.logger?.debug(`✅ Módulo '${moduleName}' encontrado no projeto: ${projectPath}`)
      this.cacheSet(cacheKey, projectPath)
      return projectPath
    }

    this.logger?.warn(`❌ Módulo '${moduleName}' não encontrado em nenhum contexto`)
    return null
  }

  /**
   * Tenta resolver no node_modules local do plugin
   */
  private tryResolveLocal(moduleName: string, pluginPath: string): string | null {
    const pluginDir = resolve(pluginPath)
    const localNodeModules = join(pluginDir, 'node_modules', moduleName)

    if (existsSync(localNodeModules)) {
      // Verificar se tem package.json para pegar o entry point
      const packageJsonPath = join(localNodeModules, 'package.json')
      if (existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
          const entry = pkg.module || pkg.main || 'index.js'
          const entryPath = join(localNodeModules, entry)

          if (existsSync(entryPath)) {
            return entryPath
          }
        } catch (error) {
          this.logger?.debug(`Erro ao ler package.json de '${moduleName}'`, { error })
        }
      }

      // Fallback: tentar index.js/index.ts
      const indexJs = join(localNodeModules, 'index.js')
      const indexTs = join(localNodeModules, 'index.ts')

      if (existsSync(indexJs)) return indexJs
      if (existsSync(indexTs)) return indexTs

      return localNodeModules
    }

    return null
  }

  /**
   * Tenta resolver no node_modules do projeto principal
   */
  private tryResolveProject(moduleName: string): string | null {
    const projectNodeModules = join(this.config.projectRoot, 'node_modules', moduleName)

    if (existsSync(projectNodeModules)) {
      // Verificar se tem package.json para pegar o entry point
      const packageJsonPath = join(projectNodeModules, 'package.json')
      if (existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
          const entry = pkg.module || pkg.main || 'index.js'
          const entryPath = join(projectNodeModules, entry)

          if (existsSync(entryPath)) {
            return entryPath
          }
        } catch (error) {
          this.logger?.debug(`Erro ao ler package.json de '${moduleName}'`, { error })
        }
      }

      // Fallback: tentar index.js/index.ts
      const indexJs = join(projectNodeModules, 'index.js')
      const indexTs = join(projectNodeModules, 'index.ts')

      if (existsSync(indexJs)) return indexJs
      if (existsSync(indexTs)) return indexTs

      return projectNodeModules
    }

    return null
  }

  /**
   * Resolve sub-paths (ex: @noble/curves/ed25519)
   */
  resolveSubpath(moduleName: string, subpath: string, pluginPath: string): string | null {
    const fullModule = `${moduleName}/${subpath}`
    const cacheKey = `${pluginPath}::${fullModule}`

    // Verificar cache
    if (this.resolveCache.has(cacheKey)) {
      return this.resolveCache.get(cacheKey)!
    }

    this.logger?.debug(`Resolvendo subpath '${fullModule}' para plugin em '${pluginPath}'`)

    // 1. Tentar no node_modules local do plugin
    const pluginDir = resolve(pluginPath)
    const localPath = join(pluginDir, 'node_modules', fullModule)

    if (this.existsWithExtension(localPath)) {
      const resolvedLocal = this.findFileWithExtension(localPath)
      if (resolvedLocal) {
        this.logger?.debug(`✅ Subpath '${fullModule}' encontrado localmente: ${resolvedLocal}`)
        this.cacheSet(cacheKey, resolvedLocal)
        return resolvedLocal
      }
    }

    // 2. Tentar no node_modules do projeto principal
    const projectPath = join(this.config.projectRoot, 'node_modules', fullModule)

    if (this.existsWithExtension(projectPath)) {
      const resolvedProject = this.findFileWithExtension(projectPath)
      if (resolvedProject) {
        this.logger?.debug(`✅ Subpath '${fullModule}' encontrado no projeto: ${resolvedProject}`)
        this.cacheSet(cacheKey, resolvedProject)
        return resolvedProject
      }
    }

    this.logger?.warn(`❌ Subpath '${fullModule}' não encontrado em nenhum contexto`)
    return null
  }

  /**
   * Verifica se arquivo existe com alguma extensão comum
   */
  private existsWithExtension(basePath: string): boolean {
    const extensions = ['', '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '/index.js', '/index.ts']
    return extensions.some(ext => existsSync(basePath + ext))
  }

  /**
   * Encontra arquivo com extensão
   */
  private findFileWithExtension(basePath: string): string | null {
    const extensions = ['', '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '/index.js', '/index.ts']

    for (const ext of extensions) {
      const fullPath = basePath + ext
      if (existsSync(fullPath)) {
        return fullPath
      }
    }

    return null
  }

  /**
   * Limpar cache
   */
  clearCache(): void {
    this.resolveCache.clear()
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      cachedModules: this.resolveCache.size,
      projectRoot: this.config.projectRoot
    }
  }
}
