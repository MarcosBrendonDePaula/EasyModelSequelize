/**
 * FluxStack Logger - Grouped/Collapsible Logs
 * Creates beautiful grouped console output
 */

import chalk from 'chalk'

export interface GroupOptions {
  title: string
  icon?: string
  collapsed?: boolean
  color?: 'cyan' | 'green' | 'yellow' | 'blue' | 'magenta' | 'gray'
}

/**
 * Start a log group (collapsible in browsers, indented in terminal)
 */
export function startGroup(options: GroupOptions): void {
  const { title, icon = '📦', collapsed = false, color = 'cyan' } = options

  // Check if we're in a browser-like environment (has console.group)
  if (typeof console.groupCollapsed === 'function' && typeof console.group === 'function') {
    const coloredTitle = chalk[color].bold(`${icon} ${title}`)

    if (collapsed) {
      console.groupCollapsed(coloredTitle)
    } else {
      console.group(coloredTitle)
    }
  } else {
    // Terminal fallback - use box drawing
    const coloredTitle = chalk[color].bold(`${icon} ${title}`)
    console.log('\n' + coloredTitle)
    console.log(chalk.gray('─'.repeat(Math.min(title.length + 4, 60))))
  }
}

/**
 * End a log group
 */
export function endGroup(): void {
  if (typeof console.groupEnd === 'function') {
    console.groupEnd()
  } else {
    // Terminal fallback - just add spacing
    console.log('')
  }
}

/**
 * Log within a group
 */
export function logInGroup(message: string, icon?: string): void {
  const prefix = icon ? `${icon} ` : '  '
  console.log(chalk.gray(prefix) + message)
}

/**
 * Helper: Auto-group function that handles start/end automatically
 */
export async function withGroup<T>(
  options: GroupOptions,
  callback: () => T | Promise<T>
): Promise<T> {
  startGroup(options)
  try {
    const result = await callback()
    return result
  } finally {
    endGroup()
  }
}

/**
 * Helper: Create a summary line for groups
 */
export function groupSummary(count: number, itemName: string, icon: string = '✓'): void {
  // itemName should already include proper pluralization
  const message = `${icon} ${count} ${itemName}`
  console.log(chalk.green.bold(message))
}

/**
 * Create a boxed section for important info
 */
export function logBox(title: string, content: string[], options: { color?: 'cyan' | 'green' | 'yellow' } = {}): void {
  const { color = 'cyan' } = options
  const maxWidth = Math.max(title.length, ...content.map(c => c.length)) + 4

  console.log('')
  console.log(chalk[color]('┌' + '─'.repeat(maxWidth) + '┐'))
  console.log(chalk[color]('│ ') + chalk.bold(title.padEnd(maxWidth - 2)) + chalk[color](' │'))
  console.log(chalk[color]('├' + '─'.repeat(maxWidth) + '┤'))

  for (const line of content) {
    console.log(chalk[color]('│ ') + line.padEnd(maxWidth - 2) + chalk[color](' │'))
  }

  console.log(chalk[color]('└' + '─'.repeat(maxWidth) + '┘'))
  console.log('')
}
