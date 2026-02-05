import { db } from './index';
import { videos, type Video } from './schema';
import { desc, or, ilike, sql } from 'drizzle-orm';

/**
 * Search videos using simple ILIKE pattern matching
 * Temporary replacement for FTS5 until vector search (Story 4)
 */
export async function searchVideos(query: string): Promise<Video[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return db.select().from(videos).orderBy(desc(videos.createdAt));
  }

  const pattern = `%${trimmed}%`;

  return db.select()
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
 */
export async function getVideoStats(): Promise<{
  count: number;
  totalHours: number;
  channels: number;
}> {
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(videos);

  const durationResult = await db.select({
    total: sql<number>`coalesce(sum(duration), 0)`
  }).from(videos);

  const channelsResult = await db.select({
    channels: sql<number>`count(distinct channel)`
  }).from(videos);

  return {
    count: Number(countResult[0]?.count ?? 0),
    totalHours: Math.round((Number(durationResult[0]?.total ?? 0) / 3600) * 10) / 10,
    channels: Number(channelsResult[0]?.channels ?? 0),
  };
}
