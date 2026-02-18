/**
 * Environment variable validation module.
 * Side-effect: importing this module runs validation.
 * Throws error if required env vars are missing.
 * Warns if optional env vars are missing.
 */

// Required environment variables
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Optional environment variables - warn if missing
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('Warning: ANTHROPIC_API_KEY not set. AI features will not work.')
}

if (!process.env.CRON_SECRET) {
  console.warn('Warning: CRON_SECRET not set. Cron endpoints will not be secured.')
}

if (!process.env.BETTER_AUTH_SECRET) {
  console.warn('Warning: BETTER_AUTH_SECRET not set. Auth will use an insecure default in development.')
}

// Note: NEXT_PUBLIC_AGENT_PORT and MCP_AUTH_TOKEN are not validated
// These are optional and have sensible defaults or fallbacks

export {}
