import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, videoFocusAreas } from '@/lib/db';
import { hybridSearch } from '@/lib/search/hybrid-search';
import { aggregateByVideo, type VideoResult } from '@/lib/search/aggregate';
import type { SearchResult } from '@/lib/search/types';
import { startApiTimer } from '@/lib/api-timing';

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
 * GET /api/search?q=query&limit=10&mode=hybrid&temporalDecay=true&halfLifeDays=365
 *
 * Performs hybrid search across chunk content and returns both
 * chunk-level and video-level results.
 *
 * Query parameters:
 * - q: Search query (required)
 * - limit: Max results per type (default: 10)
 * - mode: Search mode - vector, keyword, or hybrid (default: hybrid)
 * - temporalDecay: Apply temporal decay to boost recent content (default: false)
 * - halfLifeDays: Half-life for temporal decay in days (default: 365)
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

  // Parse focus area filter
  const focusAreaIdParam = searchParams.get('focusAreaId');
  let focusAreaId: number | null = null;
  if (focusAreaIdParam) {
    const parsed = parseInt(focusAreaIdParam, 10);
    if (!isNaN(parsed)) {
      focusAreaId = parsed;
    }
  }

  // Parse temporal decay parameters
  const temporalDecayParam = searchParams.get('temporalDecay') || 'false';
  const temporalDecay = temporalDecayParam === 'true';
  const halfLifeDays = parseInt(searchParams.get('halfLifeDays') || '365', 10);

  const timer = startApiTimer('/api/search', 'GET')

  // If no query, return empty results
  // hasEmbeddings defaults to true for empty queries — no count query needed
  if (!query.trim()) {
    timer.end(200, { empty: true })
    const response: SearchResponse = {
      chunks: [],
      videos: [],
      query: '',
      mode,
      timing: 0,
      hasEmbeddings: true,
    };
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  }

  // Reject queries that are too long
  if (query.length > 500) {
    timer.end(400, { reason: 'query_too_long' })
    return NextResponse.json(
      { error: 'Search query must be 500 characters or fewer' },
      { status: 400 }
    )
  }

  // Run search - fetch more chunks (limit * 3) for better video aggregation
  let chunkResults = await hybridSearch(query, {
    mode,
    limit: limit * 3,
    temporalDecay,
    halfLifeDays,
  });

  // Filter by focus area if provided
  if (focusAreaId !== null) {
    const assignedVideos = await db
      .select({ videoId: videoFocusAreas.videoId })
      .from(videoFocusAreas)
      .where(eq(videoFocusAreas.focusAreaId, focusAreaId));
    const videoIds = new Set(assignedVideos.map(v => v.videoId));
    chunkResults = chunkResults.filter(c => videoIds.has(c.videoId));
  }

  const videoResults = aggregateByVideo(chunkResults);

  // Derive hasEmbeddings from search results — avoids a separate count(*) query.
  // Keyword mode never needs embeddings, so always report true.
  // For vector/hybrid modes, results only come back when embeddings exist.
  const hasEmbeddings = mode === 'keyword' ? true : chunkResults.length > 0

  const timing = timer.end(200, { mode, resultCount: videoResults.length, hasEmbeddings })

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

/**
 * Configure route segment for Vercel
 * maxDuration allows longer-running operations (requires Pro plan)
 */
export const maxDuration = 300
