import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, personas } from '@/lib/db'
import { inArray } from 'drizzle-orm'
import { findBestPersonas, streamEnsembleResponse } from '@/lib/personas/ensemble'

const EnsembleQuerySchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  personaIds: z.array(z.number()).optional(),
})

/**
 * POST /api/personas/ensemble
 *
 * Query multiple personas in parallel with streaming responses.
 *
 * Request body:
 * - question: string (required) - User's question
 * - personaIds: number[] (optional) - Specific persona IDs to query
 *
 * If personaIds is omitted, queries all personas and uses "who's best" routing
 * to select top 3 by expertise similarity.
 *
 * Returns:
 * - 200: SSE stream with persona-tagged events
 * - 400: Invalid request body
 * - 404: No personas found
 * - 500: Server error
 */
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const parseResult = EnsembleQuerySchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }

    const { question, personaIds } = parseResult.data

    // Fetch personas
    let personasToQuery

    if (personaIds && personaIds.length > 0) {
      // Fetch specific personas
      personasToQuery = await db
        .select()
        .from(personas)
        .where(inArray(personas.id, personaIds))
        .limit(10) // Safety limit
    } else {
      // Fetch all personas (up to some reasonable limit)
      personasToQuery = await db.select().from(personas).limit(10)
    }

    if (personasToQuery.length === 0) {
      return NextResponse.json(
        { error: 'No personas found' },
        { status: 404 }
      )
    }

    // Find best matching personas (top 3)
    const bestMatches = await findBestPersonas(question, personasToQuery, 3)

    if (bestMatches.length === 0) {
      return NextResponse.json(
        { error: 'No personas found with expertise embeddings' },
        { status: 404 }
      )
    }

    // Extract just the personas (sorted by best match)
    const topPersonas = bestMatches.map(m => m.persona)

    // Create abort controller for cleanup
    const abortController = new AbortController()

    // Stream ensemble response
    const stream = await streamEnsembleResponse({
      question,
      personas: topPersonas,
      signal: abortController.signal,
    })

    // Return SSE stream
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Ensemble query error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
