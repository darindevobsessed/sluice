---
name: graph-rag
title: Graph RAG
status: complete
priority: medium
created: 2026-02-05
updated: 2026-02-06
cycle: mcp-intelligence
story_number: 2
chunks_total: 5
chunks_complete: 5
current_chunk: 6
---

# Story: Graph RAG

## Spark

Enhance RAG with relationship awareness. Compare chunks with each other to discover connections — when multiple creators talk about the same concept, when ideas build on each other, when there's disagreement or consensus.

Store relationships as edges between chunk nodes. Query traversal finds related content that pure vector similarity might miss.

> *"You can you can do graph rag. All you're doing is comparing the chunks with each other. That's your graph rag."*

## Dependencies

**Blocked by:** RAG Foundation cycle (complete ✓) — needs chunks and embeddings
**Blocks:** Story 3 (Temporal Graph RAG)

## Acceptance

- [ ] `relationships` table stores chunk-to-chunk edges with similarity scores
- [ ] Relationships auto-computed after video embedding
- [ ] API returns related chunks from other videos
- [ ] Related tab on video detail page shows connections
- [ ] Similarity threshold of 0.75 filters low-quality relationships
- [ ] Performance acceptable for videos with up to 500 chunks
- [ ] Tests cover computation, traversal, and UI

## Chunks

### Chunk 1: Database Schema & Types

**Goal:** Add `relationships` table to store chunk-to-chunk edges with similarity scores.

**Files:**
- `src/lib/db/schema.ts` — modify (add relationships table)
- `src/lib/graph/types.ts` — create

**Implementation Details:**

**Schema addition:**
```typescript
export const relationships = pgTable('relationships', {
  id: serial('id').primaryKey(),
  sourceChunkId: integer('source_chunk_id').references(() => chunks.id).notNull(),
  targetChunkId: integer('target_chunk_id').references(() => chunks.id).notNull(),
  similarity: real('similarity').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index('relationships_source_idx').on(table.sourceChunkId),
  targetIdx: index('relationships_target_idx').on(table.targetChunkId),
  uniqueEdge: unique('unique_edge').on(table.sourceChunkId, table.targetChunkId),
}))
```

**Types:**
```typescript
export interface ChunkRelationship {
  sourceChunkId: number
  targetChunkId: number
  similarity: number
}

export interface RelatedChunk {
  chunkId: number
  content: string
  startTime: number
  endTime: number
  similarity: number
  video: {
    id: number
    title: string
    channel: string
    youtubeId: string
  }
}
```

**What Could Break:**
- Drizzle push migration may fail if relationships table already exists — check first
- Foreign keys require chunks table to exist (it does)

**Done When:**
- [ ] `relationships` table defined in schema
- [ ] Indexes on sourceChunkId, targetChunkId
- [ ] Unique constraint prevents duplicate edges
- [ ] Types exported from `src/lib/graph/types.ts`
- [ ] `npm run db:push` succeeds

---

### Chunk 2: Compute Relationships Function

**Goal:** Implement batch chunk-to-chunk comparison to generate relationship edges.

**Files:**
- `src/lib/graph/compute-relationships.ts` — create
- `src/lib/graph/__tests__/compute-relationships.test.ts` — create
- `src/lib/graph/index.ts` — create (barrel export)

**Implementation Details:**

**Algorithm:**
1. Get all chunks for a video (or all videos if computing globally)
2. For each chunk pair, compute cosine similarity using existing embeddings
3. If similarity > threshold (0.75), create relationship edge
4. Use batch processing (similar to embeddings service) for efficiency
5. Store directed edges (A→B means A relates to B)

**Key function signature:**
```typescript
export async function computeRelationships(
  videoId: number,
  options?: {
    threshold?: number      // Default 0.75
    onProgress?: (processed: number, total: number) => void
  },
  db = database
): Promise<{ created: number, skipped: number }>
```

**Similarity calculation:**
- Reuse vector distance calculation pattern from `vector-search.ts`
- Use SQL for bulk comparison: compare each chunk's embedding with all other chunks' embeddings
- Formula: `1 - (cosine_distance / 2)` to convert distance to similarity

**Batch strategy:**
- Limit to within-video relationships for now (cross-video too expensive at scale)
- Batch insert relationships using Drizzle's `insert().values([])`
- Skip self-relationships (A→A)
- Skip if relationship already exists (upsert or check)

**What Could Break:**
- O(n²) comparison for large videos — limit to 500 chunks per video max
- Embedding vectors must exist before comparison — verify before compute

**Done When:**
- [ ] Function computes similarity between chunk pairs
- [ ] Relationships stored with similarity > 0.75
- [ ] Self-relationships skipped
- [ ] Duplicate relationships prevented (upsert)
- [ ] Progress callback works for monitoring
- [ ] Unit tests cover: normal case, empty video, threshold filtering

---

### Chunk 3: Auto-compute After Embedding

**Goal:** Automatically compute relationships when a video's chunks are embedded.

**Files:**
- `src/lib/embeddings/service.ts` — modify (add relationship computation after embedding)
- `src/app/api/videos/[id]/embed/route.ts` — modify (include relationship stats in response)

**Implementation Details:**

**Modify `embedChunks` function:**
After successfully embedding chunks, call `computeRelationships(videoId)`:
```typescript
// At end of embedChunks, after embedding completes:
const relationshipResult = await computeRelationships(videoId, {
  threshold: 0.75,
  onProgress: onProgress ? (p, t) => onProgress({
    phase: 'relationships',
    processed: p,
    total: t
  }) : undefined
})
```

**Update API response:**
```typescript
return NextResponse.json({
  success: true,
  chunksEmbedded: result.totalStored,
  embeddingTime: embeddingDuration,
  relationshipsCreated: relationshipResult.created,
  relationshipTime: relationshipDuration
})
```

**Progress reporting:**
- Extend progress callback to include phase: `'embedding' | 'relationships'`
- UI can show "Embedding chunks... 45/100" then "Computing relationships... 23/50"

**What Could Break:**
- Relationship computation failure should not fail the entire embedding operation — wrap in try/catch, log error, continue
- Progress callback type changes — update any consumers

**Done When:**
- [ ] Embedding a video auto-computes relationships
- [ ] API response includes relationship count
- [ ] Progress reports both phases
- [ ] Relationship errors don't fail embedding
- [ ] Existing embedding tests still pass

---

### Chunk 4: Graph Traversal & API

**Goal:** Query relationships to find related chunks, expose via API.

**Files:**
- `src/lib/graph/traverse.ts` — create
- `src/lib/db/queries.ts` — modify (add getRelatedChunks function)
- `src/app/api/videos/[id]/related/route.ts` — create
- `src/lib/graph/__tests__/traverse.test.ts` — create
- `src/app/api/videos/[id]/related/__tests__/route.test.ts` — create

**Implementation Details:**

**Traversal function:**
```typescript
export async function getRelatedChunks(
  videoId: number,
  options?: {
    limit?: number        // Default 10
    minSimilarity?: number // Default 0.75
    includeWithinVideo?: boolean // Default false (show OTHER videos only)
  },
  db = database
): Promise<RelatedChunk[]>
```

**Query strategy:**
1. Get all chunk IDs for the source video
2. Find relationships where sourceChunkId is in those IDs
3. Join target chunks with their video metadata
4. Filter out chunks from same video (unless includeWithinVideo)
5. Order by similarity DESC, limit results
6. Return with video context (title, channel, youtubeId)

**API route:**
```typescript
// GET /api/videos/[id]/related?limit=10&minSimilarity=0.75
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const videoId = parseInt(params.id)
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')
  const minSimilarity = parseFloat(searchParams.get('minSimilarity') || '0.75')

  const related = await getRelatedChunks(videoId, { limit, minSimilarity })
  return NextResponse.json({ related })
}
```

**What Could Break:**
- Video ID validation — return 400 for invalid ID
- Empty results — return empty array, not error

**Done When:**
- [ ] `getRelatedChunks` returns related chunks from other videos
- [ ] Results include video metadata
- [ ] Sorted by similarity descending
- [ ] API endpoint works with query params
- [ ] Tests cover: normal case, no relationships, invalid video ID

---

### Chunk 5: Related Tab UI

**Goal:** Add "Related" tab to video detail page showing related content from other videos.

**Files:**
- `src/components/video/RelatedTab.tsx` — create
- `src/components/video/RelatedChunkCard.tsx` — create
- `src/app/videos/[id]/page.tsx` — modify (add Related tab)
- `src/hooks/useRelatedChunks.ts` — create
- `src/components/video/__tests__/RelatedTab.test.tsx` — create

**Implementation Details:**

**Hook:**
```typescript
export function useRelatedChunks(videoId: number) {
  const [related, setRelated] = useState<RelatedChunk[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/videos/${videoId}/related`)
      .then(res => res.json())
      .then(data => setRelated(data.related))
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [videoId])

  return { related, isLoading, error }
}
```

**RelatedChunkCard component:**
- Shows thumbnail, video title, channel name
- Displays chunk content preview (line-clamp-2)
- Shows similarity badge (e.g., "87% similar")
- Links to source video

**Tab integration:**
- Add third tab after Transcript | Insights: **Related**
- Tab shows loading skeleton while fetching
- Empty state: "No related content found yet. Add more videos to discover connections."
- Error state: "Couldn't load related content. Try refreshing."

**Animation (locked vibe: "Smooth, elegant motion"):**
- Tab switch: fade transition (200ms, easing token)
- Card appear: stagger-in animation (50ms delay between cards)
- Loading skeleton: shimmer animation (left-to-right gradient, 1.5s loop)
- Use Tailwind `animate-` classes or CSS transitions (no framer-motion needed)

**What Could Break:**
- Tab state management — ensure only one tab active at a time
- Loading state while switching tabs — don't flash content

**Done When:**
- [ ] Related tab appears on video detail page
- [ ] Shows related chunks from other videos
- [ ] Each card links to source video
- [ ] Shows similarity percentage
- [ ] Loading skeleton while fetching
- [ ] Empty state when no relationships
- [ ] Tests cover: loading, loaded, empty states

## Notes

- Native Postgres with pgvector (Graphiti/graph-e-d deferred — too complex for current scope)
- Similarity-only relationships (type classification like builds_on/contradicts deferred)
- Within-video relationships only for now (cross-video is O(n²) expensive)
- Threshold of 0.75 balances quality vs quantity
- Story 3 (Temporal Graph RAG) will build on this relationship infrastructure
