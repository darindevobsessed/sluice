import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, channels, videos } from '@/lib/db'
import { eq } from 'drizzle-orm'

const followChannelSchema = z.object({
  channelName: z.string().min(1, 'Channel name is required'),
})

/**
 * Follow a channel by name (lightweight endpoint for similar channel recommendations)
 * Creates a channel entry based on existing videos in the knowledge bank
 */
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = followChannelSchema.safeParse(body)

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      )
    }

    const { channelName } = validationResult.data

    // Find a video from this channel to verify it exists in our bank
    const existingVideos = await db
      .select({
        id: videos.id,
        youtubeId: videos.youtubeId,
        channel: videos.channel,
      })
      .from(videos)
      .where(eq(videos.channel, channelName))
      .limit(1)

    if (existingVideos.length === 0) {
      return NextResponse.json(
        { error: `No videos found for channel "${channelName}"` },
        { status: 404 }
      )
    }

    // Generate a channel ID from the channel name
    // Format: "channel-{lowercase-with-hyphens}"
    const channelId = `channel-${channelName.toLowerCase().replace(/\s+/g, '-')}`

    // Insert channel into database
    try {
      const inserted = await db
        .insert(channels)
        .values({
          channelId,
          name: channelName,
        })
        .returning()

      return NextResponse.json({ channel: inserted[0] }, { status: 201 })
    } catch (error) {
      // Check for unique constraint violation
      if (
        error instanceof Error &&
        error.message.includes('duplicate key value violates unique constraint')
      ) {
        return NextResponse.json({ error: 'Channel already followed' }, { status: 409 })
      }

      console.error('Error following channel:', error)
      return NextResponse.json({ error: 'Failed to follow channel' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json({ error: 'Failed to follow channel' }, { status: 500 })
  }
}
