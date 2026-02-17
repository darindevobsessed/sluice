import { db, personas } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createPersona } from '@/lib/personas/service'

const createPersonaSchema = z.object({
  channelName: z.string().min(1, 'Channel name is required'),
})

export async function GET() {
  try {
    const allPersonas = await db.select().from(personas)
    return NextResponse.json(allPersonas)
  } catch (error) {
    console.error('Error fetching personas:', error)
    return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = createPersonaSchema.safeParse(body)

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      )
    }

    const { channelName } = validationResult.data

    // Create persona
    const persona = await createPersona(channelName)

    return NextResponse.json({ persona }, { status: 201 })
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      // Duplicate channel constraint violation
      if (error.message.includes('duplicate key value violates unique constraint')) {
        return NextResponse.json(
          { error: 'Persona already exists for this channel' },
          { status: 409 }
        )
      }

      // No videos found for channel
      if (error.message.includes('No videos found for channel')) {
        return NextResponse.json(
          { error: 'No videos found for channel' },
          { status: 404 }
        )
      }
    }

    // JSON parse error
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    console.error('Error creating persona:', error)
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 })
  }
}

/**
 * Configure route segment for Vercel
 * maxDuration allows longer-running operations (requires Pro plan)
 */
export const maxDuration = 60
