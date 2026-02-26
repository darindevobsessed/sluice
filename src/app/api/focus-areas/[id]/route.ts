import { db, focusAreas } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { startApiTimer } from '@/lib/api-timing'
import { requireSession } from '@/lib/auth-guards'

const updateFocusAreaSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .transform((val) => val.trim())
    .optional(),
  color: z.string().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireSession()
  if (denied) return denied
  const timer = startApiTimer('/api/focus-areas/[id]', 'PATCH')
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)

    if (isNaN(id)) {
      timer.end(400)
      return NextResponse.json({ error: 'Invalid focus area ID' }, { status: 400 })
    }

    const body = await request.json()

    const validationResult = updateFocusAreaSchema.safeParse(body)

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      timer.end(400)
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      )
    }

    const { name, color } = validationResult.data

    // Check if focus area exists
    const [existingFocusArea] = await db
      .select()
      .from(focusAreas)
      .where(eq(focusAreas.id, id))
      .limit(1)

    if (!existingFocusArea) {
      timer.end(404)
      return NextResponse.json({ error: 'Focus area not found' }, { status: 404 })
    }

    // If renaming, check for name conflicts
    if (name && name !== existingFocusArea.name) {
      const [conflictingFocusArea] = await db
        .select()
        .from(focusAreas)
        .where(eq(focusAreas.name, name))
        .limit(1)

      if (conflictingFocusArea) {
        timer.end(409)
        return NextResponse.json(
          { error: 'A focus area with this name already exists' },
          { status: 409 }
        )
      }
    }

    // Build update object
    const updates: { name?: string; color?: string } = {}
    if (name !== undefined) updates.name = name
    if (color !== undefined) updates.color = color

    const [updatedFocusArea] = await db
      .update(focusAreas)
      .set(updates)
      .where(eq(focusAreas.id, id))
      .returning()

    timer.end(200)
    return NextResponse.json({ focusArea: updatedFocusArea }, { status: 200 })
  } catch (error) {
    console.error('Error updating focus area:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to update focus area. Please try again.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireSession()
  if (denied) return denied
  const timer = startApiTimer('/api/focus-areas/[id]', 'DELETE')
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam, 10)

    if (isNaN(id)) {
      timer.end(400)
      return NextResponse.json({ error: 'Invalid focus area ID' }, { status: 400 })
    }

    // Check if focus area exists
    const [existingFocusArea] = await db
      .select()
      .from(focusAreas)
      .where(eq(focusAreas.id, id))
      .limit(1)

    if (!existingFocusArea) {
      timer.end(404)
      return NextResponse.json({ error: 'Focus area not found' }, { status: 404 })
    }

    // Delete (cascade will handle video_focus_areas)
    await db.delete(focusAreas).where(eq(focusAreas.id, id))

    timer.end(204)
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting focus area:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to delete focus area. Please try again.' },
      { status: 500 }
    )
  }
}
