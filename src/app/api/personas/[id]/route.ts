import { db, personas } from '@/lib/db'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { startApiTimer } from '@/lib/api-timing'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const timer = startApiTimer('/api/personas/[id]', 'DELETE')
  try {
    const { id } = await context.params

    // Validate ID is a number
    const personaId = parseInt(id, 10)
    if (isNaN(personaId)) {
      timer.end(400)
      return NextResponse.json({ error: 'Invalid persona ID' }, { status: 400 })
    }

    // Delete persona
    const deleted = await db
      .delete(personas)
      .where(eq(personas.id, personaId))
      .returning()

    if (deleted.length === 0) {
      timer.end(404)
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    timer.end(200)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting persona:', error)
    timer.end(500)
    return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 })
  }
}
