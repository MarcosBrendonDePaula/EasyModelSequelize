/**
 * Service Container
 * Core FluxStack dependency injection container
 * 
 * Provides service registration, resolution, and lifecycle management
 */

import type { Logger } from '@core/utils/logger/index'

export interface ServiceDefinition {
  factory: (container: ServiceContainer) => any
  singleton?: boolean
  dependencies?: string[]
}

export class ServiceContainer {
  private services = new Map<string, any>()
  private definitions = new Map<string, ServiceDefinition>()
  private singletons = new Map<string, any>()
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'ServiceContainer' })
  }

  /**
   * Register a service definition
   */
  register<T>(name: string, definition: ServiceDefinition | T): void {
    if (typeof definition === 'object' && definition !== null && 'factory' in definition) {
      this.definitions.set(name, definition as ServiceDefinition)
      this.logger.debug(`Registered service definition: ${name}`)
    } else {
      this.services.set(name, definition)
      this.logger.debug(`Registered service instance: ${name}`)
    }
  }

  /**
   * Get a service instance
   */
  get<T>(name: string): T {
    // Check for direct service instance
    if (this.services.has(name)) {
      return this.services.get(name) as T
    }

    // Check for singleton instance
    if (this.singletons.has(name)) {
      return this.singletons.get(name) as T
    }

    // Check for service definition
    const definition = this.definitions.get(name)
    if (!definition) {
      throw new Error(`Service not found: ${name}`)
    }

    // Resolve dependencies first
    if (definition.dependencies) {
      for (const dep of definition.dependencies) {
        if (!this.has(dep)) {
          throw new Error(`Dependency not found: ${dep} (required by ${name})`)
        }
      }
    }

    // Create service instance
    const instance = definition.factory(this)

    // Store singleton if needed
    if (definition.singleton) {
      this.singletons.set(name, instance)
    }

    this.logger.debug(`Created service instance: ${name}`)
    return instance as T
  }

  /**
   * Check if service exists
   */
  has(name: string): boolean {
    return this.services.has(name) || 
           this.definitions.has(name) || 
           this.singletons.has(name)
  }

  /**
   * Remove a service
   */
  remove(name: string): void {
    this.services.delete(name)
    this.definitions.delete(name)
    this.singletons.delete(name)
    this.logger.debug(`Removed service: ${name}`)
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    const names = new Set<string>()
    
    // Use Array.from to avoid iterator issues
    Array.from(this.services.keys()).forEach(name => names.add(name))
    Array.from(this.definitions.keys()).forEach(name => names.add(name))
    Array.from(this.singletons.keys()).forEach(name => names.add(name))
    
    return Array.from(names)
  }

  /**
   * Register multiple services at once
   */
  registerMany(services: Array<{
    name: string
    constructor: any
    dependencies?: string[]
    singleton?: boolean
  }>): void {
    for (const service of services) {
      this.register(service.name, {
        factory: (container) => new service.constructor({
          config: {},
          logger: this.logger,
          services: container
        }),
        dependencies: service.dependencies,
        singleton: service.singleton
      })
    }
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear()
    this.definitions.clear()
    this.singletons.clear()
    this.logger.debug('Cleared all services')
  }
}