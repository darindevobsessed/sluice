import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { insights } from './schema';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

// Use Record<string, unknown> to accept both schema-typed and untyped databases
type DbInstance = BetterSQLite3Database<Record<string, unknown>>;

/**
 * Get extraction for a video
 * @param videoId - Video ID to get extraction for
 * @param db - Database instance (defaults to default instance)
 * @returns Extraction record or null if not found
 */
export async function getExtractionForVideo(
  videoId: number,
  db?: DbInstance
): Promise<{
  id: string;
  videoId: number;
  contentType: string;
  extraction: ExtractionResult;
  createdAt: Date;
  updatedAt: Date;
} | null> {
  // Use passed db or import default
  const dbInstance = db ?? (await import('./index')).db;

  const result = dbInstance
    .select()
    .from(insights)
    .where(eq(insights.videoId, videoId))
    .get();

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
 * @param db - Database instance (defaults to default instance)
 * @returns Created or updated extraction record
 */
export async function upsertExtraction(
  videoId: number,
  extraction: ExtractionResult,
  db?: DbInstance
): Promise<{
  id: string;
  videoId: number;
  contentType: string;
  extraction: ExtractionResult;
  createdAt: Date;
  updatedAt: Date;
}> {
  // Use passed db or import default
  const dbInstance = db ?? (await import('./index')).db;

  const now = new Date();
  const existing = await getExtractionForVideo(videoId, dbInstance);

  if (existing) {
    // Update existing
    await dbInstance
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

  await dbInstance.insert(insights).values(dbRecord);

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
 * @param db - Database instance (defaults to default instance)
 */
export async function deleteExtraction(
  videoId: number,
  db?: DbInstance
): Promise<void> {
  // Use passed db or import default
  const dbInstance = db ?? (await import('./index')).db;

  await dbInstance.delete(insights).where(eq(insights.videoId, videoId));
}
