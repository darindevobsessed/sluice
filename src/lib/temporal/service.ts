/**
 * Temporal metadata extraction service
 * Batch processes chunks to extract version numbers and release dates
 */

import { db, chunks, temporalMetadata } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { extractTemporalMetadata } from './extract'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@/lib/db/schema'

export interface ExtractTemporalResult {
  extracted: number
  skipped: number
}

export interface ExtractTemporalOptions {
  onProgress?: (processed: number, total: number) => void
}

/**
 * Extract temporal metadata for all chunks in a video
 *
 * Processes each chunk through temporal extraction and stores results
 * in the temporal_metadata table. Only stores results with confidence > 0.
 *
 * @param videoId - The video ID to process chunks for
 * @param options - Optional progress callback
 * @param database - Database instance (default: global db, injectable for testing)
 * @returns Count of extracted and skipped chunks
 *
 * @example
 * ```typescript
 * const result = await extractTemporalForVideo(123, {
 *   onProgress: (current, total) => console.log(`${current}/${total}`)
 * })
 * console.log(`Extracted: ${result.extracted}, Skipped: ${result.skipped}`)
 * ```
 */
export async function extractTemporalForVideo(
  videoId: number,
  options?: ExtractTemporalOptions,
  database: NodePgDatabase<typeof schema> = db as NodePgDatabase<typeof schema>
): Promise<ExtractTemporalResult> {
  // Fetch all chunks for this video
  const videoChunks = await database
    .select()
    .from(chunks)
    .where(eq(chunks.videoId, videoId))

  const totalChunks = videoChunks.length
  let extracted = 0
  let skipped = 0

  // Process each chunk
  for (let i = 0; i < totalChunks; i++) {
    const chunk = videoChunks[i]
    if (!chunk) continue

    // Extract temporal metadata from chunk content
    const extraction = extractTemporalMetadata(chunk.content)

    // Only store if confidence > 0
    if (extraction.confidence > 0) {
      // Combine versions and dates into single strings
      const versionMention = extraction.versions.length > 0
        ? extraction.versions.join(', ')
        : null
      const releaseDateMention = extraction.dates.length > 0
        ? extraction.dates.join(', ')
        : null

      // Insert temporal metadata
      await database
        .insert(temporalMetadata)
        .values({
          chunkId: chunk.id,
          versionMention,
          releaseDateMention,
          confidence: extraction.confidence,
        })

      extracted++
    } else {
      skipped++
    }

    // Report progress
    if (options?.onProgress) {
      options.onProgress(i + 1, totalChunks)
    }
  }

  return { extracted, skipped }
}
