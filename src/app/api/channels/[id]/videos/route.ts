import { db, channels, videos } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchChannelFeed } from '@/lib/automation/rss'
import { startApiTimer } from '@/lib/api-timing'

const channelIdSchema = z.string().regex(/^[1-9]\d*$/, 'Channel ID must be a positive integer')

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = startApiTimer('/api/channels/[id]/videos', 'GET')
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

    // Look up the channel
    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)

    const channelData = channel[0]

    if (!channelData) {
      timer.end(404)
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Fetch channel feed from RSS
    let feedResult
    try {
      feedResult = await fetchChannelFeed(channelData.channelId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      timer.end(400)
      return NextResponse.json(
        { error: `Failed to fetch channel videos: ${message}` },
        { status: 400 }
      )
    }

    // Get all videos in the knowledge bank (to mark which are already added)
    const allVideosInBank = await db.select({ youtubeId: videos.youtubeId }).from(videos)

    const inBankSet = new Set(allVideosInBank.map((v) => v.youtubeId))

    // Add inBank flag to each video
    const videosWithInBank = feedResult.videos.map((video) => ({
      ...video,
      inBank: inBankSet.has(video.youtubeId),
    }))

    timer.end(200)
    return NextResponse.json(videosWithInBank)
  } catch (error) {
    console.error('Error fetching channel videos:', error)
    timer.end(500)
    return NextResponse.json({ error: 'Failed to fetch channel videos' }, { status: 500 })
  }
}
