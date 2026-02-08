import { db, videos, personas } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

export async function GET() {
  try {
    // Get existing persona channel names
    const existingPersonas = await db.select({ channelName: personas.channelName }).from(personas)
    const existingChannelNames = new Set(existingPersonas.map((p) => p.channelName))

    // Get video counts by channel
    const channelCounts = await db
      .select({
        channel: videos.channel,
        videoCount: sql<number>`count(*)::int`,
      })
      .from(videos)
      .groupBy(videos.channel)

    // Filter channels with 30+ videos and no existing persona
    const suggestions = channelCounts
      .filter((c) => c.videoCount >= 30 && !existingChannelNames.has(c.channel))
      .map((c) => ({
        channelName: c.channel,
        videoCount: c.videoCount,
      }))
      .sort((a, b) => b.videoCount - a.videoCount) // Sort by video count descending

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error fetching persona suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch persona suggestions' },
      { status: 500 }
    )
  }
}
