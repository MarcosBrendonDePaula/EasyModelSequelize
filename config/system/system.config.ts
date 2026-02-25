/**
 * System Runtime Configuration
 * System information and environment variables
 */

import { defineConfig, config } from '@core/utils/config-schema'

/**
 * System environment variables config
 */
export const systemConfig = defineConfig({
  // User/System info
  user: config.string('USER', ''),
  username: config.string('USERNAME', ''),
  home: config.string('HOME', ''),
  userProfile: config.string('USERPROFILE', ''),

  // Paths
  pwd: config.string('PWD', ''),
  path: config.string('PATH', ''),

  // Shell
  shell: config.string('SHELL', ''),
  term: config.string('TERM', ''),

  // Common environment variables
  lang: config.string('LANG', 'en_US.UTF-8'),
  tmpDir: config.string('TMPDIR', ''),

  // CI/CD detection
  ci: config.boolean('CI', false),

  // Computed helpers (not from env)
  get currentUser() {
    return this.user || this.username || 'unknown'
  },

  get homeDirectory() {
    return this.home || this.userProfile || ''
  },

  get isCI() {
    return this.ci
  }
})

/**
 * System runtime info (from Node.js/Bun process)
 * These are not from environment variables, but from runtime
 */
export const systemRuntimeInfo = {
  get nodeVersion() {
    return process.version
  },

  get bunVersion() {
    return (process.versions as any).bun || 'N/A'
  },

  get platform() {
    return process.platform
  },

  get architecture() {
    return process.arch
  },

  get cpuCount() {
    return require('os').cpus().length
  },

  get totalMemory() {
    const os = require('os')
    return Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100 // GB
  },

  get workingDirectory() {
    return process.cwd()
  },

  get executablePath() {
    return process.execPath
  },

  get uptime() {
    return process.uptime()
  },

  get memoryUsage() {
    const usage = process.memoryUsage()
    return {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100
    }
  }
}

// Export types
export type SystemConfig = typeof systemConfig
export type SystemRuntimeInfo = typeof systemRuntimeInfo

// Export default
export default systemConfig
