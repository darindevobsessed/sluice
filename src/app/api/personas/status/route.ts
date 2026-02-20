import { db, videos, personas } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { PERSONA_THRESHOLD } from '@/lib/personas/service'
import { startApiTimer } from '@/lib/api-timing'

export async function GET() {
  const timer = startApiTimer('/api/personas/status', 'GET')
  try {
    // Get all channels with transcript counts and their persona status
    // Join videos grouped by channel with personas
    const channelsWithStatus = await db
      .select({
        channelName: videos.channel,
        transcriptCount: sql<number>`count(${videos.id})::int`,
        personaId: personas.id,
        personaCreatedAt: personas.createdAt,
      })
      .from(videos)
      .leftJoin(personas, sql`${videos.channel} = ${personas.channelName}`)
      .where(sql`${videos.channel} IS NOT NULL`)
      .groupBy(videos.channel, personas.id, personas.createdAt)

    // Sort: active personas first, then by transcript count descending
    const sortedChannels = channelsWithStatus.sort((a, b) => {
      // Active personas first
      if (a.personaId !== null && b.personaId === null) return -1
      if (a.personaId === null && b.personaId !== null) return 1

      // Then by transcript count descending
      return b.transcriptCount - a.transcriptCount
    })

    timer.end(200)
    return NextResponse.json({
      channels: sortedChannels,
      threshold: PERSONA_THRESHOLD,
    })
  } catch (error) {
    console.error('Error fetching persona status:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to fetch persona status' },
      { status: 500 }
    )
  }
}
