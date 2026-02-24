import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db, relationships, chunks } from '@/lib/db'
import { computeRelationships } from '@/lib/graph/compute-relationships'
import { verifyCronSecret } from '@/lib/auth-guards'

/**
 * POST /api/graph/backfill
 *
 * Clears all existing relationships and recomputes them for all videos
 * that have embedded chunks.
 *
 * Algorithm:
 * 1. Delete all existing relationships
 * 2. Get distinct video IDs that have chunks with embeddings
 * 3. Call computeRelationships for each video
 * 4. Return stats on videos processed and relationships created
 *
 * Note: This is a long-running operation for large databases.
 * For the current 53 videos, acceptable for one-time backfill.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Verify cron secret (this is a destructive admin operation)
    const authResult = verifyCronSecret(request)
    if (!authResult.valid) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Step 1: Clear all existing relationships
    await db.delete(relationships).returning({ id: relationships.id })

    // Step 2: Get all distinct video IDs that have chunks with embeddings
    const videoResults = await db.execute<{ video_id: number }>(sql`
      SELECT DISTINCT video_id
      FROM ${chunks}
      WHERE embedding IS NOT NULL
      ORDER BY video_id
    `)

    const videoIds = videoResults.rows.map(row => row.video_id)

    // Step 3: Compute relationships for each video
    let totalRelationshipsCreated = 0

    for (const videoId of videoIds) {
      const result = await computeRelationships(videoId)
      totalRelationshipsCreated += result.created
    }

    // Step 4: Return stats
    return NextResponse.json({
      videosProcessed: videoIds.length,
      relationshipsCreated: totalRelationshipsCreated,
    })
  } catch (error) {
    console.error('Error during graph backfill:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Configure route segment for Vercel
 * maxDuration allows longer-running operations (requires Pro plan)
 */
export const maxDuration = 60
