import { generateEmbedding } from './pipeline'
import type { ChunkData, ChunkWithEmbedding, EmbedChunksResult } from './types'
import { db, chunks } from '@/lib/db'
import { eq } from 'drizzle-orm'

const BATCH_SIZE = 32

/**
 * Generate embeddings for an array of chunks with progress reporting and batch optimization.
 *
 * @param chunksArray - Array of chunks to embed
 * @param onProgress - Optional callback fired after each batch with (current, total)
 * @param videoId - Optional video ID to store chunks directly to database
 * @returns Result containing chunks with embeddings and operation stats
 */
export async function embedChunks(
  chunksArray: ChunkData[],
  onProgress?: (current: number, total: number) => void,
  videoId?: number
): Promise<EmbedChunksResult> {
  const startTime = performance.now()
  const totalChunks = chunksArray.length

  // Handle empty input
  if (totalChunks === 0) {
    return {
      chunks: [],
      totalChunks: 0,
      successCount: 0,
      errorCount: 0,
      durationMs: 0
    }
  }

  const results: ChunkWithEmbedding[] = []
  let successCount = 0
  let errorCount = 0

  // Process chunks in batches
  for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
    const batch = chunksArray.slice(i, Math.min(i + BATCH_SIZE, totalChunks))

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (chunk): Promise<ChunkWithEmbedding> => {
        try {
          const embedding = await generateEmbedding(chunk.content)
          successCount++

          return {
            ...chunk,
            embedding: Array.from(embedding)
          }
        } catch (error) {
          errorCount++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          return {
            ...chunk,
            embedding: [], // Empty embedding on error
            error: errorMessage
          }
        }
      })
    )

    results.push(...batchResults)

    // Report progress after each batch
    const currentProgress = Math.min(i + BATCH_SIZE, totalChunks)
    if (onProgress) {
      onProgress(currentProgress, totalChunks)
    }
  }

  const durationMs = performance.now() - startTime

  // Store to database if videoId provided
  if (videoId !== undefined) {
    await storeChunksToDatabase(results, videoId)
  }

  return {
    chunks: results,
    totalChunks,
    successCount,
    errorCount,
    durationMs
  }
}

/**
 * Store chunks with embeddings to database within a transaction.
 * Deletes existing chunks for the video first, then inserts new ones.
 *
 * @param chunksWithEmbeddings - Chunks with embeddings to store
 * @param videoId - Video ID to associate chunks with
 */
async function storeChunksToDatabase(
  chunksWithEmbeddings: ChunkWithEmbedding[],
  videoId: number
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete existing chunks for this video
    await tx.delete(chunks).where(eq(chunks.videoId, videoId))

    // Only insert chunks that have successful embeddings
    const validChunks = chunksWithEmbeddings.filter(chunk => !chunk.error && chunk.embedding.length > 0)

    if (validChunks.length === 0) {
      return
    }

    // Insert new chunks
    await tx.insert(chunks).values(
      validChunks.map(chunk => ({
        videoId,
        content: chunk.content,
        startTime: Math.floor(chunk.startTime / 1000), // Convert milliseconds to seconds
        endTime: Math.floor(chunk.endTime / 1000), // Convert milliseconds to seconds
        embedding: chunk.embedding // pgvector accepts number[] directly
      }))
    )
  })
}
