/**
 * Environment variable validation module.
 * Side-effect: importing this module runs validation.
 * Throws error if required env vars are missing (skipped during build).
 * Warns if optional env vars are missing.
 */

// Skip validation during Next.js build phase (static page generation)
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'

// Required environment variables
if (!process.env.DATABASE_URL && !isBuildPhase) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Optional environment variables - warn if missing
if (!process.env.AI_GATEWAY_KEY) {
  console.warn('Warning: AI_GATEWAY_KEY not set. AI features will not work.')
} else {
  // Bridge for @anthropic-ai/claude-agent-sdk which reads ANTHROPIC_API_KEY
  // from process.env when spawning Claude subprocesses
  process.env.ANTHROPIC_API_KEY = process.env.AI_GATEWAY_KEY
}

if (!process.env.CRON_SECRET) {
  console.warn('Warning: CRON_SECRET not set. Cron endpoints will not be secured.')
}

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn('Warning: BETTER_AUTH_SECRET not set. Auth will use an insecure default in development.')
}

// Note: NEXT_PUBLIC_AGENT_PORT is not validated -- it has a sensible default

export {}
