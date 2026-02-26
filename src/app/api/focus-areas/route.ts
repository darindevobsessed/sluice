import { db, focusAreas } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { startApiTimer } from '@/lib/api-timing'
import { requireSession } from '@/lib/auth-guards'

const createFocusAreaSchema = z.object({
  name: z.string().min(1, 'Name is required').transform((val) => val.trim()),
  color: z.string().optional(),
})

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const timer = startApiTimer('/api/focus-areas', 'GET')
  try {
    const allFocusAreas = await db.select().from(focusAreas)

    timer.end(200)
    return NextResponse.json({ focusAreas: allFocusAreas }, { status: 200 })
  } catch (error) {
    console.error('Error fetching focus areas:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to fetch focus areas. Please try again.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const denied = await requireSession()
  if (denied) return denied
  const timer = startApiTimer('/api/focus-areas', 'POST')
  try {
    const body = await request.json()

    const validationResult = createFocusAreaSchema.safeParse(body)

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      timer.end(400)
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      )
    }

    const { name, color } = validationResult.data

    // Check for duplicate name
    const existingFocusArea = await db
      .select()
      .from(focusAreas)
      .where(eq(focusAreas.name, name))
      .limit(1)

    if (existingFocusArea.length > 0) {
      timer.end(409)
      return NextResponse.json(
        { error: 'A focus area with this name already exists' },
        { status: 409 }
      )
    }

    const [focusArea] = await db
      .insert(focusAreas)
      .values({
        name,
        color: color || null,
      })
      .returning()

    timer.end(201)
    return NextResponse.json({ focusArea }, { status: 201 })
  } catch (error) {
    console.error('Error creating focus area:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to create focus area. Please try again.' },
      { status: 500 }
    )
  }
}
