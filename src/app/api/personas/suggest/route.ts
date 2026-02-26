import { db, videos, personas } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

import { PERSONA_THRESHOLD } from '@/lib/personas/service'
import { startApiTimer } from '@/lib/api-timing'
import { requireSession } from '@/lib/auth-guards'

export async function GET() {
  const denied = await requireSession()
  if (denied) return denied
  const timer = startApiTimer('/api/personas/suggest', 'GET')
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

    // Filter channels with 5+ videos and no existing persona
    // Exclude null channels (transcript-only videos)
    const suggestions = channelCounts
      .filter((c) => c.channel !== null && c.videoCount >= PERSONA_THRESHOLD && !existingChannelNames.has(c.channel))
      .map((c) => ({
        channelName: c.channel!,
        videoCount: c.videoCount,
      }))
      .sort((a, b) => b.videoCount - a.videoCount) // Sort by video count descending

    timer.end(200)
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error fetching persona suggestions:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to fetch persona suggestions' },
      { status: 500 }
    )
  }
}
