import { db, channels } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseChannelUrl } from '@/lib/youtube/channel-parser'
import { fetchChannelFeed, getFeedUrl } from '@/lib/automation/rss'
import { startApiTimer } from '@/lib/api-timing'

const followChannelSchema = z.object({
  url: z.string().min(1, 'URL is required'),
})

export async function GET() {
  const timer = startApiTimer('/api/channels', 'GET')
  try {
    const allChannels = await db.select().from(channels)
    timer.end(200)
    return NextResponse.json(allChannels)
  } catch (error) {
    console.error('Error fetching channels:', error)
    timer.end(500)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const timer = startApiTimer('/api/channels', 'POST')
  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = followChannelSchema.safeParse(body)

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      timer.end(400)
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      )
    }

    const { url } = validationResult.data

    // Parse channel URL to get channel ID
    let channelId: string
    try {
      channelId = await parseChannelUrl(url)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid URL'
      timer.end(400)
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Fetch RSS feed to validate channel and get name
    let feedResult
    try {
      feedResult = await fetchChannelFeed(channelId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      timer.end(400)
      return NextResponse.json(
        { error: `Failed to validate channel: ${message}` },
        { status: 400 }
      )
    }

    // Insert channel into database
    try {
      const feedUrl = getFeedUrl(channelId)
      const inserted = await db
        .insert(channels)
        .values({
          channelId,
          name: feedResult.channelName,
          feedUrl,
        })
        .returning()

      timer.end(201)
      return NextResponse.json({ channel: inserted[0] }, { status: 201 })
    } catch (error) {
      // Check for unique constraint violation
      if (
        error instanceof Error &&
        error.message.includes('duplicate key value violates unique constraint')
      ) {
        timer.end(409)
        return NextResponse.json({ error: 'Channel already followed' }, { status: 409 })
      }

      console.error('Error following channel:', error)
      timer.end(500)
      return NextResponse.json({ error: 'Failed to follow channel' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error processing request:', error)
    timer.end(500)
    return NextResponse.json({ error: 'Failed to follow channel' }, { status: 500 })
  }
}
