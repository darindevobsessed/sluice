import { db, channels, videos } from '@/lib/db'
import { NextResponse } from 'next/server'
import { fetchChannelFeed } from '@/lib/automation/rss'
import { inArray } from 'drizzle-orm'
import type { RSSVideo } from '@/lib/automation/types'

interface DiscoveryVideo {
  youtubeId: string
  title: string
  channelId: string
  channelName: string
  publishedAt: string
  description: string
  inBank: boolean
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    // Validate since parameter if provided
    let sinceDate: Date | null = null
    if (since) {
      sinceDate = new Date(since)
      if (isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid since timestamp' },
          { status: 400 }
        )
      }
    }

    // Fetch all followed channels
    const followedChannels = await db.select().from(channels)

    if (followedChannels.length === 0) {
      return NextResponse.json([])
    }

    // Fetch RSS feeds for all channels using Promise.allSettled
    const feedPromises = followedChannels.map((channel) =>
      fetchChannelFeed(channel.channelId)
    )

    const feedResults = await Promise.allSettled(feedPromises)

    // Extract videos from successful feeds
    let allVideos: RSSVideo[] = []
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        allVideos = allVideos.concat(result.value.videos)
      }
      // Silently skip failed feeds (graceful degradation)
    }

    // Filter by since timestamp if provided
    if (sinceDate) {
      allVideos = allVideos.filter((video) => video.publishedAt > sinceDate)
    }

    // Sort chronologically (newest first)
    allVideos.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())

    // Check which videos are in the bank
    const youtubeIds = allVideos.map((v) => v.youtubeId)
    const videosInBank = youtubeIds.length > 0
      ? await db
          .select()
          .from(videos)
          .where(inArray(videos.youtubeId, youtubeIds))
      : []

    const inBankSet = new Set(videosInBank.map((v) => v.youtubeId))

    // Map to response format
    const response: DiscoveryVideo[] = allVideos.map((video) => ({
      youtubeId: video.youtubeId,
      title: video.title,
      channelId: video.channelId,
      channelName: video.channelName,
      publishedAt: video.publishedAt.toISOString(),
      description: video.description,
      inBank: inBankSet.has(video.youtubeId),
    }))

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch videos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    )
  }
}
