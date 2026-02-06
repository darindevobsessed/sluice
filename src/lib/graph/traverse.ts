import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { db as database, chunks, relationships, videos } from '@/lib/db'
import type * as schema from '@/lib/db/schema'
import type { RelatedChunk } from './types'

export async function getRelatedChunks(
  videoId: number,
  options?: {
    limit?: number
    minSimilarity?: number
    includeWithinVideo?: boolean
  },
  db: NodePgDatabase<typeof schema> = database
): Promise<RelatedChunk[]> {
  const limit = options?.limit ?? 10
  const minSimilarity = options?.minSimilarity ?? 0.75
  const includeWithinVideo = options?.includeWithinVideo ?? false

  // Step 1: Get all chunk IDs for the source video
  const videoChunkIds = await db
    .select({ id: chunks.id })
    .from(chunks)
    .where(eq(chunks.videoId, videoId))

  const chunkIds = videoChunkIds.map(c => c.id)

  // Early return if no chunks
  if (chunkIds.length === 0) {
    return []
  }

  // Step 2: Find related chunks from other videos
  const conditions = [
    inArray(relationships.sourceChunkId, chunkIds),
    sql`${relationships.similarity} >= ${minSimilarity}`,
  ]

  // Filter out same-video chunks unless includeWithinVideo is true
  if (!includeWithinVideo) {
    conditions.push(sql`${chunks.videoId} != ${videoId}`)
  }

  const results = await db
    .select({
      chunkId: chunks.id,
      content: chunks.content,
      startTime: chunks.startTime,
      endTime: chunks.endTime,
      similarity: relationships.similarity,
      videoId: videos.id,
      videoTitle: videos.title,
      channel: videos.channel,
      youtubeId: videos.youtubeId,
    })
    .from(relationships)
    .innerJoin(chunks, eq(relationships.targetChunkId, chunks.id))
    .innerJoin(videos, eq(chunks.videoId, videos.id))
    .where(and(...conditions))
    .orderBy(desc(relationships.similarity))
    .limit(limit)

  // Step 3: Map results to RelatedChunk[]
  return results.map(r => ({
    chunkId: r.chunkId,
    content: r.content,
    startTime: r.startTime ?? 0,
    endTime: r.endTime ?? 0,
    similarity: r.similarity,
    video: {
      id: r.videoId,
      title: r.videoTitle,
      channel: r.channel,
      youtubeId: r.youtubeId,
    },
  }))
}
