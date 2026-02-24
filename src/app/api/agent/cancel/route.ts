import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cancelInsight } from '@/lib/agent/insight-handler'
import { safeCompare } from '@/lib/auth-guards'

const cancelSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  token: z.string().min(1, 'Token is required'),
})

/**
 * POST /api/agent/cancel
 *
 * Cancels an in-progress insight generation.
 * - Validates auth token against AGENT_AUTH_TOKEN env var
 * - Calls cancelInsight to abort the request
 * - Returns whether the cancellation was successful
 *
 * Request body: { id: string, token: string }
 * Response: { cancelled: boolean }
 */
export async function POST(request: Request) {
  try {
    // Check if auth token is configured
    const authToken = process.env.AGENT_AUTH_TOKEN
    if (!authToken) {
      return NextResponse.json(
        { error: 'Agent authentication not configured' },
        { status: 503 }
      )
    }

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const validationResult = cancelSchema.safeParse(body)
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request body' },
        { status: 400 }
      )
    }

    const { id, token } = validationResult.data

    // Validate auth token (timing-safe comparison)
    if (!safeCompare(token, authToken)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Cancel the insight generation
    const cancelled = cancelInsight(id)

    return NextResponse.json({ cancelled })
  } catch (error) {
    console.error('Error in agent cancel:', error)
    return NextResponse.json(
      { error: 'Failed to cancel request. Please try again.' },
      { status: 500 }
    )
  }
}
