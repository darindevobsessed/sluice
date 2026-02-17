import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, personas } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getPersonaContext } from '@/lib/personas/context'
import { streamPersonaResponse } from '@/lib/personas/streaming'

const querySchema = z.object({
  question: z.string().min(1, 'Question is required'),
})

/**
 * POST /api/personas/[id]/query
 *
 * Queries a persona with streaming response.
 * - Validates persona ID and request body
 * - Fetches relevant context from the creator's content
 * - Streams response from Claude API with persona's voice
 *
 * Request body: { question: string }
 * Response: text/event-stream with SSE events
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Validate ID
    const personaId = parseInt(id, 10)
    if (isNaN(personaId)) {
      return NextResponse.json({ error: 'Invalid persona ID' }, { status: 400 })
    }

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const validationResult = querySchema.safeParse(body)
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request body' },
        { status: 400 }
      )
    }

    const { question } = validationResult.data

    // Fetch persona from database
    const [persona] = await db
      .select()
      .from(personas)
      .where(eq(personas.id, personaId))
      .limit(1)

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Get relevant context from the creator's content
    const context = await getPersonaContext(persona.channelName, question)

    // Stream response from Claude API
    const stream = await streamPersonaResponse({
      persona,
      question,
      context,
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
    console.error('Error in persona query:', error)
    return NextResponse.json(
      { error: 'Failed to process query. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * Configure route segment for Vercel
 * maxDuration allows longer-running operations (requires Pro plan)
 */
export const maxDuration = 60
