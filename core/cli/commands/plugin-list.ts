/**
 * FluxStack CLI - Plugin List Command
 * List all plugins (installed, whitelisted, discovered)
 */

import { Command } from 'commander'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'

export function createPluginListCommand(): Command {
  const command = new Command('plugin:list')
    .description('List all plugins (installed, whitelisted, and discovered)')
    .option('--installed', 'Show only installed NPM plugins')
    .option('--whitelisted', 'Show only whitelisted plugins')
    .option('--json', 'Output as JSON')
    .action(async (options: { installed?: boolean; whitelisted?: boolean; json?: boolean }) => {
      try {
        const info = getPluginInfo()

        if (options.json) {
          console.log(JSON.stringify(info, null, 2))
          return
        }

        console.log(chalk.blue('\n🔌 FluxStack Plugin Status\n'))

        // Configuration
        console.log(chalk.bold('⚙️  Configuration:'))
        console.log(chalk.gray(`   NPM Plugin Discovery: ${info.config.npmDiscoveryEnabled ? chalk.green('enabled') : chalk.red('disabled')}`))
        console.log(chalk.gray(`   Project Plugin Discovery: ${info.config.projectDiscoveryEnabled ? chalk.green('enabled') : chalk.red('disabled')}`))
        console.log()

        // Whitelisted plugins
        if (!options.installed) {
          console.log(chalk.bold('🛡️  Whitelisted NPM Plugins:'))
          if (info.whitelisted.length === 0) {
            console.log(chalk.gray('   (none)'))
          } else {
            info.whitelisted.forEach(plugin => {
              const isInstalled = info.installed.includes(plugin)
              const status = isInstalled ? chalk.green('✓ installed') : chalk.yellow('⚠ not installed')
              console.log(chalk.gray(`   • ${plugin} ${status}`))
            })
          }
          console.log()
        }

        // Installed NPM plugins
        if (!options.whitelisted) {
          console.log(chalk.bold('📦 Installed NPM Plugins:'))
          if (info.installed.length === 0) {
            console.log(chalk.gray('   (none)'))
          } else {
            info.installed.forEach(plugin => {
              const isWhitelisted = info.whitelisted.includes(plugin)
              let status = ''
              if (!info.config.npmDiscoveryEnabled) {
                status = chalk.red('✗ discovery disabled')
              } else if (!isWhitelisted) {
                status = chalk.red('✗ not whitelisted (blocked)')
              } else {
                status = chalk.green('✓ whitelisted (loaded)')
              }
              console.log(chalk.gray(`   • ${plugin} ${status}`))
            })
          }
          console.log()
        }

        // Project plugins (from plugins/ directory)
        console.log(chalk.bold('📁 Project Plugins (plugins/):'))
        if (info.projectPlugins.length === 0) {
          console.log(chalk.gray('   (none found)'))
        } else {
          info.projectPlugins.forEach(plugin => {
            const status = info.config.projectDiscoveryEnabled
              ? chalk.green('✓ auto-discovered')
              : chalk.red('✗ discovery disabled')
            console.log(chalk.gray(`   • ${plugin} ${status}`))
          })
        }
        console.log()

        // Summary
        console.log(chalk.bold('📊 Summary:'))
        console.log(chalk.gray(`   Total NPM plugins installed: ${info.installed.length}`))
        console.log(chalk.gray(`   Total NPM plugins whitelisted: ${info.whitelisted.length}`))
        console.log(chalk.gray(`   Total project plugins: ${info.projectPlugins.length}`))

        const blockedCount = info.installed.filter(p => !info.whitelisted.includes(p)).length
        if (blockedCount > 0) {
          console.log(chalk.yellow(`   ⚠️  ${blockedCount} installed plugin(s) blocked (not whitelisted)`))
        }
        console.log()

        // Help
        if (info.installed.length > 0 && !info.config.npmDiscoveryEnabled) {
          console.log(chalk.yellow('💡 Tip: Enable NPM plugin discovery with:'))
          console.log(chalk.gray('   echo "PLUGINS_DISCOVER_NPM=true" >> .env'))
          console.log()
        }

        if (blockedCount > 0 && info.config.npmDiscoveryEnabled) {
          console.log(chalk.yellow('💡 Tip: Add blocked plugins to whitelist with:'))
          console.log(chalk.gray('   bun run fluxstack plugin:add <plugin-name>'))
          console.log()
        }

      } catch (error) {
        console.error(chalk.red('\n❌ Failed to list plugins:'))
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return command
}

interface PluginInfo {
  config: {
    npmDiscoveryEnabled: boolean
    projectDiscoveryEnabled: boolean
  }
  whitelisted: string[]
  installed: string[]
  projectPlugins: string[]
}

/**
 * Get plugin information from package.json and .env
 */
function getPluginInfo(): PluginInfo {
  const info: PluginInfo = {
    config: {
      npmDiscoveryEnabled: false,
      projectDiscoveryEnabled: true,
    },
    whitelisted: [],
    installed: [],
    projectPlugins: [],
  }

  // Read .env for configuration
  const envPath = join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8')

    // Check NPM discovery enabled
    const npmDiscoveryMatch = envContent.match(/^PLUGINS_DISCOVER_NPM=(.*)$/m)
    if (npmDiscoveryMatch) {
      info.config.npmDiscoveryEnabled = npmDiscoveryMatch[1].toLowerCase() === 'true'
    }

    // Check project discovery enabled
    const projectDiscoveryMatch = envContent.match(/^PLUGINS_DISCOVER_PROJECT=(.*)$/m)
    if (projectDiscoveryMatch) {
      info.config.projectDiscoveryEnabled = projectDiscoveryMatch[1].toLowerCase() === 'true'
    }

    // Get whitelisted plugins
    const whitelistMatch = envContent.match(/^PLUGINS_ALLOWED=(.*)$/m)
    if (whitelistMatch) {
      info.whitelisted = whitelistMatch[1]
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)
    }
  }

  // Read package.json for installed plugins
  const packageJsonPath = join(process.cwd(), 'package.json')
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    // Find FluxStack plugins
    const pluginPatterns = [
      /^fluxstack-plugin-/,
      /^fplugin-/,
      /^@fluxstack\/plugin-/,
      /^@fplugin\//,
    ]

    info.installed = Object.keys(allDeps).filter(name =>
      pluginPatterns.some(pattern => pattern.test(name))
    )
  }

  // Scan plugins/ directory for project plugins
  const pluginsDir = join(process.cwd(), 'plugins')
  if (existsSync(pluginsDir)) {
    const fs = require('fs')
    try {
      const entries = fs.readdirSync(pluginsDir, { withFileTypes: true })
      info.projectPlugins = entries
        .filter((entry: any) => entry.isDirectory())
        .map((entry: any) => entry.name)
    } catch (error) {
      // Ignore errors reading directory
    }
  }

  return info
}
