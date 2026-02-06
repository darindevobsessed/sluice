---
name: rag-search
title: RAG Search
status: active
priority: high
created: 2026-02-05
updated: 2026-02-06
cycle: rag-foundation
story_number: 4
chunks_total: 4
chunks_complete: 3
---

# Story: RAG Search

## Spark

Replace FTS5 keyword search with semantic vector search. When a user searches, embed their query and find the most similar chunks across all transcripts using cosine similarity.

Return relevant context with source attribution (which video, which timestamp). This becomes the foundation for the MCP server in Cycle 2.

> *"So you're gonna take the transcript, You're gonna do rag ingestion where you can break up an chunks. You're gonna do the embeddings."*

## Dependencies

**Blocked by:** Story 3 (Embedding Pipeline) — needs embeddings to search
**Blocks:** None in this cycle; enables Cycle 2 MCP server

## Acceptance

- [ ] Query embedding uses same Transformers.js pipeline (384 dimensions)
- [ ] Vector search uses Drizzle's native `cosineDistance()` function
- [ ] Returns top-k chunks (default k=10) with similarity scores
- [ ] Each result includes: chunk content, video title, channel, timestamp, score
- [ ] Hybrid search combines vector + keyword for better recall
- [ ] Search API returns both chunk results and aggregated video results
- [ ] UI shows chunk-level results with "jump to timestamp" links
- [ ] Empty state when no videos have embeddings yet
- [ ] Performance: <500ms for typical queries

## Chunks

### Chunk 1: Core Vector Search Function

**Goal:** Create the semantic search function using Drizzle's native pgvector support

**Files:**
- `src/lib/search/vector-search.ts` — create
- `src/lib/search/types.ts` — create
- `src/lib/search/index.ts` — create

**Implementation Details:**
- Query embedding:
  - Use same singleton pipeline from `src/lib/embeddings/pipeline.ts`
  - Embed query string to get 384-dimension vector
- Vector search using Drizzle-native functions:
  ```typescript
  import { cosineDistance, desc, sql } from 'drizzle-orm';
  import { db } from '@/lib/db';
  import { chunks, videos } from '@/lib/db/schema';

  export async function vectorSearch(
    queryEmbedding: number[],
    limit = 10,
    threshold = 0.3
  ): Promise<SearchResult[]> {
    // Cosine distance: 0 = identical, 2 = opposite
    // Convert to similarity: 1 - (distance / 2)
    const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, queryEmbedding)} / 2)`;

    const results = await db
      .select({
        chunkId: chunks.id,
        content: chunks.content,
        startTime: chunks.startTime,
        endTime: chunks.endTime,
        similarity,
        videoId: videos.id,
        videoTitle: videos.title,
        channel: videos.channel,
        youtubeId: videos.youtubeId,
        thumbnail: videos.thumbnail,
      })
      .from(chunks)
      .innerJoin(videos, eq(chunks.videoId, videos.id))
      .where(sql`${chunks.embedding} IS NOT NULL`)
      .orderBy(desc(similarity))
      .limit(limit);

    // Filter by threshold after query (Drizzle doesn't support WHERE on computed)
    return results.filter(r => r.similarity >= threshold);
  }
  ```
- Return type `SearchResult` with chunk, video metadata, similarity score
- Handle edge cases: no embeddings, empty query

**What Could Break:**
- pgvector extension not enabled — ensure Story 1 migration ran
- No chunks with embeddings — return empty array gracefully
- Drizzle version mismatch — verify cosineDistance is available

**Done When:**
- [ ] `vectorSearch(embedding, limit?)` function implemented
- [ ] Uses Drizzle-native `cosineDistance()` function
- [ ] Returns chunks ordered by similarity (highest first)
- [ ] Includes video metadata (title, channel, youtubeId, thumbnail)
- [ ] Includes timestamp (startTime, endTime) for each chunk
- [ ] Similarity score normalized to 0-1 range
- [ ] Handles edge cases (no embeddings, threshold filtering)

---

### Chunk 2: Hybrid Search (Vector + Keyword)

**Goal:** Combine vector similarity with keyword matching for better recall on exact terms

**Files:**
- `src/lib/search/hybrid-search.ts` — create
- `src/lib/search/index.ts` — modify (export hybrid)

**Implementation Details:**
- Hybrid approach using Reciprocal Rank Fusion (RRF):
  1. Run vector search → get ranked results
  2. Run keyword search (ILIKE on chunk content) → get ranked results
  3. Merge using RRF: `score = sum(1 / (k + rank))` where k=60 (standard)
- Keyword search using Drizzle:
  ```typescript
  import { ilike, eq } from 'drizzle-orm';

  async function keywordSearch(query: string, limit = 20): Promise<SearchResult[]> {
    const pattern = `%${query}%`;

    return db
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
  }
  ```
- RRF implementation:
  ```typescript
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

    // Sort by combined score
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map(({ result, score }) => ({ ...result, similarity: score }));
  }
  ```
- Main function:
  ```typescript
  export async function hybridSearch(
    query: string,
    options: { mode?: 'vector' | 'keyword' | 'hybrid'; limit?: number } = {}
  ): Promise<SearchResult[]> {
    const { mode = 'hybrid', limit = 10 } = options;

    // Embed the query
    const queryEmbedding = await generateEmbedding(query);

    if (mode === 'vector') {
      return vectorSearch(queryEmbedding, limit);
    }
    if (mode === 'keyword') {
      return keywordSearch(query, limit);
    }

    // Hybrid: combine both
    const [vectorResults, keywordResults] = await Promise.all([
      vectorSearch(queryEmbedding, limit * 2),
      keywordSearch(query, limit * 2),
    ]);

    return reciprocalRankFusion(vectorResults, keywordResults).slice(0, limit);
  }
  ```

**What Could Break:**
- ILIKE performance on large datasets — consider adding GIN index later
- Results appearing in both lists — deduplication by chunk ID handles this
- RRF weights may need tuning — start with k=60 (standard)

**Done When:**
- [ ] `hybridSearch(query, options?)` function implemented
- [ ] RRF correctly merges vector and keyword results
- [ ] Deduplication handles chunks appearing in both lists
- [ ] Mode parameter allows switching between vector/keyword/hybrid
- [ ] Hybrid produces better results than pure vector for exact terms
- [ ] Query embedding uses same Transformers.js pipeline

---

### Chunk 3: Search API Endpoint

**Goal:** Create API endpoint that returns both chunk-level and video-level results

**Files:**
- `src/app/api/search/route.ts` — create
- `src/lib/search/aggregate.ts` — create

**Implementation Details:**
- GET `/api/search?q=query&limit=10&mode=hybrid`
- Response format:
  ```typescript
  interface SearchResponse {
    chunks: SearchResult[];      // Raw chunk results with scores
    videos: VideoResult[];       // Aggregated by video
    query: string;               // Echo back query
    mode: 'vector' | 'keyword' | 'hybrid';
    timing: number;              // ms for performance tracking
    hasEmbeddings: boolean;      // Whether any videos have embeddings
  }

  interface VideoResult {
    videoId: number;
    youtubeId: string;
    title: string;
    channel: string;
    thumbnail: string | null;
    score: number;               // Aggregated score
    matchedChunks: number;       // Count of matching chunks
    bestChunk: {                 // Highest scoring chunk
      content: string;
      startTime: number | null;
      similarity: number;
    };
  }
  ```
- Video aggregation function:
  ```typescript
  function aggregateByVideo(chunks: SearchResult[]): VideoResult[] {
    const videoMap = new Map<number, VideoResult>();

    for (const chunk of chunks) {
      const existing = videoMap.get(chunk.videoId);
      if (existing) {
        existing.matchedChunks++;
        // Keep highest scoring chunk
        if (chunk.similarity > existing.bestChunk.similarity) {
          existing.bestChunk = {
            content: chunk.content,
            startTime: chunk.startTime,
            similarity: chunk.similarity,
          };
        }
        // Video score = max chunk score
        existing.score = Math.max(existing.score, chunk.similarity);
      } else {
        videoMap.set(chunk.videoId, {
          videoId: chunk.videoId,
          youtubeId: chunk.youtubeId,
          title: chunk.videoTitle,
          channel: chunk.channel,
          thumbnail: chunk.thumbnail,
          score: chunk.similarity,
          matchedChunks: 1,
          bestChunk: {
            content: chunk.content,
            startTime: chunk.startTime,
            similarity: chunk.similarity,
          },
        });
      }
    }

    return Array.from(videoMap.values())
      .sort((a, b) => b.score - a.score);
  }
  ```
- API route:
  ```typescript
  export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const mode = (searchParams.get('mode') || 'hybrid') as SearchMode;

    const start = performance.now();

    // Check if any embeddings exist
    const embeddingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(chunks)
      .where(sql`${chunks.embedding} IS NOT NULL`);
    const hasEmbeddings = embeddingCount[0]?.count > 0;

    // If no query, return empty results
    if (!query.trim()) {
      return NextResponse.json({
        chunks: [],
        videos: [],
        query: '',
        mode,
        timing: 0,
        hasEmbeddings,
      });
    }

    // Run search
    const chunkResults = await hybridSearch(query, { mode, limit: limit * 3 });
    const videoResults = aggregateByVideo(chunkResults);

    const timing = Math.round(performance.now() - start);

    return NextResponse.json({
      chunks: chunkResults.slice(0, limit),
      videos: videoResults.slice(0, limit),
      query,
      mode,
      timing,
      hasEmbeddings,
    });
  }
  ```
- Add caching header: `Cache-Control: private, max-age=60`

**What Could Break:**
- Query parameter missing — default to empty (return helpful response)
- No embeddings exist — return hasEmbeddings: false for UI guidance
- Slow query — add timing and log if >500ms

**Done When:**
- [ ] GET `/api/search` endpoint working
- [ ] Returns both chunk and video results
- [ ] Video aggregation groups chunks correctly
- [ ] Response includes timing for performance monitoring
- [ ] `hasEmbeddings` flag helps UI show appropriate state
- [ ] Graceful handling of edge cases (no query, no embeddings)
- [ ] Cache headers set appropriately

---

### Chunk 4: UI Integration

**Goal:** Update search UI to show chunk-level results with timestamps

**Files:**
- `src/components/search/SearchResults.tsx` — create
- `src/components/search/ChunkResult.tsx` — create
- `src/components/search/VideoResultGroup.tsx` — create
- `src/hooks/useSearch.ts` — create
- `src/app/page.tsx` — modify (integrate new search)
- `src/components/videos/VideoSearch.tsx` — modify (update to use new hook)

**Implementation Details:**
- useSearch hook:
  ```typescript
  export function useSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<SearchMode>('hybrid');

    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
      if (!debouncedQuery.trim()) {
        setResults(null);
        return;
      }

      const controller = new AbortController();
      setIsLoading(true);
      setError(null);

      fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&mode=${mode}`, {
        signal: controller.signal,
      })
        .then(res => res.json())
        .then(setResults)
        .catch(err => {
          if (err.name !== 'AbortError') {
            setError('Search failed. Please try again.');
          }
        })
        .finally(() => setIsLoading(false));

      return () => controller.abort();
    }, [debouncedQuery, mode]);

    return { query, setQuery, results, isLoading, error, mode, setMode };
  }
  ```
- SearchResults component:
  - Toggle between "By Chunk" and "By Video" views (tabs)
  - Default to "By Video" (grouped, cleaner)
  - Show timing: "Found X results in Yms"
- ChunkResult component:
  - Shows chunk content (truncated to ~200 chars with "show more")
  - Shows video title, channel as link
  - Shows timestamp as clickable badge → `/videos/[id]?t=startTime`
  - Shows similarity score as percentage or visual bar
  - Highlight matching terms (if keyword search)
- VideoResultGroup component:
  - Shows video card with matched chunk count badge
  - Expandable to show individual chunks
  - "Best match" preview from bestChunk
  - Click to expand/collapse chunks
- Empty states:
  - No embeddings: "Generate embeddings to enable semantic search" + link
  - No results: "No results found for '[query]'"
  - Loading: Skeleton cards

**What Could Break:**
- Timestamp link format — verify video detail page accepts `?t=` param
- Large result sets — limit to 10 videos, 30 chunks max
- Mode toggle state — persist in URL params for shareability

**Done When:**
- [ ] useSearch hook manages search state correctly
- [ ] SearchResults shows both chunk and video views with tabs
- [ ] ChunkResult displays content, metadata, timestamp link
- [ ] Similarity score visualized (percentage or bar)
- [ ] Toggle between chunk/video view works
- [ ] Empty state when no embeddings guides user
- [ ] Empty state when no results shows helpful message
- [ ] Timestamp links navigate to correct video position
- [ ] Search feels fast and responsive (<500ms typical)
- [ ] Loading states prevent layout shift

## Notes

- **Drizzle pgvector functions:** `cosineDistance`, `l2Distance`, `innerProduct` from `drizzle-orm`
- **Cosine distance range:** 0 (identical) to 2 (opposite) — convert to similarity
- **Index recommendation:** After ~1000 chunks, add HNSW index:
  ```sql
  CREATE INDEX chunks_embedding_hnsw_idx ON chunks
  USING hnsw (embedding vector_cosine_ops);
  ```
- **RRF constant k=60** is standard, may tune based on results quality
- **Future enhancements:**
  - Filters by channel, date range, video
  - "More like this" from a specific chunk
  - Search history / saved searches
- **MCP server (Cycle 2)** will reuse `hybridSearch()` function directly
