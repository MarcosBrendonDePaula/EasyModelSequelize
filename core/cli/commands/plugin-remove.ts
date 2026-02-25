/**
 * FluxStack CLI - Plugin Remove Command
 * Safely remove and un-whitelist NPM plugins
 */

import { Command } from 'commander'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { $ } from 'bun'
import chalk from 'chalk'

interface PluginRemoveOptions {
  skipConfirmation?: boolean
  keepInstalled?: boolean
}

export function createPluginRemoveCommand(): Command {
  const command = new Command('plugin:remove')
    .description('Remove plugin from whitelist and optionally uninstall')
    .argument('<plugin-name>', 'Name of the plugin to remove (e.g., fluxstack-plugin-auth)')
    .option('--skip-confirmation', 'Skip confirmation prompt')
    .option('--keep-installed', 'Keep plugin installed, only remove from whitelist')
    .action(async (pluginName: string, options: PluginRemoveOptions) => {
      console.log(chalk.blue('\n🔌 FluxStack Plugin Remover\n'))

      try {
        // 1. Check if plugin is installed
        const packageJsonPath = join(process.cwd(), 'package.json')
        if (!existsSync(packageJsonPath)) {
          console.error(chalk.red('❌ package.json not found'))
          process.exit(1)
        }

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        const isInstalled =
          packageJson.dependencies?.[pluginName] ||
          packageJson.devDependencies?.[pluginName]

        if (!isInstalled && !options.keepInstalled) {
          console.log(chalk.yellow(`⚠️  Plugin ${pluginName} is not installed`))
          console.log(chalk.yellow('   Will only remove from whitelist\n'))
        }

        // 2. Confirmation prompt (unless skipped)
        if (!options.skipConfirmation) {
          const action = options.keepInstalled
            ? 'remove from whitelist'
            : 'uninstall and remove from whitelist'

          const answer = prompt(chalk.yellow(`Remove ${pluginName}? This will ${action}. (yes/no): `))
          if (answer?.toLowerCase() !== 'yes' && answer?.toLowerCase() !== 'y') {
            console.log(chalk.red('❌ Removal cancelled'))
            process.exit(0)
          }
        }

        // 3. Remove from whitelist
        console.log(chalk.blue('\n🔧 Updating configuration...\n'))
        const removed = removeFromWhitelist(pluginName)

        if (!removed) {
          console.log(chalk.yellow(`⚠️  Plugin ${pluginName} was not in whitelist`))
        } else {
          console.log(chalk.gray(`   • Removed ${pluginName} from PLUGINS_ALLOWED`))
        }

        // 4. Uninstall plugin (unless --keep-installed)
        if (!options.keepInstalled && isInstalled) {
          console.log(chalk.blue(`\n📦 Uninstalling ${pluginName}...\n`))
          await $`bun remove ${pluginName}`.quiet()
          console.log(chalk.green(`✅ Plugin uninstalled successfully`))
        }

        // 5. Check if should disable NPM discovery
        checkAndDisableNpmDiscovery()

        // 6. Success message
        console.log(chalk.green('\n✅ Plugin removal complete!\n'))
        console.log(chalk.blue('📋 What was done:'))
        console.log(chalk.gray(`   • Removed ${pluginName} from whitelist (PLUGINS_ALLOWED)`))
        if (!options.keepInstalled && isInstalled) {
          console.log(chalk.gray(`   • Uninstalled ${pluginName}`))
        }

        console.log(chalk.blue('\n🚀 Next steps:'))
        console.log(chalk.gray('   1. Restart your dev server: bun run dev'))
        console.log(chalk.gray('   2. Plugin will no longer be loaded'))

      } catch (error) {
        console.error(chalk.red('\n❌ Failed to remove plugin:'))
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return command
}

/**
 * Remove plugin from whitelist in .env file
 */
function removeFromWhitelist(pluginName: string): boolean {
  const envPath = join(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    return false
  }

  let envContent = readFileSync(envPath, 'utf-8')
  const allowedPluginsRegex = /^PLUGINS_ALLOWED=(.*)$/m
  const match = envContent.match(allowedPluginsRegex)

  if (!match) {
    return false
  }

  const currentPlugins = match[1]
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0)

  if (!currentPlugins.includes(pluginName)) {
    return false
  }

  const newPlugins = currentPlugins.filter(p => p !== pluginName)
  envContent = envContent.replace(
    allowedPluginsRegex,
    `PLUGINS_ALLOWED=${newPlugins.join(',')}`
  )

  writeFileSync(envPath, envContent, 'utf-8')
  return true
}

/**
 * Check if whitelist is empty and disable NPM discovery if so
 */
function checkAndDisableNpmDiscovery(): void {
  const envPath = join(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    return
  }

  let envContent = readFileSync(envPath, 'utf-8')
  const allowedPluginsRegex = /^PLUGINS_ALLOWED=(.*)$/m
  const match = envContent.match(allowedPluginsRegex)

  if (!match) {
    return
  }

  const currentPlugins = match[1]
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0)

  // If whitelist is empty, disable NPM discovery
  if (currentPlugins.length === 0) {
    if (/^PLUGINS_DISCOVER_NPM=true/m.test(envContent)) {
      envContent = envContent.replace(
        /^PLUGINS_DISCOVER_NPM=true/m,
        'PLUGINS_DISCOVER_NPM=false'
      )
      writeFileSync(envPath, envContent, 'utf-8')
      console.log(chalk.gray('   • Disabled NPM plugin discovery (whitelist empty)'))
    }
  }
}
