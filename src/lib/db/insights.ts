import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from './index';
import { insights } from './schema';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

/**
 * Get extraction for a video
 * @param videoId - Video ID to get extraction for
 * @returns Extraction record or null if not found
 */
export async function getExtractionForVideo(
  videoId: number
): Promise<{
  id: string;
  videoId: number;
  contentType: string;
  extraction: ExtractionResult;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  const results = await db
    .select()
    .from(insights)
    .where(eq(insights.videoId, videoId))
    .limit(1);

  const result = results[0];
  if (!result) return null;

  return {
    ...result,
    extraction: result.extraction as ExtractionResult,
  };
}

/**
 * Upsert (create or update) extraction for a video
 * @param videoId - Video ID to save extraction for
 * @param extraction - ExtractionResult to save
 * @returns Created or updated extraction record
 */
export async function upsertExtraction(
  videoId: number,
  extraction: ExtractionResult
): Promise<{
  id: string;
  videoId: number;
  contentType: string;
  extraction: ExtractionResult;
  createdAt: Date;
  updatedAt: Date;
}> {
  const now = new Date();
  const existing = await getExtractionForVideo(videoId);

  if (existing) {
    // Update existing
    await db
      .update(insights)
      .set({
        contentType: extraction.contentType,
        extraction: extraction as unknown as typeof insights.$inferInsert.extraction,
        updatedAt: now,
      })
      .where(eq(insights.id, existing.id));

    return {
      ...existing,
      contentType: extraction.contentType,
      extraction,
      updatedAt: now,
    };
  }

  // Create new
  const id = nanoid();
  const dbRecord = {
    id,
    videoId,
    contentType: extraction.contentType,
    extraction: extraction as unknown as typeof insights.$inferInsert.extraction,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(insights).values(dbRecord);

  return {
    id,
    videoId,
    contentType: extraction.contentType,
    extraction,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Delete extraction for a video
 * @param videoId - Video ID to delete extraction for
 */
export async function deleteExtraction(
  videoId: number
): Promise<void> {
  await db.delete(insights).where(eq(insights.videoId, videoId));
}
