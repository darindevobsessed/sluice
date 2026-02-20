import { db, channels } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { startApiTimer } from '@/lib/api-timing'

const channelIdSchema = z.string().regex(/^[1-9]\d*$/, 'Channel ID must be a positive integer')

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = startApiTimer('/api/channels/[id]', 'DELETE')
  try {
    const { id } = await params

    // Validate channel ID
    const idValidation = channelIdSchema.safeParse(id)
    if (!idValidation.success) {
      timer.end(400)
      return NextResponse.json(
        { error: idValidation.error.issues[0]?.message || 'Invalid channel ID' },
        { status: 400 }
      )
    }

    const channelId = parseInt(id, 10)

    // Delete the channel and return the deleted row
    const deleted = await db
      .delete(channels)
      .where(eq(channels.id, channelId))
      .returning()

    if (!deleted[0]) {
      timer.end(404)
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    timer.end(200)
    return NextResponse.json({
      success: true,
      channel: deleted[0],
    })
  } catch (error) {
    console.error('Error unfollowing channel:', error)
    timer.end(500)
    return NextResponse.json({ error: 'Failed to unfollow channel' }, { status: 500 })
  }
}
