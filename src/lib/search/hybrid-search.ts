import { ilike, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { db as defaultDb, chunks, videos } from '@/lib/db';
import type * as schema from '@/lib/db/schema';
import type { SearchResult } from './types';
import { vectorSearch } from './vector-search';
import { generateEmbedding } from '@/lib/embeddings/pipeline';

/**
 * Performs keyword search on chunk content using case-insensitive LIKE matching.
 *
 * @param query - Text query to search for
 * @param limit - Maximum number of results to return (default: 20)
 * @param db - Database instance (optional, defaults to singleton)
 * @returns Array of search results with similarity score of 1.0
 */
async function keywordSearch(
  query: string,
  limit = 20,
  db: NodePgDatabase<typeof schema> = defaultDb
): Promise<SearchResult[]> {
  const pattern = `%${query}%`;

  const results = await db
    .select({
      chunkId: chunks.id,
      content: chunks.content,
      startTime: chunks.startTime,
      endTime: chunks.endTime,
      similarity: sql<number>`1.0`, // Keyword matches get score 1.0
      videoId: videos.id,
      videoTitle: videos.title,
      channel: videos.channel,
      youtubeId: videos.youtubeId,
      thumbnail: videos.thumbnail,
    })
    .from(chunks)
    .innerJoin(videos, eq(chunks.videoId, videos.id))
    .where(ilike(chunks.content, pattern))
    .limit(limit);

  // Ensure similarity is a number (SQL literal returns string)
  return results.map(r => ({
    ...r,
    similarity: typeof r.similarity === 'string' ? parseFloat(r.similarity) : r.similarity,
  }));
}

/**
 * Combines vector and keyword search results using Reciprocal Rank Fusion (RRF).
 *
 * RRF gives each result a score based on its rank in each result list:
 * score = sum(1 / (k + rank)) for each list the result appears in
 *
 * This naturally boosts results that appear in multiple lists while being
 * robust to differences in score distributions between methods.
 *
 * @param vectorResults - Results from vector similarity search
 * @param keywordResults - Results from keyword search
 * @param k - RRF constant (default: 60, recommended range 10-100)
 * @returns Merged and deduplicated results ordered by RRF score
 */
function reciprocalRankFusion(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  k = 60
): SearchResult[] {
  const scores = new Map<number, { result: SearchResult; score: number }>();

  // Score from vector results
  vectorResults.forEach((result, rank) => {
    const existing = scores.get(result.chunkId);
    const rrfScore = 1 / (k + rank + 1);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.chunkId, { result, score: rrfScore });
    }
  });

  // Score from keyword results
  keywordResults.forEach((result, rank) => {
    const existing = scores.get(result.chunkId);
    const rrfScore = 1 / (k + rank + 1);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.chunkId, { result, score: rrfScore });
    }
  });

  // Sort by combined score and update similarity to RRF score
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ result, score }) => ({ ...result, similarity: score }));
}

/**
 * Performs hybrid search combining vector similarity and keyword matching.
 *
 * Supports three modes:
 * - 'vector': Pure vector similarity search
 * - 'keyword': Pure keyword matching
 * - 'hybrid': Combines both using Reciprocal Rank Fusion (default)
 *
 * Hybrid mode fetches more results from each method (limit * 2) before
 * merging with RRF to ensure diverse results in the final set.
 *
 * @param query - Text query to search for
 * @param options - Search options (mode, limit)
 * @param db - Database instance (optional, defaults to singleton)
 * @returns Array of search results ordered by relevance
 */
export async function hybridSearch(
  query: string,
  options: { mode?: 'vector' | 'keyword' | 'hybrid'; limit?: number } = {},
  db: NodePgDatabase<typeof schema> = defaultDb
): Promise<SearchResult[]> {
  const { mode = 'hybrid', limit = 10 } = options;

  // Pure keyword mode
  if (mode === 'keyword') {
    return keywordSearch(query, limit, db);
  }

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  const embeddingArray = Array.from(queryEmbedding);

  // Pure vector mode
  if (mode === 'vector') {
    return vectorSearch(embeddingArray, limit, 0.3, db);
  }

  // Hybrid mode: combine both with RRF
  // Fetch more results (limit * 2) from each method for better fusion
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(embeddingArray, limit * 2, 0.3, db),
    keywordSearch(query, limit * 2, db),
  ]);

  // Apply RRF and return top results
  return reciprocalRankFusion(vectorResults, keywordResults).slice(0, limit);
}
