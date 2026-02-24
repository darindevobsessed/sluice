import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db as defaultDb } from './index'
import { insights } from './schema'
import type { ExtractionResult } from '@/lib/claude/prompts/types'

/**
 * Get extraction for a video
 * @param videoId - Video ID to get extraction for
 * @param dbInstance - Optional database instance (for testing)
 * @returns Extraction record or null if not found
 */
export async function getExtractionForVideo(
  videoId: number,
  dbInstance = defaultDb
): Promise<{
  id: string
  videoId: number
  contentType: string
  extraction: ExtractionResult
  createdAt: Date
  updatedAt: Date
} | null> {
  const results = await dbInstance
    .select()
    .from(insights)
    .where(eq(insights.videoId, videoId))
    .limit(1)

  const result = results[0]
  if (!result) return null

  return {
    ...result,
    extraction: result.extraction as ExtractionResult,
  }
}

/**
 * Upsert (create or update) extraction for a video
 * @param videoId - Video ID to save extraction for
 * @param extraction - ExtractionResult to save
 * @param dbInstance - Optional database instance (for testing)
 * @returns Created or updated extraction record
 */
export async function upsertExtraction(
  videoId: number,
  extraction: ExtractionResult,
  dbInstance = defaultDb
): Promise<{
  id: string
  videoId: number
  contentType: string
  extraction: ExtractionResult
  createdAt: Date
  updatedAt: Date
}> {
  const now = new Date()
  const id = crypto.randomUUID()

  const [result] = await dbInstance
    .insert(insights)
    .values({
      id,
      videoId,
      contentType: extraction.contentType,
      extraction: extraction as unknown as typeof insights.$inferInsert.extraction,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: insights.videoId,
      set: {
        contentType: extraction.contentType,
        extraction: extraction as unknown as typeof insights.$inferInsert.extraction,
        updatedAt: now,
      },
    })
    .returning()

  return {
    ...result!,
    extraction: result!.extraction as ExtractionResult,
  }
}

/**
 * Delete extraction for a video
 * @param videoId - Video ID to delete extraction for
 * @param dbInstance - Optional database instance (for testing)
 */
export async function deleteExtraction(
  videoId: number,
  dbInstance = defaultDb
): Promise<void> {
  await dbInstance.delete(insights).where(eq(insights.videoId, videoId))
}
