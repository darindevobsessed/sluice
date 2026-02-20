import { db, discoveryVideos, videos } from '@/lib/db'
import { NextResponse } from 'next/server'
import { desc, inArray } from 'drizzle-orm'
import { startApiTimer } from '@/lib/api-timing'

interface DiscoveryVideoResponse {
  youtubeId: string
  title: string
  channelId: string
  channelName: string
  publishedAt: string | null
  description: string
  inBank: boolean
}

export async function GET(_request: Request): Promise<NextResponse> {
  const timer = startApiTimer('/api/channels/videos', 'GET')
  try {
    // Read cached videos from DB — no live RSS fetch on page load
    const cached = await db
      .select()
      .from(discoveryVideos)
      .orderBy(desc(discoveryVideos.publishedAt))

    if (cached.length === 0) {
      timer.end(200)
      return NextResponse.json([])
    }

    // Check which videos are already in the knowledge bank
    // Select only youtubeId to avoid fetching large transcript columns
    const youtubeIds = cached.map((v) => v.youtubeId)
    const inBankRows = await db
      .select({ youtubeId: videos.youtubeId })
      .from(videos)
      .where(inArray(videos.youtubeId, youtubeIds))

    const inBankSet = new Set(inBankRows.map((v) => v.youtubeId))

    const response: DiscoveryVideoResponse[] = cached.map((video) => ({
      youtubeId: video.youtubeId,
      title: video.title,
      channelId: video.channelId,
      channelName: video.channelName,
      publishedAt: video.publishedAt ? video.publishedAt.toISOString() : null,
      description: video.description,
      inBank: inBankSet.has(video.youtubeId),
    }))

    timer.end(200)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch videos:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    )
  }
}
