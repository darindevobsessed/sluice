/**
 * API route to retrieve the agent token.
 * Returns the token from .agent-token file (websocket) or AGENT_AUTH_TOKEN env var (SSE).
 */
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const TOKEN_FILE = '.agent-token'

export async function GET() {
  const tokenPath = path.join(process.cwd(), TOKEN_FILE)

  // Try filesystem first (local dev with WebSocket)
  try {
    if (fs.existsSync(tokenPath)) {
      const token = fs.readFileSync(tokenPath, 'utf-8').trim()

      if (token) {
        return NextResponse.json({
          token,
          available: true,
          transport: 'websocket',
        })
      }
    }
  } catch {
    // Filesystem errors fall through to env var fallback
    // This handles Vercel read-only filesystem gracefully
  }

  // Fall back to env var (production with SSE)
  const envToken = process.env.AGENT_AUTH_TOKEN

  if (envToken) {
    return NextResponse.json({
      token: envToken,
      available: true,
      transport: 'sse',
    })
  }

  // Neither available
  return NextResponse.json(
    {
      error: 'Agent not available',
      available: false,
    },
    { status: 503 }
  )
}
