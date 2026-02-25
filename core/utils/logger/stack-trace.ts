/**
 * FluxStack Logger - Stack Trace Analysis
 * Extracts caller information from stack traces
 */

import { relative } from 'path'

export interface CallerInfo {
  file: string
  line: number
  function: string
}

// Cache for caller information
const callerCache = new Map<string, CallerInfo>()
const MAX_CACHE_SIZE = 1000

/**
 * Get information about the caller (file, line, function)
 */
export function getCallerInfo(): CallerInfo {
  const originalFunc = Error.prepareStackTrace
  let callerInfo: CallerInfo = { file: 'unknown', line: 0, function: 'unknown' }

  try {
    const err = new Error()
    let stack: NodeJS.CallSite[] = []

    Error.prepareStackTrace = (_: Error, stackTraces: NodeJS.CallSite[]) => stackTraces
    stack = err.stack as unknown as NodeJS.CallSite[]

    // Find the first frame that is not from the logger
    for (let i = 2; i < stack.length; i++) {
      const callSite = stack[i]
      const fileName = callSite.getFileName()

      if (
        fileName &&
        !fileName.includes('logger') &&
        !fileName.includes('node_modules') &&
        !fileName.includes('bun:') &&
        !fileName.includes('<anonymous>')
      ) {
        const relativeFile = relative(process.cwd(), fileName)
        const lineNumber = callSite.getLineNumber() || 0
        const cacheKey = `${relativeFile}:${lineNumber}`

        // Check cache
        if (callerCache.has(cacheKey)) {
          return callerCache.get(cacheKey)!
        }

        callerInfo = {
          file: relativeFile,
          line: lineNumber,
          function: callSite.getFunctionName() || 'anonymous'
        }

        // Cache the result
        if (callerCache.size >= MAX_CACHE_SIZE) {
          // Remove oldest entry
          const firstKey = callerCache.keys().next().value
          if (firstKey !== undefined) {
            callerCache.delete(firstKey)
          }
        }

        callerCache.set(cacheKey, callerInfo)
        break
      }
    }
  } catch (error) {
    // Silently fail - return default caller info
  }

  Error.prepareStackTrace = originalFunc
  return callerInfo
}

/**
 * Clear caller cache (useful for testing)
 */
export function clearCallerCache(): void {
  callerCache.clear()
}

/**
 * Format caller info for display
 */
export function formatCallerInfo(info: CallerInfo, colorFn: (str: string) => string): string {
  const fileInfo = colorFn(`[${info.file}:${info.line}]`)
  const functionInfo = info.function !== 'unknown' ? colorFn(`[${info.function}]`) : ''
  return functionInfo ? `${fileInfo} ${functionInfo}` : fileInfo
}
