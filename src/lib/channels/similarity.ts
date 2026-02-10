import { eq, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { db as database, chunks, videos, channels } from '@/lib/db'
import type * as schema from '@/lib/db/schema'
import { cosineSimilarity } from '@/lib/graph/compute-relationships'

export interface SimilarChannel {
  channelName: string
  similarity: number
  videoCount: number
  sampleTitles: string[]
}

/**
 * Computes the channel centroid by averaging all chunk embeddings from all videos by that channel.
 *
 * @param channelName - Name of the channel
 * @param db - Database instance (defaults to singleton)
 * @returns 384-dimensional centroid vector, or null if no embeddings found
 */
export async function computeChannelCentroid(
  channelName: string,
  db: NodePgDatabase<typeof schema> = database
): Promise<number[] | null> {
  // Fetch all chunks with embeddings for videos from this channel
  const channelChunks = await db
    .select({
      embedding: chunks.embedding,
    })
    .from(chunks)
    .innerJoin(videos, eq(chunks.videoId, videos.id))
    .where(
      sql`${videos.channel} = ${channelName} AND ${chunks.embedding} IS NOT NULL`
    )

  // Return null if no embeddings found
  if (channelChunks.length === 0) {
    return null
  }

  // Convert embeddings to number arrays
  const embeddingVectors = channelChunks.map(
    chunk => chunk.embedding as unknown as number[]
  )

  // Compute average (centroid)
  const dimensions = embeddingVectors[0]!.length
  const centroid = new Array(dimensions).fill(0)

  for (const embedding of embeddingVectors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i]! += embedding[i]!
    }
  }

  // Divide by count to get average
  for (let i = 0; i < dimensions; i++) {
    centroid[i]! /= embeddingVectors.length
  }

  return centroid
}

/**
 * Finds similar channels based on content similarity to followed channels.
 *
 * Computes centroids for all followed channels and compares against centroids
 * of all other known channels in the database. Returns ranked list of similar
 * channels above the similarity threshold.
 *
 * @param followedChannels - Array of followed channel names
 * @param options - Optional configuration
 * @param options.threshold - Minimum similarity score (0-1) to include (default: 0.6)
 * @param options.limit - Maximum number of similar channels to return (default: 10)
 * @param options.timeout - Maximum time in ms for computation (default: 5000). Returns partial results if exceeded.
 * @param db - Database instance (defaults to singleton)
 * @returns Array of similar channels, sorted by similarity (highest first)
 */
export async function findSimilarChannels(
  followedChannels: string[],
  options?: {
    threshold?: number
    limit?: number
    timeout?: number
  },
  db: NodePgDatabase<typeof schema> = database
): Promise<SimilarChannel[]> {
  const threshold = options?.threshold ?? 0.6
  const limit = options?.limit ?? 10
  const timeout = options?.timeout ?? 5000

  // Early return if no followed channels
  if (followedChannels.length === 0) {
    return []
  }

  // Get all followed channel names from channels table to filter out later
  const followedChannelRecords = await db
    .select({
      name: channels.name,
    })
    .from(channels)

  const followedChannelNames = new Set(followedChannelRecords.map(c => c.name))

  // Compute centroids for all followed channels
  const followedCentroids: number[][] = []
  for (const channelName of followedChannels) {
    const centroid = await computeChannelCentroid(channelName, db)
    if (centroid) {
      followedCentroids.push(centroid)
    }
  }

  // If no valid centroids for followed channels, return empty
  if (followedCentroids.length === 0) {
    return []
  }

  // Get all unique channel names from videos table (excluding followed channels)
  const allChannelNames = await db
    .selectDistinct({
      channel: videos.channel,
    })
    .from(videos)

  // Filter out followed channels and null channels (transcript-only videos)
  const candidateChannels = allChannelNames
    .map(row => row.channel)
    .filter(name => name !== null && !followedChannelNames.has(name))

  // Compute similarity for each candidate channel
  const similarChannels: SimilarChannel[] = []
  const startTime = Date.now()

  for (const candidateChannelName of candidateChannels as string[]) {
    // Performance guard: return partial results if computation exceeds timeout
    if (Date.now() - startTime > timeout) {
      break
    }
    // Get video count with embeddings for this channel
    const videoCountResult = await db
      .selectDistinct({
        videoId: chunks.videoId,
      })
      .from(chunks)
      .innerJoin(videos, eq(chunks.videoId, videos.id))
      .where(
        sql`${videos.channel} = ${candidateChannelName} AND ${chunks.embedding} IS NOT NULL`
      )

    const videoCount = videoCountResult.length

    // Skip channels with fewer than 3 embedded videos
    if (videoCount < 3) {
      continue
    }

    // Compute centroid for candidate channel
    const candidateCentroid = await computeChannelCentroid(candidateChannelName, db)
    if (!candidateCentroid) {
      continue
    }

    // Compute similarity to all followed channel centroids and take the max
    let maxSimilarity = 0
    for (const followedCentroid of followedCentroids) {
      const similarity = cosineSimilarity(followedCentroid, candidateCentroid)
      maxSimilarity = Math.max(maxSimilarity, similarity)
    }

    // Only include if above threshold
    if (maxSimilarity > threshold) {
      // Get sample video titles (up to 3)
      const sampleVideos = await db
        .select({
          title: videos.title,
        })
        .from(videos)
        .where(eq(videos.channel, candidateChannelName))
        .limit(3)

      similarChannels.push({
        channelName: candidateChannelName,
        similarity: maxSimilarity,
        videoCount,
        sampleTitles: sampleVideos.map(v => v.title),
      })
    }
  }

  // Sort by similarity (highest first) and apply limit
  return similarChannels
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}
