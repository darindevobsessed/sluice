import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleInsightRequest } from '@/lib/agent/insight-handler'

const streamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  token: z.string().min(1, 'Token is required'),
})

/**
 * POST /api/agent/stream
 *
 * Accepts insight generation requests and returns an SSE stream.
 * - Validates auth token against AGENT_AUTH_TOKEN env var
 * - Streams response from Claude Agent SDK via SSE
 * - Returns events: text, done, error, cancelled
 *
 * Request body: { id: string, prompt: string, systemPrompt: string, token: string }
 * Response: text/event-stream with SSE events
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

    const validationResult = streamSchema.safeParse(body)
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request body' },
        { status: 400 }
      )
    }

    const { id, prompt, systemPrompt, token } = validationResult.data

    // Validate auth token
    if (token !== authToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        // Send function to enqueue SSE events
        const send = (event: object) => {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        try {
          // Call insight handler with send callback
          await handleInsightRequest(send, {
            id,
            type: 'generate',
            prompt,
            systemPrompt,
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          send({ event: 'error', error: errorMessage })
        } finally {
          controller.close()
        }
      },
    })

    // Return streaming response with appropriate headers
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in agent stream:', error)
    return NextResponse.json(
      { error: 'Failed to process request. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * Configure route segment for Vercel
 * maxDuration allows longer-running operations (requires Pro plan)
 */
export const maxDuration = 60
