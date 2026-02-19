import { db, videos, focusAreas } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

/**
 * GET /api/sidebar
 *
 * Returns sidebar data in a single request:
 * - channels: distinct creators from the videos table with video counts, sorted by count descending
 * - focusAreas: all focus areas with id, name, color, createdAt
 *
 * Channels come from the videos table (not the channels table) because we want
 * "creators in the knowledge bank" — any video with a non-null channel field.
 */
export async function GET() {
  try {
    // Get distinct channels with video counts, sorted by count descending
    const channelResults = await db
      .select({
        channel: videos.channel,
        videoCount: sql<number>`count(*)`,
      })
      .from(videos)
      .groupBy(videos.channel)
      .orderBy(sql`count(*) desc`)

    const channels = channelResults
      .filter(r => r.channel !== null)
      .map(r => ({
        name: r.channel!,
        videoCount: Number(r.videoCount),
      }))

    // Get all focus areas
    const allFocusAreas = await db.select().from(focusAreas)

    return NextResponse.json({ channels, focusAreas: allFocusAreas })
  } catch (error) {
    console.error('Error fetching sidebar data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sidebar data' },
      { status: 500 }
    )
  }
}
