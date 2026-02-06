import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, chunks } from '@/lib/db';
import { hybridSearch } from '@/lib/search/hybrid-search';
import { aggregateByVideo, type VideoResult } from '@/lib/search/aggregate';
import type { SearchResult } from '@/lib/search/types';

/**
 * Search mode: vector, keyword, or hybrid (RRF)
 */
type SearchMode = 'vector' | 'keyword' | 'hybrid';

/**
 * Search response format
 */
interface SearchResponse {
  chunks: SearchResult[]; // Raw chunk results with scores
  videos: VideoResult[]; // Aggregated by video
  query: string; // Echo back query
  mode: SearchMode;
  timing: number; // ms for performance tracking
  hasEmbeddings: boolean; // Whether any videos have embeddings
}

/**
 * GET /api/search?q=query&limit=10&mode=hybrid
 *
 * Performs hybrid search across chunk content and returns both
 * chunk-level and video-level results.
 *
 * Query parameters:
 * - q: Search query (required)
 * - limit: Max results per type (default: 10)
 * - mode: Search mode - vector, keyword, or hybrid (default: hybrid)
 *
 * Returns empty results if query is empty/missing.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const modeParam = searchParams.get('mode') || 'hybrid';
  const mode = (modeParam === 'vector' || modeParam === 'keyword' || modeParam === 'hybrid'
    ? modeParam
    : 'hybrid') as SearchMode;

  const start = performance.now();

  // Check if any embeddings exist
  const embeddingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(chunks)
    .where(sql`${chunks.embedding} IS NOT NULL`);
  const hasEmbeddings = (embeddingCount[0]?.count ?? 0) > 0;

  // If no query, return empty results
  if (!query.trim()) {
    const response: SearchResponse = {
      chunks: [],
      videos: [],
      query: '',
      mode,
      timing: 0,
      hasEmbeddings,
    };
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  }

  // Run search - fetch more chunks (limit * 3) for better video aggregation
  const chunkResults = await hybridSearch(query, { mode, limit: limit * 3 });
  const videoResults = aggregateByVideo(chunkResults);

  const timing = Math.round(performance.now() - start);

  const response: SearchResponse = {
    chunks: chunkResults.slice(0, limit),
    videos: videoResults.slice(0, limit),
    query,
    mode,
    timing,
    hasEmbeddings,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'private, max-age=60',
    },
  });
}
