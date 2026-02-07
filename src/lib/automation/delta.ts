import { db as defaultDb } from '@/lib/db'
import { videos } from '@/lib/db/schema'
import type { RSSVideo } from './types'

/**
 * Find videos from RSS feed that are not yet in the database
 */
export async function findNewVideos(
  rssVideos: RSSVideo[],
  dbInstance = defaultDb
): Promise<RSSVideo[]> {
  if (rssVideos.length === 0) return []

  // Get existing youtubeIds from database
  const existing = await dbInstance.select({ youtubeId: videos.youtubeId })
    .from(videos)

  const existingIds = new Set(existing.map(v => v.youtubeId))

  // Return videos not in database
  return rssVideos.filter(v => !existingIds.has(v.youtubeId))
}

/**
 * Create a video record from RSS data
 */
export async function createVideoFromRSS(
  rssVideo: RSSVideo,
  dbInstance = defaultDb
): Promise<number> {
  const result = await dbInstance.insert(videos).values({
    youtubeId: rssVideo.youtubeId,
    title: rssVideo.title,
    channel: rssVideo.channelName,
    publishedAt: rssVideo.publishedAt,
  }).returning()

  const video = result[0]
  if (!video) throw new Error('Failed to create video from RSS')
  return video.id
}
