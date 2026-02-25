/**
 * Plugin Executor
 * Handles plugin execution with priority and dependency resolution
 */

import type { 
  FluxStack, 
  PluginHook, 
  PluginHookResult,
  PluginPriority,
  HookExecutionOptions
} from "./types"
import type { Logger } from "@core/utils/logger/index"
import { FluxStackError } from "@core/utils/errors"

export interface PluginExecutionPlan {
  hook: PluginHook
  plugins: PluginExecutionStep[]
  parallel: boolean
  totalPlugins: number
}

export interface PluginExecutionStep {
  plugin: Plugin
  priority: number
  dependencies: string[]
  dependents: string[]
  canExecuteInParallel: boolean
}

type Plugin = FluxStack.Plugin

export class PluginExecutor {
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  /**
   * Create execution plan for a hook
   */
  createExecutionPlan(
    plugins: Plugin[],
    hook: PluginHook,
    options: HookExecutionOptions = {}
  ): PluginExecutionPlan {
    const { parallel = false } = options

    // Filter plugins that implement this hook
    const applicablePlugins = plugins.filter(plugin => {
      const hookFunction = plugin[hook]
      return hookFunction && typeof hookFunction === 'function'
    })

    // Create execution steps
    const steps = applicablePlugins.map(plugin => this.createExecutionStep(plugin, plugins))

    // Sort by priority and dependencies
    const sortedSteps = this.sortExecutionSteps(steps, hook)

    return {
      hook,
      plugins: sortedSteps,
      parallel,
      totalPlugins: applicablePlugins.length
    }
  }

  /**
   * Execute plugins according to plan
   */
  async executePlan(
    plan: PluginExecutionPlan,
    context: any,
    executor: (plugin: Plugin, hook: PluginHook, context: any) => Promise<PluginHookResult>
  ): Promise<PluginHookResult[]> {
    const results: PluginHookResult[] = []

    this.logger.debug(`Executing plan for hook '${plan.hook}'`, {
      hook: plan.hook,
      totalPlugins: plan.totalPlugins,
      parallel: plan.parallel
    })

    if (plan.parallel) {
      // Execute in parallel groups based on dependencies
      const groups = this.createParallelGroups(plan.plugins)
      
      for (const group of groups) {
        const groupPromises = group.map(step => 
          executor(step.plugin, plan.hook, context)
        )
        
        const groupResults = await Promise.allSettled(groupPromises)
        
        for (let i = 0; i < groupResults.length; i++) {
          const result = groupResults[i]
          if (result.status === 'fulfilled') {
            results.push(result.value)
          } else {
            results.push({
              success: false,
              error: result.reason,
              duration: 0,
              plugin: group[i].plugin.name,
              hook: plan.hook
            })
          }
        }
      }
    } else {
      // Execute sequentially
      for (const step of plan.plugins) {
        const result = await executor(step.plugin, plan.hook, context)
        results.push(result)
      }
    }

    return results
  }

  /**
   * Validate execution plan
   */
  validateExecutionPlan(plan: PluginExecutionPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for circular dependencies
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const checkCircular = (step: PluginExecutionStep) => {
      if (visiting.has(step.plugin.name)) {
        errors.push(`Circular dependency detected involving plugin '${step.plugin.name}'`)
        return
      }

      if (visited.has(step.plugin.name)) {
        return
      }

      visiting.add(step.plugin.name)

      for (const depName of step.dependencies) {
        const depStep = plan.plugins.find(s => s.plugin.name === depName)
        if (depStep) {
          checkCircular(depStep)
        }
      }

      visiting.delete(step.plugin.name)
      visited.add(step.plugin.name)
    }

    for (const step of plan.plugins) {
      checkCircular(step)
    }

    // Check for missing dependencies
    for (const step of plan.plugins) {
      for (const depName of step.dependencies) {
        const depExists = plan.plugins.some(s => s.plugin.name === depName)
        if (!depExists) {
          errors.push(`Plugin '${step.plugin.name}' depends on '${depName}' which is not available`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Create execution step for a plugin
   */
  private createExecutionStep(plugin: Plugin, allPlugins: Plugin[]): PluginExecutionStep {
    const priority = this.normalizePriority(plugin.priority)
    const dependencies = plugin.dependencies || []
    
    // Find dependents
    const dependents = allPlugins
      .filter(p => p.dependencies?.includes(plugin.name))
      .map(p => p.name)

    // Determine if can execute in parallel
    const canExecuteInParallel = dependencies.length === 0

    return {
      plugin,
      priority,
      dependencies,
      dependents,
      canExecuteInParallel
    }
  }

  /**
   * Sort execution steps by priority and dependencies
   */
  private sortExecutionSteps(steps: PluginExecutionStep[], hook: PluginHook): PluginExecutionStep[] {
    // Topological sort with priority consideration
    const sorted: PluginExecutionStep[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (step: PluginExecutionStep) => {
      if (visiting.has(step.plugin.name)) {
        throw new FluxStackError(
          `Circular dependency detected involving plugin '${step.plugin.name}' for hook '${hook}'`,
          'CIRCULAR_DEPENDENCY',
          400
        )
      }

      if (visited.has(step.plugin.name)) {
        return
      }

      visiting.add(step.plugin.name)

      // Visit dependencies first
      for (const depName of step.dependencies) {
        const depStep = steps.find(s => s.plugin.name === depName)
        if (depStep) {
          visit(depStep)
        }
      }

      visiting.delete(step.plugin.name)
      visited.add(step.plugin.name)
      sorted.push(step)
    }

    // Sort by priority first, then visit
    const prioritySorted = [...steps].sort((a, b) => b.priority - a.priority)
    
    for (const step of prioritySorted) {
      visit(step)
    }

    return sorted
  }

  /**
   * Create parallel execution groups
   */
  private createParallelGroups(steps: PluginExecutionStep[]): PluginExecutionStep[][] {
    const groups: PluginExecutionStep[][] = []
    const processed = new Set<string>()

    while (processed.size < steps.length) {
      const currentGroup: PluginExecutionStep[] = []

      for (const step of steps) {
        if (processed.has(step.plugin.name)) {
          continue
        }

        // Check if all dependencies are already processed
        const canExecute = step.dependencies.every(dep => processed.has(dep))
        
        if (canExecute) {
          currentGroup.push(step)
          processed.add(step.plugin.name)
        }
      }

      if (currentGroup.length === 0) {
        // This shouldn't happen if dependencies are valid
        const remaining = steps.filter(s => !processed.has(s.plugin.name))
        throw new FluxStackError(
          `Unable to resolve dependencies for plugins: ${remaining.map(s => s.plugin.name).join(', ')}`,
          'DEPENDENCY_RESOLUTION_ERROR',
          400
        )
      }

      // Sort group by priority
      currentGroup.sort((a, b) => b.priority - a.priority)
      groups.push(currentGroup)
    }

    return groups
  }

  /**
   * Normalize plugin priority to numeric value
   */
  private normalizePriority(priority?: number | PluginPriority): number {
    if (typeof priority === 'number') {
      return priority
    }

    switch (priority) {
      case 'highest': return 1000
      case 'high': return 750
      case 'normal': return 500
      case 'low': return 250
      case 'lowest': return 0
      default: return 500 // default to normal
    }
  }
}

/**
 * Plugin execution statistics
 */
export interface PluginExecutionStats {
  totalPlugins: number
  successfulPlugins: number
  failedPlugins: number
  totalDuration: number
  averageDuration: number
  slowestPlugin: { name: string; duration: number } | null
  fastestPlugin: { name: string; duration: number } | null
}

/**
 * Calculate execution statistics
 */
export function calculateExecutionStats(results: PluginHookResult[]): PluginExecutionStats {
  const totalPlugins = results.length
  const successfulPlugins = results.filter(r => r.success).length
  const failedPlugins = totalPlugins - successfulPlugins
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
  const averageDuration = totalPlugins > 0 ? totalDuration / totalPlugins : 0

  let slowestPlugin: { name: string; duration: number } | null = null
  let fastestPlugin: { name: string; duration: number } | null = null

  for (const result of results) {
    if (!slowestPlugin || result.duration > slowestPlugin.duration) {
      slowestPlugin = { name: result.plugin, duration: result.duration }
    }
    
    if (!fastestPlugin || result.duration < fastestPlugin.duration) {
      fastestPlugin = { name: result.plugin, duration: result.duration }
    }
  }

  return {
    totalPlugins,
    successfulPlugins,
    failedPlugins,
    totalDuration,
    averageDuration,
    slowestPlugin,
    fastestPlugin
  }
}