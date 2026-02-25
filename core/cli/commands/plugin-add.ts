/**
 * FluxStack CLI - Plugin Add Command
 * Safely install and whitelist NPM plugins
 */

import { Command } from 'commander'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { $ } from 'bun'
import chalk from 'chalk'

interface PluginAddOptions {
  skipAudit?: boolean
  skipConfirmation?: boolean
}

export function createPluginAddCommand(): Command {
  const command = new Command('plugin:add')
    .description('Install and whitelist an NPM plugin securely')
    .argument('<plugin-name>', 'Name of the plugin to install (e.g., fluxstack-plugin-auth)')
    .option('--skip-audit', 'Skip npm audit check')
    .option('--skip-confirmation', 'Skip confirmation prompt')
    .action(async (pluginName: string, options: PluginAddOptions) => {
      console.log(chalk.blue('\n🔌 FluxStack Plugin Installer\n'))

      try {
        // 1. Validate plugin name
        if (!isValidPluginName(pluginName)) {
          console.error(chalk.red(`❌ Invalid plugin name: ${pluginName}`))
          console.log(chalk.yellow('\n📝 Valid plugin names:'))
          console.log('  - fluxstack-plugin-*')
          console.log('  - fplugin-*')
          console.log('  - @fluxstack/plugin-*')
          console.log('  - @fplugin/*')
          console.log('  - @org/fluxstack-plugin-*')
          console.log('  - @org/fplugin-*')
          process.exit(1)
        }

        // 2. Check if plugin already installed
        const packageJsonPath = join(process.cwd(), 'package.json')
        if (!existsSync(packageJsonPath)) {
          console.error(chalk.red('❌ package.json not found'))
          process.exit(1)
        }

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        const isAlreadyInstalled =
          packageJson.dependencies?.[pluginName] ||
          packageJson.devDependencies?.[pluginName]

        if (isAlreadyInstalled && !options.skipConfirmation) {
          console.log(chalk.yellow(`⚠️  Plugin ${pluginName} is already installed`))
          console.log(chalk.yellow('   Will only update whitelist\n'))
        }

        // 3. Audit plugin (unless skipped)
        if (!options.skipAudit && !isAlreadyInstalled) {
          console.log(chalk.blue('🔍 Auditing plugin security...\n'))

          try {
            // Get plugin info
            const info = await $`npm view ${pluginName} repository homepage version description`.text()
            console.log(chalk.gray(info))

            // Run audit
            console.log(chalk.blue('\n🛡️  Running npm audit...\n'))
            const auditResult = await $`npm audit ${pluginName}`.text()
            console.log(chalk.gray(auditResult))
          } catch (error) {
            console.warn(chalk.yellow(`⚠️  Could not audit plugin: ${error instanceof Error ? error.message : 'Unknown error'}`))
          }
        }

        // 4. Confirmation prompt (unless skipped)
        if (!options.skipConfirmation) {
          console.log(chalk.yellow('\n⚠️  Security Warning:'))
          console.log(chalk.yellow('   NPM plugins can execute arbitrary code'))
          console.log(chalk.yellow('   Only install plugins from trusted sources\n'))

          const answer = prompt(chalk.blue('Continue with installation? (yes/no): '))
          if (answer?.toLowerCase() !== 'yes' && answer?.toLowerCase() !== 'y') {
            console.log(chalk.red('❌ Installation cancelled'))
            process.exit(0)
          }
        }

        // 5. Install plugin
        if (!isAlreadyInstalled) {
          console.log(chalk.blue(`\n📦 Installing ${pluginName}...\n`))
          await $`bun add ${pluginName}`.quiet()
          console.log(chalk.green(`✅ Plugin installed successfully`))
        }

        // 6. Update .env file
        console.log(chalk.blue('\n🔧 Updating configuration...\n'))
        updateEnvFile(pluginName)

        // 7. Success message
        console.log(chalk.green('\n✅ Plugin setup complete!\n'))
        console.log(chalk.blue('📋 What was done:'))
        if (!isAlreadyInstalled) {
          console.log(chalk.gray(`   • Installed ${pluginName}`))
        }
        console.log(chalk.gray('   • Enabled NPM plugin discovery (PLUGINS_DISCOVER_NPM=true)'))
        console.log(chalk.gray(`   • Added ${pluginName} to whitelist (PLUGINS_ALLOWED)`))

        console.log(chalk.blue('\n🚀 Next steps:'))
        console.log(chalk.gray('   1. Restart your dev server: bun run dev'))
        console.log(chalk.gray('   2. Plugin will be auto-discovered and loaded'))
        console.log(chalk.gray('   3. Check logs for plugin initialization'))

      } catch (error) {
        console.error(chalk.red('\n❌ Failed to install plugin:'))
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  return command
}

/**
 * Validate plugin name against FluxStack naming conventions
 */
function isValidPluginName(name: string): boolean {
  const patterns = [
    /^fluxstack-plugin-/,
    /^fplugin-/,
    /^@fluxstack\/plugin-/,
    /^@fplugin\//,
    /^@[\w-]+\/fluxstack-plugin-/,
    /^@[\w-]+\/fplugin-/,
  ]

  return patterns.some(pattern => pattern.test(name))
}

/**
 * Update .env file with plugin configuration
 */
function updateEnvFile(pluginName: string): void {
  const envPath = join(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    console.warn(chalk.yellow('⚠️  .env file not found, creating...'))
    writeFileSync(envPath, '', 'utf-8')
  }

  let envContent = readFileSync(envPath, 'utf-8')
  let updated = false

  // 1. Enable NPM plugin discovery
  if (/^PLUGINS_DISCOVER_NPM=false/m.test(envContent)) {
    envContent = envContent.replace(
      /^PLUGINS_DISCOVER_NPM=false/m,
      'PLUGINS_DISCOVER_NPM=true'
    )
    updated = true
    console.log(chalk.gray('   • Set PLUGINS_DISCOVER_NPM=true'))
  } else if (!/^PLUGINS_DISCOVER_NPM=/m.test(envContent)) {
    envContent += '\n# Plugin Discovery\nPLUGINS_DISCOVER_NPM=true\n'
    updated = true
    console.log(chalk.gray('   • Added PLUGINS_DISCOVER_NPM=true'))
  }

  // 2. Add plugin to whitelist
  const allowedPluginsRegex = /^PLUGINS_ALLOWED=(.*)$/m
  const match = envContent.match(allowedPluginsRegex)

  if (match) {
    const currentPlugins = match[1]
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)

    if (!currentPlugins.includes(pluginName)) {
      const newPlugins = [...currentPlugins, pluginName].join(',')
      envContent = envContent.replace(
        allowedPluginsRegex,
        `PLUGINS_ALLOWED=${newPlugins}`
      )
      updated = true
      console.log(chalk.gray(`   • Added ${pluginName} to PLUGINS_ALLOWED`))
    } else {
      console.log(chalk.gray(`   • ${pluginName} already in PLUGINS_ALLOWED`))
    }
  } else {
    envContent += `PLUGINS_ALLOWED=${pluginName}\n`
    updated = true
    console.log(chalk.gray(`   • Created PLUGINS_ALLOWED with ${pluginName}`))
  }

  if (updated) {
    writeFileSync(envPath, envContent, 'utf-8')
  }
}
