---
name: cross-video-relationships
title: Fix cross-video relationship computation for Related tab
status: complete
cycle: hotfix
story_number: 4
created: 2026-02-14
updated: 2026-02-15
priority: high
chunks_total: 2
chunks_complete: 2
current_chunk: 3
---

# Story: Fix cross-video relationship computation for Related tab

## Spark
`computeRelationships()` only compares chunks within the same video — all 189 existing relationships are same-video. The Related tab on the video detail page filters out same-video results by default (`includeWithinVideo: false`), so it's always empty. Fix: update `computeRelationships` to compare a video's chunks against all other videos' chunks using pgvector's in-DB cosine similarity, and run a one-time backfill for existing data. No schema changes needed.

## Delivery
Chunk 1 rewrites `computeRelationships` to use pgvector's `<=>` SQL operator for cross-video comparison, inserting bidirectional rows (A→B and B→A) so `traverse.ts` works from either video's perspective without modification. Chunk 2 adds a backfill endpoint that clears and recomputes all relationships, populating the Related tab with cross-video content for the first time.

## Scope
**Included:**
- Rewrite `computeRelationships()` to use pgvector SQL cosine distance for cross-video chunk comparison
- Insert bidirectional relationships so traverse.ts finds results from either direction
- Keep same-video relationships too (both are useful)
- Add a backfill API endpoint to recompute all relationships
- Verify Related tab shows cross-video content after backfill

**Excluded:**
- Schema changes (relationships table structure is fine)
- UI changes to RelatedTab component (already works, just needs data)
- Changes to the traversal/query logic in `traverse.ts` (already correct — bidirectional inserts solve the direction issue)

## Hardest Constraint
`traverse.ts` only queries `sourceChunkId` direction. Without bidirectional inserts, `getRelatedChunks(videoB)` wouldn't find relationships created by `computeRelationships(videoA)`. Must insert both A→B and B→A for every cross-video match.

## Decisions
### Similarity computation
**Type:** component
**Choice:** inline
Use pgvector's `<=>` cosine distance operator in SQL rather than JS in-memory pairwise comparison. Pattern: `1 - (c1.embedding <=> c2.embedding)` converts cosine distance (0-2) to similarity (0-1). Reference: `src/lib/search/vector-search.ts:39`.

### Relationship direction
**Type:** component
**Choice:** inline
Insert bidirectional rows (both A→B and B→A) so traverse.ts works without modification. The unique constraint `(source_chunk_id, target_chunk_id)` is directional, so both rows are distinct. `onConflictDoNothing` handles re-runs.

## Chunk 1: Rewrite computeRelationships for cross-video SQL comparison

**Goal:** Replace JS in-memory pairwise comparison with pgvector `<=>` SQL operator. For a given videoId, compare its chunks against ALL other videos' chunks. Insert bidirectional rows so `traverse.ts` works from either side.

**Files:**
- Modify: `src/lib/graph/compute-relationships.ts`
- Modify: `src/lib/graph/__tests__/compute-relationships.test.ts`

**Implementation Details:**

1. **Test first** — Add cross-video test cases to `compute-relationships.test.ts`. Create two test videos with embedded chunks, call `computeRelationships(videoA)`, verify relationships exist where `sourceChunkId` is from videoA AND where `sourceChunkId` is from videoB (bidirectional). Use the real DB test pattern already in the file (imports from `src/lib/db/__tests__/setup.ts`).

2. **Rewrite `computeRelationships`** — Replace the JS pairwise loop (lines 36-89) with a single SQL query using pgvector:
   ```sql
   SELECT c1.id AS source_id, c2.id AS target_id,
          1 - (c1.embedding <=> c2.embedding) AS similarity
   FROM chunks c1
   CROSS JOIN chunks c2
   WHERE c1.video_id = $videoId
     AND c2.id != c1.id
     AND c1.embedding IS NOT NULL
     AND c2.embedding IS NOT NULL
     AND 1 - (c1.embedding <=> c2.embedding) > $threshold
   ```
   This compares the video's chunks against ALL chunks (same-video + cross-video). Pattern ref: `src/lib/search/vector-search.ts:39`.

3. **Insert bidirectional** — For each `(sourceId, targetId, similarity)`, insert BOTH `(sourceId, targetId)` AND `(targetId, sourceId)`. Use `onConflictDoNothing()`.

4. **Preserve function signature** — Keep `computeRelationships(videoId, options?, db?)` so `embedChunks()` call site (`src/lib/embeddings/service.ts:87`) doesn't change.

5. **Keep `cosineSimilarity` JS helper** — It's exported and may be used elsewhere.

**What Could Break:**
- Bidirectional inserts double the row count — fine at 812 chunks
- Existing tests assume same-video only — update assertions
- Must preserve the `onProgress` callback interface

**Done When:**
- [ ] Cross-video test: `computeRelationships(videoA)` creates relationships to videoB's chunks
- [ ] Bidirectional test: `getRelatedChunks(videoB)` also finds relationships after `computeRelationships(videoA)`
- [ ] All existing tests pass (with updated assertions)
- [ ] Same-video relationships still created

## Chunk 2: Backfill endpoint and verification

**Goal:** Create API endpoint to clear and recompute all relationships. Verify Related tab works.

**Files:**
- Create: `src/app/api/graph/backfill/route.ts`
- Create: `src/app/api/graph/backfill/__tests__/route.test.ts`

**Implementation Details:**

1. **POST `/api/graph/backfill`** — API route pattern from `src/app/api/videos/[id]/related/route.ts`:
   - DELETE all existing relationships
   - Get all distinct video IDs with embedded chunks
   - Call `computeRelationships(videoId)` for each
   - Return `{ videosProcessed, relationshipsCreated }`

2. **Optimization** — Bidirectional inserts from chunk 1 mean later videos' calls will `onConflictDoNothing` for already-inserted reverse pairs. No duplicates.

3. **Test** — Mock test verifying the endpoint clears relationships, processes videos, returns stats.

**What Could Break:**
- Long-running request for 53 videos — acceptable for one-time backfill
- Race with per-video computeRelationships during embedding — `onConflictDoNothing` handles this

**Done When:**
- [ ] POST `/api/graph/backfill` returns success with stats
- [ ] After backfill, `/api/videos/{id}/related` returns non-empty results for a video with cross-video matches
- [ ] All tests pass
