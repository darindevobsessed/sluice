/**
 * Lightweight API route timing utility.
 * Logs structured timing data to console, visible in Vercel's log stream.
 * No external dependencies — uses built-in performance.now().
 */

interface ApiTimingResult {
  route: string
  method: string
  status: number
  durationMs: number
  metadata?: Record<string, string | number | boolean>
}

/**
 * Log API route timing to structured console output.
 * Format: [api] METHOD /route 200 in 45ms { extra: "data" }
 *
 * @param result - The timing result to log
 */
function logApiTiming(result: ApiTimingResult): void {
  const { route, method, status, durationMs, metadata } = result
  const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : ''
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

  const message = `[api] ${method} ${route} ${status} in ${durationMs}ms${metaStr}`

  if (level === 'error') {
    console.error(message)
  } else if (level === 'warn') {
    console.warn(message)
  } else {
    console.info(message)
  }
}

/**
 * Create a timer for an API route. Call `end()` when the route completes.
 *
 * Usage:
 *   const timer = startApiTimer('/api/search', 'GET')
 *   // ... do work ...
 *   timer.end(200, { resultCount: 5 })
 *
 * @param route - The API route path (e.g., '/api/search')
 * @param method - The HTTP method (e.g., 'GET', 'POST')
 * @returns Object with `end(status, metadata?)` method
 */
function startApiTimer(route: string, method: string) {
  const start = performance.now()

  return {
    end(status: number, metadata?: Record<string, string | number | boolean>): number {
      const durationMs = Math.round(performance.now() - start)
      logApiTiming({ route, method, status, durationMs, metadata })
      return durationMs
    },
  }
}

export { logApiTiming, startApiTimer }
export type { ApiTimingResult }
