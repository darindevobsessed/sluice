/**
 * Dev warm-up script.
 * Hits critical routes in parallel after the dev server starts,
 * pre-compiling them so the first browser visit is fast.
 *
 * Usage: npm run dev:warmup
 * Automatically run as part of npm run dev.
 */

const PORT = process.env.PORT || '3001'
const BASE = `http://localhost:${PORT}`

const ROUTES = [
  '/',                       // Main page (triggers layout + page compilation)
  '/api/sidebar',            // SidebarDataProvider calls on mount
  '/api/videos',             // KnowledgeBankContent calls on mount
  '/api/agent/token',        // AgentProvider calls on mount
  '/api/auth/get-session',   // useSession() calls on mount
]

const MAX_RETRIES = 30
const RETRY_INTERVAL_MS = 1000

async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(`${BASE}/api/agent/token`, {
        signal: AbortSignal.timeout(2000),
      })
      // Any response (even 503) means the server is up and compiling
      if (response) return true
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS))
  }
  return false
}

async function warmRoute(route: string): Promise<{ route: string, ms: number, ok: boolean }> {
  const start = performance.now()
  try {
    const response = await fetch(`${BASE}${route}`, {
      signal: AbortSignal.timeout(30000),
      headers: { 'Accept': 'text/html,application/json' },
    })
    const ms = Math.round(performance.now() - start)
    return { route, ms, ok: response.ok || response.status < 500 }
  } catch (error) {
    const ms = Math.round(performance.now() - start)
    return { route, ms, ok: false }
  }
}

async function main() {
  console.log(`\n⏳ Warming up dev server at ${BASE}...`)
  console.log(`   Waiting for server to be ready...\n`)

  const ready = await waitForServer()
  if (!ready) {
    console.error('❌ Server did not start within 30 seconds')
    process.exit(1)
  }

  console.log('   Server is ready. Pre-compiling routes...\n')

  const start = performance.now()
  const results = await Promise.all(ROUTES.map(warmRoute))
  const totalMs = Math.round(performance.now() - start)

  // Print results
  for (const { route, ms, ok } of results) {
    const status = ok ? '✓' : '✗'
    const color = ok ? '\x1b[32m' : '\x1b[31m'
    console.log(`   ${color}${status}\x1b[0m ${route} — ${ms}ms`)
  }

  const allOk = results.every(r => r.ok)
  const failCount = results.filter(r => !r.ok).length

  console.log(`\n   Total: ${totalMs}ms (${results.length} routes${failCount > 0 ? `, ${failCount} failed` : ''})`)

  if (allOk) {
    console.log('   ✅ All routes pre-compiled. Dev server is ready.\n')
  } else {
    console.log('   ⚠️  Some routes failed (non-blocking — they will compile on first visit).\n')
  }
}

main()
