import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { db as database, chunks, relationships } from '@/lib/db'
import type * as schema from '@/lib/db/schema'

/**
 * Computes similarity-based relationships between chunks for a video.
 *
 * Uses pgvector's cosine distance operator (<=>) to find related chunks.
 * Compares the video's chunks against ALL chunks (same-video + cross-video).
 * Creates bidirectional relationships (A->B and B->A) for graph traversal.
 * Only creates edges where similarity > threshold (default 0.75).
 *
 * Algorithm:
 * 1. Use SQL with pgvector <=> to compare video chunks against ALL chunks
 * 2. Filter by threshold in SQL
 * 3. Insert bidirectional relationships (both directions)
 * 4. Handle conflicts gracefully with onConflictDoNothing
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

  // Use pgvector to find similar chunks via SQL
  // Compare this video's chunks against ALL chunks (cross-video + same-video)
  // pgvector's <=> operator returns cosine distance (0 = identical, 2 = opposite)
  // Convert to similarity: 1 - distance
  const similarityResults = await db.execute<{
    source_id: number
    target_id: number
    similarity: number
  }>(sql`
    SELECT
      c1.id AS source_id,
      c2.id AS target_id,
      1 - (c1.embedding <=> c2.embedding) AS similarity
    FROM ${chunks} c1
    CROSS JOIN ${chunks} c2
    WHERE c1.video_id = ${videoId}
      AND c2.id != c1.id
      AND c1.embedding IS NOT NULL
      AND c2.embedding IS NOT NULL
      AND 1 - (c1.embedding <=> c2.embedding) > ${threshold}
  `)

  const similarChunks = similarityResults.rows

  // Early return if no relationships to create
  if (similarChunks.length === 0) {
    if (onProgress) {
      onProgress(0, 0)
    }
    return { created: 0, skipped: 0 }
  }

  // Progress: we know how many similarities we found
  if (onProgress) {
    onProgress(similarChunks.length, similarChunks.length)
  }

  // Create bidirectional relationships
  // For each (A, B, similarity), insert both (A->B) and (B->A)
  const relationshipsToCreate: Array<{
    sourceChunkId: number
    targetChunkId: number
    similarity: number
  }> = []

  for (const row of similarChunks) {
    // Forward direction: source -> target
    relationshipsToCreate.push({
      sourceChunkId: row.source_id,
      targetChunkId: row.target_id,
      similarity: row.similarity,
    })

    // Reverse direction: target -> source
    relationshipsToCreate.push({
      sourceChunkId: row.target_id,
      targetChunkId: row.source_id,
      similarity: row.similarity,
    })
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
