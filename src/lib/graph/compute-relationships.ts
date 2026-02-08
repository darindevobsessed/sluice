import { eq, and, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { db as database, chunks, relationships } from '@/lib/db'
import type * as schema from '@/lib/db/schema'

/**
 * Computes similarity-based relationships between chunks within a video.
 *
 * Uses cosine similarity on existing embeddings to find related chunks.
 * Only creates edges where similarity > threshold (default 0.75).
 *
 * Algorithm:
 * 1. Fetch all chunks with embeddings for the video
 * 2. Compute pairwise similarity in-memory
 * 3. Filter by threshold
 * 4. Batch insert relationships (with conflict handling)
 *
 * @param videoId - The video to compute relationships for
 * @param options - Optional configuration
 * @param options.threshold - Minimum similarity score (0-1) to create relationship (default: 0.75)
 * @param options.onProgress - Progress callback (processed, total)
 * @param db - Database instance (defaults to singleton)
 * @returns Object with created and skipped counts
 */
export async function computeRelationships(
  videoId: number,
  options?: {
    threshold?: number
    onProgress?: (processed: number, total: number) => void
  },
  db: NodePgDatabase<typeof schema> = database
): Promise<{ created: number; skipped: number }> {
  const threshold = options?.threshold ?? 0.75
  const onProgress = options?.onProgress

  // Fetch all chunks with embeddings for this video
  const videoChunks = await db
    .select({
      id: chunks.id,
      embedding: chunks.embedding,
    })
    .from(chunks)
    .where(and(eq(chunks.videoId, videoId), sql`${chunks.embedding} IS NOT NULL`))

  // Early return if no chunks or only one chunk
  if (videoChunks.length < 2) {
    return { created: 0, skipped: 0 }
  }

  // Convert embeddings from string to number arrays
  const chunksWithVectors = videoChunks.map(chunk => ({
    id: chunk.id,
    vector: chunk.embedding as unknown as number[],
  }))

  // Compute pairwise similarities
  const relationshipsToCreate: Array<{
    sourceChunkId: number
    targetChunkId: number
    similarity: number
  }> = []

  const totalComparisons = (chunksWithVectors.length * (chunksWithVectors.length - 1)) / 2
  let processed = 0

  for (let i = 0; i < chunksWithVectors.length; i++) {
    const source = chunksWithVectors[i]!

    for (let j = i + 1; j < chunksWithVectors.length; j++) {
      const target = chunksWithVectors[j]!

      // Compute cosine similarity
      const similarity = cosineSimilarity(source.vector, target.vector)

      // Only create relationship if above threshold
      if (similarity > threshold) {
        relationshipsToCreate.push({
          sourceChunkId: source.id,
          targetChunkId: target.id,
          similarity,
        })
      }

      processed++
      if (onProgress && processed % 10 === 0) {
        onProgress(processed, totalComparisons)
      }
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress(totalComparisons, totalComparisons)
  }

  // Early return if no relationships to create
  if (relationshipsToCreate.length === 0) {
    return { created: 0, skipped: 0 }
  }

  // Batch insert relationships
  // Use onConflictDoNothing to handle duplicates gracefully
  const insertResult = await db
    .insert(relationships)
    .values(relationshipsToCreate)
    .onConflictDoNothing()
    .returning({ id: relationships.id })

  const created = insertResult.length
  const skipped = relationshipsToCreate.length - created

  return { created, skipped }
}

/**
 * Computes cosine similarity between two vectors.
 * Returns a value between -1 and 1, where:
 * - 1 = identical direction
 * - 0 = orthogonal
 * - -1 = opposite direction
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)

  // Handle zero vectors
  if (denominator === 0) {
    return 0
  }

  return dotProduct / denominator
}
