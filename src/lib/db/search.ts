import { db as defaultDb } from './index';
import { videos, type Video } from './schema';
import { desc, or, ilike, sql } from 'drizzle-orm';

/**
 * Search videos using simple ILIKE pattern matching
 * Temporary replacement for FTS5 until vector search (Story 4)
 * @param query - Search query string
 * @param dbInstance - Optional database instance (for testing)
 */
export async function searchVideos(query: string, dbInstance = defaultDb): Promise<Video[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return dbInstance.select().from(videos).orderBy(desc(videos.createdAt));
  }

  const pattern = `%${trimmed}%`;

  return dbInstance.select()
    .from(videos)
    .where(
      or(
        ilike(videos.title, pattern),
        ilike(videos.channel, pattern),
        ilike(videos.transcript, pattern)
      )
    )
    .orderBy(desc(videos.createdAt));
}

/**
 * Get statistics about the video knowledge bank
 * @param dbInstance - Optional database instance (for testing)
 */
export async function getVideoStats(dbInstance = defaultDb): Promise<{
  count: number;
  totalHours: number;
  channels: number;
}> {
  const countResult = await dbInstance.select({ count: sql<number>`count(*)` })
    .from(videos);

  const durationResult = await dbInstance.select({
    total: sql<number>`coalesce(sum(duration), 0)`
  }).from(videos);

  const channelsResult = await dbInstance.select({
    channels: sql<number>`count(distinct channel)`
  }).from(videos);

  return {
    count: Number(countResult[0]?.count ?? 0),
    totalHours: Math.round((Number(durationResult[0]?.total ?? 0) / 3600) * 10) / 10,
    channels: Number(channelsResult[0]?.channels ?? 0),
  };
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
