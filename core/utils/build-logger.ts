/**
 * FluxStack Build Logger - Beautiful terminal output for build process
 * Provides formatted tables, boxes, and colored output
 */

// ANSI Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Text colors
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgCyan: '\x1b[46m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
}

// Box drawing characters
const box = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  verticalRight: '├',
  verticalLeft: '┤',
  horizontalDown: '┬',
  horizontalUp: '┴',
  cross: '┼',
}

export interface TableColumn {
  header: string
  key: string
  width?: number
  align?: 'left' | 'right' | 'center'
  color?: keyof typeof colors
}

export interface TableRow {
  [key: string]: string | number
}

export class BuildLogger {
  private indent = ''
  private startTime = Date.now()

  /**
   * Print a beautiful header banner
   */
  header(title: string) {
    const width = 60
    const padding = Math.floor((width - title.length - 2) / 2)
    const paddingRight = width - title.length - 2 - padding

    console.log()
    console.log(colors.cyan + colors.bright + box.topLeft + box.horizontal.repeat(width) + box.topRight + colors.reset)
    console.log(colors.cyan + box.vertical + ' '.repeat(padding) + colors.bright + colors.white + title + colors.cyan + ' '.repeat(paddingRight) + box.vertical + colors.reset)
    console.log(colors.cyan + box.bottomLeft + box.horizontal.repeat(width) + box.bottomRight + colors.reset)
    console.log()
  }

  /**
   * Print a section header
   */
  section(title: string, icon: string = '📦') {
    console.log()
    console.log(colors.bright + colors.blue + `${icon}  ${title}` + colors.reset)
    console.log(colors.dim + colors.gray + box.horizontal.repeat(50) + colors.reset)
  }

  /**
   * Print a success message
   */
  success(message: string) {
    console.log(colors.green + '✓ ' + colors.reset + message)
  }

  /**
   * Print an error message
   */
  error(message: string) {
    console.log(colors.red + '✗ ' + colors.reset + message)
  }

  /**
   * Print a warning message
   */
  warn(message: string) {
    console.log(colors.yellow + '⚠ ' + colors.reset + message)
  }

  /**
   * Print an info message
   */
  info(message: string, icon: string = '→') {
    console.log(colors.cyan + icon + ' ' + colors.reset + message)
  }

  /**
   * Print a step message
   */
  step(message: string, icon: string = '▸') {
    console.log(colors.dim + colors.gray + icon + ' ' + colors.reset + message)
  }

  /**
   * Print a table
   */
  table(columns: TableColumn[], rows: TableRow[]) {
    if (rows.length === 0) {
      this.warn('No data to display')
      return
    }

    // Calculate column widths
    const widths = columns.map(col => {
      if (col.width) return col.width
      const maxContentWidth = Math.max(
        col.header.length,
        ...rows.map(row => String(row[col.key] || '').length)
      )
      return Math.min(maxContentWidth, 40) // Max 40 chars per column
    })

    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + (columns.length - 1) * 3 + 4

    // Print top border
    console.log(
      colors.gray + box.topLeft +
      widths.map((w, i) =>
        box.horizontal.repeat(w + 2) + (i < widths.length - 1 ? box.horizontalDown : '')
      ).join('') +
      box.topRight + colors.reset
    )

    // Print header
    const headerRow = columns.map((col, i) => {
      const content = this.padContent(col.header, widths[i], 'center')
      return colors.bright + colors.white + content + colors.reset
    }).join(colors.gray + ' │ ' + colors.reset)

    console.log(colors.gray + box.vertical + ' ' + colors.reset + headerRow + colors.gray + ' ' + box.vertical + colors.reset)

    // Print header separator
    console.log(
      colors.gray + box.verticalRight +
      widths.map((w, i) =>
        box.horizontal.repeat(w + 2) + (i < widths.length - 1 ? box.cross : '')
      ).join('') +
      box.verticalLeft + colors.reset
    )

    // Print rows
    rows.forEach((row, rowIndex) => {
      const rowContent = columns.map((col, i) => {
        const value = String(row[col.key] || '')
        const content = this.padContent(value, widths[i], col.align || 'left')
        const color = col.color ? colors[col.color] : ''
        return color + content + colors.reset
      }).join(colors.gray + ' │ ' + colors.reset)

      console.log(colors.gray + box.vertical + ' ' + colors.reset + rowContent + colors.gray + ' ' + box.vertical + colors.reset)
    })

    // Print bottom border
    console.log(
      colors.gray + box.bottomLeft +
      widths.map((w, i) =>
        box.horizontal.repeat(w + 2) + (i < widths.length - 1 ? box.horizontalUp : '')
      ).join('') +
      box.bottomRight + colors.reset
    )
  }

  /**
   * Print a simple info box
   */
  box(title: string, items: Array<{ label: string; value: string | number; color?: keyof typeof colors }>) {
    const maxLabelWidth = Math.max(...items.map(i => i.label.length))
    const maxValueWidth = Math.max(...items.map(i => String(i.value).length))
    const contentWidth = maxLabelWidth + maxValueWidth + 3
    const boxWidth = Math.max(contentWidth, title.length) + 4

    // Top border with title
    console.log()
    console.log(colors.cyan + box.topLeft + box.horizontal.repeat(2) + colors.bright + colors.white + title + colors.cyan + box.horizontal.repeat(boxWidth - title.length - 2) + box.topRight + colors.reset)

    // Content
    items.forEach(item => {
      const label = item.label.padEnd(maxLabelWidth)
      const value = String(item.value)
      const valueColor = item.color ? colors[item.color] : colors.white
      console.log(
        colors.cyan + box.vertical + ' ' + colors.reset +
        colors.gray + label + colors.reset +
        colors.dim + ' : ' + colors.reset +
        valueColor + colors.bright + value + colors.reset +
        ' '.repeat(boxWidth - label.length - value.length - 3) +
        colors.cyan + box.vertical + colors.reset
      )
    })

    // Bottom border
    console.log(colors.cyan + box.bottomLeft + box.horizontal.repeat(boxWidth) + box.bottomRight + colors.reset)
    console.log()
  }

  /**
   * Print a progress indicator
   */
  progress(current: number, total: number, label: string) {
    const percentage = Math.round((current / total) * 100)
    const barLength = 30
    const filled = Math.round((percentage / 100) * barLength)
    const empty = barLength - filled

    const bar = colors.green + '█'.repeat(filled) + colors.gray + '░'.repeat(empty) + colors.reset
    console.log(`${label} [${bar}] ${percentage}% (${current}/${total})`)
  }

  /**
   * Start a timer
   */
  startTimer(label?: string) {
    this.startTime = Date.now()
    if (label) {
      this.info(label, '⏱')
    }
  }

  /**
   * End timer and print elapsed time
   */
  endTimer(label: string = 'Completed') {
    const elapsed = Date.now() - this.startTime
    const seconds = (elapsed / 1000).toFixed(2)
    this.success(`${label} in ${colors.bright}${seconds}s${colors.reset}`)
  }

  /**
   * Print a summary box
   */
  summary(title: string, stats: Array<{ label: string; value: string | number; highlight?: boolean }>) {
    console.log()
    console.log(colors.bright + colors.green + '╔═══════════════════════════════════════════════════════════╗' + colors.reset)
    console.log(colors.bright + colors.green + '║' + colors.reset + colors.bright + colors.white + ` ${title}`.padEnd(60) + colors.bright + colors.green + '║' + colors.reset)
    console.log(colors.bright + colors.green + '╠═══════════════════════════════════════════════════════════╣' + colors.reset)

    stats.forEach(stat => {
      const label = `  ${stat.label}:`
      const value = String(stat.value)
      const valueColor = stat.highlight ? colors.yellow + colors.bright : colors.white
      const padding = 60 - label.length - value.length - 1
      console.log(
        colors.bright + colors.green + '║' + colors.reset +
        colors.cyan + label + colors.reset +
        ' '.repeat(Math.max(padding, 1)) +
        valueColor + value + colors.reset +
        colors.bright + colors.green + ' ║' + colors.reset
      )
    })

    console.log(colors.bright + colors.green + '╚═══════════════════════════════════════════════════════════╝' + colors.reset)
    console.log()
  }

  /**
   * Pad content based on alignment
   */
  private padContent(content: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
    if (content.length >= width) {
      return content.slice(0, width)
    }

    const padding = width - content.length

    switch (align) {
      case 'right':
        return ' '.repeat(padding) + content
      case 'center':
        const leftPad = Math.floor(padding / 2)
        const rightPad = padding - leftPad
        return ' '.repeat(leftPad) + content + ' '.repeat(rightPad)
      default:
        return content + ' '.repeat(padding)
    }
  }

  /**
   * Format file size
   */
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Format duration
   */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }
}

// Export singleton instance
export const buildLogger = new BuildLogger()
