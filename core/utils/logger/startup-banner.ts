/**
 * FluxStack Logger - Startup Banner
 * Clean and beautiful startup display
 *
 * Developers can customize the banner by:
 * 1. Setting showBanner: false in server config
 * 2. Using displayStartupBanner() in app.listen() callback
 * 3. Creating completely custom banners with chalk
 */

import chalk from 'chalk'
import { LOG } from './index'
import { FLUXSTACK_VERSION } from '../version'

export interface StartupInfo {
  port: number
  host?: string
  apiPrefix?: string
  environment: string
  pluginCount?: number
  vitePort?: number
  viteEmbedded?: boolean // true when Vite runs programmatically with backend
  swaggerPath?: string
  liveComponents?: string[]
}

/**
 * Display clean startup banner
 */
export function displayStartupBanner(info: StartupInfo): void {
  const {
    port,
    host = 'localhost',
    apiPrefix = '/api',
    environment,
    pluginCount = 0,
    vitePort,
    viteEmbedded = false,
    liveComponents = [],
  } = info

  // Build server URL
  const displayHost = host === '0.0.0.0' ? 'localhost' : host
  const serverUrl = `http://${displayHost}:${port}`

  // Simple ready message with URL
  console.log(chalk.green('\nServer ready!') + chalk.gray(` Environment: ${environment}${viteEmbedded ? ' | Vite: embedded' : ''}`))
  console.log(chalk.cyan(`  → ${serverUrl}`))

  // Display Live Components
  if (liveComponents.length > 0) {
    console.log(chalk.gray(`  Live Components (${liveComponents.length}): `) + chalk.yellow(liveComponents.join(', ')))
  }

  // Display plugins in compact format
  const plugins = (global as any).__fluxstackPlugins || []
  if (plugins.length > 0) {
    const pluginList = plugins.map((p: any) => p.name).join(', ')
    console.log(chalk.gray(`  Plugins (${plugins.length}): `) + chalk.magenta(pluginList))
  }

  console.log('') // Empty line at the end
}

/**
 * Display simple plugin loaded message
 */
export function logPluginLoaded(name: string, version?: string): void {
  const versionStr = version ? chalk.gray(`v${version}`) : ''
  LOG(`${chalk.green('✓')} Plugin loaded: ${chalk.cyan(name)} ${versionStr}`)
}

/**
 * Display plugin count summary
 */
export function logPluginsSummary(count: number): void {
  if (count === 0) {
    LOG(chalk.yellow('⚠  No plugins loaded'))
  } else {
    LOG(chalk.green(`✓ ${count} plugin${count > 1 ? 's' : ''} loaded successfully`))
  }
}
