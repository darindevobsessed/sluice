import { db as defaultDb } from './index'
import { videos, type Video } from './schema'
import { desc, or, ilike, sql } from 'drizzle-orm'

/**
 * Columns for video list views — everything except transcript.
 * Transcript is 10-100KB per video and unused by list/card components.
 */
const videoListColumns = {
  id: videos.id,
  youtubeId: videos.youtubeId,
  sourceType: videos.sourceType,
  title: videos.title,
  channel: videos.channel,
  thumbnail: videos.thumbnail,
  duration: videos.duration,
  description: videos.description,
  createdAt: videos.createdAt,
  updatedAt: videos.updatedAt,
  publishedAt: videos.publishedAt,
}

/**
 * Type for video list views — all Video fields except transcript.
 * Components that display video cards/grids should use this type.
 */
export type VideoListItem = Omit<Video, 'transcript'>

/**
 * Search videos using simple ILIKE pattern matching.
 * Returns all columns EXCEPT transcript for payload size optimization.
 * @param query - Search query string
 * @param dbInstance - Optional database instance (for testing)
 */
export async function searchVideos(query: string, dbInstance = defaultDb): Promise<VideoListItem[]> {
  const trimmed = query.trim()

  if (!trimmed) {
    return dbInstance.select(videoListColumns).from(videos).orderBy(desc(videos.createdAt))
  }

  const pattern = `%${trimmed}%`

  return dbInstance.select(videoListColumns)
    .from(videos)
    .where(
      or(
        ilike(videos.title, pattern),
        ilike(videos.channel, pattern)
      )
    )
    .orderBy(desc(videos.createdAt))
}

/**
 * Get statistics about the video knowledge bank.
 * Single query combining count, total duration, and unique channels.
 * @param dbInstance - Optional database instance (for testing)
 */
export async function getVideoStats(dbInstance = defaultDb): Promise<{
  count: number
  totalHours: number
  channels: number
}> {
  const result = await dbInstance.select({
    count: sql<number>`count(*)`,
    totalDuration: sql<number>`coalesce(sum(duration), 0)`,
    channels: sql<number>`count(distinct channel)`,
  }).from(videos)

  const row = result[0]

  return {
    count: Number(row?.count ?? 0),
    totalHours: Math.round((Number(row?.totalDuration ?? 0) / 3600) * 10) / 10,
    channels: Number(row?.channels ?? 0),
  }
}

/**
 * Get all distinct channels (creators) with their video counts
 * Returns results sorted by video count descending
 * Filters out null channels (transcript-only videos)
 * @param dbInstance - Optional database instance (for testing)
 */
export async function getDistinctChannels(dbInstance = defaultDb): Promise<Array<{ channel: string; videoCount: number }>> {
  const results = await dbInstance
    .select({
      channel: videos.channel,
      videoCount: sql<number>`count(*)`,
    })
    .from(videos)
    .groupBy(videos.channel)
    .orderBy(sql`count(*) desc`)

  return results
    .filter(r => r.channel !== null)
    .map(r => ({
      channel: r.channel!,
      videoCount: Number(r.videoCount),
    }))
}
