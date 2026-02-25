/**
 * FluxStack Cache - Cache Manager
 *
 * Factory para drivers de cache. Extensível com extend().
 *
 * Uso:
 * ```ts
 * const cache = cacheManager.driver()      // driver padrão (memory)
 * const redis = cacheManager.driver('redis') // driver específico
 *
 * await cache.set('key', 'value', 60)
 * const val = await cache.get('key')
 * ```
 */

import type { CacheDriver } from './contracts'
import { MemoryCacheDriver } from './MemoryDriver'

type DriverFactory = () => CacheDriver

export class CacheManager {
  private drivers = new Map<string, CacheDriver>()
  private factories = new Map<string, DriverFactory>()
  private defaultDriverName: string

  constructor(defaultDriver: string = 'memory') {
    this.defaultDriverName = defaultDriver

    // Registrar driver padrão
    this.factories.set('memory', () => new MemoryCacheDriver())
  }

  /**
   * Retorna uma instância do driver de cache.
   * Drivers são criados uma vez e reutilizados (singleton por nome).
   */
  driver(name?: string): CacheDriver {
    const driverName = name ?? this.defaultDriverName

    // Cache de instâncias
    if (this.drivers.has(driverName)) {
      return this.drivers.get(driverName)!
    }

    const factory = this.factories.get(driverName)
    if (!factory) {
      throw new Error(
        `Cache driver '${driverName}' not registered. ` +
        `Available: ${Array.from(this.factories.keys()).join(', ')}`
      )
    }

    const driver = factory()
    this.drivers.set(driverName, driver)
    return driver
  }

  /**
   * Registra um driver customizado.
   *
   * ```ts
   * cacheManager.extend('redis', () => new RedisCacheDriver({ url: '...' }))
   * ```
   */
  extend(name: string, factory: DriverFactory): void {
    this.factories.set(name, factory)
  }

  /** Retorna o nome do driver padrão */
  getDefaultDriver(): string {
    return this.defaultDriverName
  }

  /** Altera o driver padrão */
  setDefaultDriver(name: string): void {
    this.defaultDriverName = name
  }
}

/** Instância global do cache manager */
export const cacheManager = new CacheManager()
