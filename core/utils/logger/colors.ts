/**
 * FluxStack Logger - Color Management
 * Generates unique colors for each module
 */

import chalk, { type ChalkInstance } from 'chalk'

// Cache for module colors  
const moduleColors = new Map<string, ChalkInstance>()

/**
 * Pre-defined colors for common modules
 */
const COMMON_MODULE_COLORS: Record<string, string> = {
  api: '#4CAF50',      // Green
  db: '#2196F3',       // Blue
  auth: '#FF9800',     // Orange
  user: '#9C27B0',     // Purple
  config: '#00BCD4',   // Cyan
  utils: '#607D8B',    // Blue Gray
  routes: '#E91E63',   // Pink
  controllers: '#3F51B5', // Indigo
  models: '#009688',   // Teal
  services: '#FF5722', // Deep Orange
  plugins: '#673AB7',  // Deep Purple
  middleware: '#795548', // Brown
  live: '#00E676',     // Green Accent
  websocket: '#00B0FF', // Light Blue Accent
  build: '#FFC107',    // Amber
  cli: '#CDDC39'       // Lime
}

/**
 * Symbols for different log levels
 */
export const LOG_SYMBOLS = {
  error: chalk.red('✖'),
  warn: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
  debug: chalk.magenta('⬤'),
  default: chalk.gray('•')
} as const

/**
 * Colors for different log levels
 */
export const LEVEL_COLORS = {
  error: chalk.bold.red,
  warn: chalk.bold.yellow,
  info: chalk.bold.blue,
  debug: chalk.bold.magenta,
  default: chalk.bold.gray
} as const

/**
 * Generate a unique color for a module based on its name
 */
export function getColorForModule(moduleName: string): ChalkInstance {
  // Check cache first
  if (moduleColors.has(moduleName)) {
    return moduleColors.get(moduleName)!
  }

  // Check if module name contains a common module keyword
  for (const [key, hexColor] of Object.entries(COMMON_MODULE_COLORS)) {
    if (moduleName.toLowerCase().includes(key)) {
      const color = chalk.hex(hexColor)
      moduleColors.set(moduleName, color)
      return color
    }
  }

  // Generate color from module name hash
  let hash = 0
  for (let i = 0; i < moduleName.length; i++) {
    hash = moduleName.charCodeAt(i) + ((hash << 5) - hash)
  }

  // Generate pleasant color using HSL
  const h = Math.abs(hash) % 360
  const s = 65 + (Math.abs(hash) % 20) // Saturation 65-85%
  const l = 45 + (Math.abs(hash) % 15) // Lightness 45-60%

  const hexColor = hslToHex(h, s, l)
  const color = chalk.hex(hexColor)

  moduleColors.set(moduleName, color)
  return color
}

/**
 * Convert HSL to Hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100

  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))

  const r = Math.round(255 * f(0))
  const g = Math.round(255 * f(8))
  const b = Math.round(255 * f(4))

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Clear color cache (useful for testing)
 */
export function clearColorCache(): void {
  moduleColors.clear()
}
