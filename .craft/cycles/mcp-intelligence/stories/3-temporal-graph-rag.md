---
name: temporal-graph-rag
title: Temporal Graph RAG
status: complete
priority: medium
created: 2026-02-05
updated: 2026-02-06
cycle: mcp-intelligence
story_number: 3
chunks_total: 5
chunks_complete: 5
current_chunk: 6
---

# Story: Temporal Graph RAG

## Spark

Add time-awareness to prevent outdated information from dominating results. When someone asks about "Cursor", don't return year-old information when the tool has changed significantly.

Detect version mentions, release dates, and freshness signals. Apply temporal decay to search scoring so newer content ranks higher.

> *"So if you say, hey. Tell me about cursor. It'll say, oh, I found 20 cursor things. And the one that's most relevant to your query is one from a year ago. It's gonna give you outdated cursor information."*
> *"Once you add a temporal graph rag, it will say, oh, he talked about this version of cursor. A new one came out. This one is outdated. Based off of a temporal timeline."*

## Dependencies

**Blocked by:** Story 2 (Graph RAG) — both modify `embeddings/service.ts`
**Blocks:** None

## Acceptance

- [ ] `publishedAt` field on videos table stores actual video publish date
- [ ] Temporal metadata extracted from chunk content (version mentions, dates)
- [ ] Search scoring applies temporal decay (older = lower relevance)
- [ ] Decay half-life configurable (default 365 days)
- [ ] API supports `temporalDecay` query parameter
- [ ] Freshness badge shows on search results (color-coded by age)
- [ ] Extraction errors don't break embedding flow
- [ ] Tests cover extraction, decay math, and UI

## Chunks

### Chunk 1: Add publishedAt to Videos Schema

**Goal:** Add `publishedAt` field to videos table and fetch publish date when adding videos.

**Files:**
- `src/lib/db/schema.ts` — modify (add publishedAt field)
- `src/lib/youtube/metadata.ts` — modify (fetch publishedAt from YouTube)
- `src/app/api/videos/route.ts` — modify (store publishedAt when creating video)

**Implementation Details:**

**Schema change:**
```typescript
export const videos = pgTable('videos', {
  // ... existing fields
  publishedAt: timestamp('published_at'), // nullable for existing videos
  // ...
})
```

**Fetch from YouTube:**
YouTube oEmbed doesn't include publish date. Options:
- Use YouTube Data API (requires API key)
- Parse from page HTML (fragile)
- Use createdAt as fallback if unavailable

**Migration strategy:**
- Add field as nullable
- Existing videos get NULL (can backfill later)
- New videos get publishedAt if available

**What Could Break:**
- YouTube API quota if using Data API
- Need to handle videos without publish date gracefully

**Done When:**
- [ ] `publishedAt` column exists in videos table
- [ ] New videos attempt to fetch publish date
- [ ] Existing videos work with NULL publishedAt
- [ ] `npm run db:push` succeeds

---

### Chunk 2: Temporal Metadata Schema & Types

**Goal:** Create table for chunk-level temporal metadata (version mentions, release dates extracted from content).

**Files:**
- `src/lib/db/schema.ts` — modify (add temporal_metadata table)
- `src/lib/temporal/types.ts` — create
- `src/lib/temporal/index.ts` — create (barrel export)

**Implementation Details:**

**Schema:**
```typescript
export const temporalMetadata = pgTable('temporal_metadata', {
  id: serial('id').primaryKey(),
  chunkId: integer('chunk_id')
    .notNull()
    .references(() => chunks.id, { onDelete: 'cascade' }),
  versionMention: text('version_mention'), // e.g., "v2.0", "React 18"
  releaseDateMention: text('release_date_mention'), // e.g., "released in 2024"
  confidence: real('confidence').notNull(), // 0-1 confidence score
  extractedAt: timestamp('extracted_at').defaultNow().notNull(),
}, (table) => ({
  chunkIdx: index('temporal_chunk_idx').on(table.chunkId),
}))
```

**Types:**
```typescript
export interface TemporalMetadata {
  chunkId: number
  versionMention: string | null
  releaseDateMention: string | null
  confidence: number
}

export interface TemporalExtraction {
  versions: string[]
  dates: string[]
  confidence: number
}
```

**What Could Break:**
- Foreign key to chunks requires chunks table to exist (it does)

**Done When:**
- [ ] `temporal_metadata` table defined in schema
- [ ] Index on chunkId for query performance
- [ ] Types exported from `src/lib/temporal/types.ts`
- [ ] `npm run db:push` succeeds

---

### Chunk 3: Temporal Extraction Function

**Goal:** Regex-based extraction of version numbers and release date mentions from chunk text.

**Files:**
- `src/lib/temporal/extract.ts` — create
- `src/lib/temporal/__tests__/extract.test.ts` — create

**Implementation Details:**

**Version extraction patterns:**
```typescript
const VERSION_PATTERNS = [
  /v?(\d+)\.(\d+)(?:\.(\d+))?/gi,        // v2.0, 2.0.1
  /(version|ver\.?)\s*(\d+(?:\.\d+)*)/gi, // version 3.2
  /(\w+)\s+(\d+(?:\.\d+)*)/gi,            // React 18, Node 20
]
```

**Date extraction patterns:**
```typescript
const DATE_PATTERNS = [
  /released?\s+(?:in\s+)?(\d{4})/gi,      // released in 2024
  /(january|february|...)\s+(\d{4})/gi,   // January 2024
  /(\d{4})\s+(?:release|update|version)/gi // 2024 release
]
```

**Function signature:**
```typescript
export function extractTemporalMetadata(content: string): TemporalExtraction {
  const versions = extractVersions(content)
  const dates = extractDates(content)
  const confidence = calculateConfidence(versions, dates)
  return { versions, dates, confidence }
}
```

**Confidence scoring:**
- 1.0: Multiple version + date mentions with context
- 0.7: Single clear version mention
- 0.4: Ambiguous mentions
- 0.0: No temporal signals found

**What Could Break:**
- False positives ("I give this 10/10" → looks like version)
- Need context filtering to reduce noise

**Done When:**
- [ ] Extracts version numbers from text
- [ ] Extracts date mentions from text
- [ ] Returns confidence score
- [ ] Tests cover: clear versions, dates, ambiguous cases, no matches

---

### Chunk 4: Temporal Decay & Search Integration

**Goal:** Implement decay function and integrate into hybrid search scoring.

**Files:**
- `src/lib/temporal/decay.ts` — create
- `src/lib/search/hybrid-search.ts` — modify (add temporal decay option)
- `src/app/api/search/route.ts` — modify (add temporal query param)
- `src/lib/temporal/__tests__/decay.test.ts` — create

**Implementation Details:**

**Decay function:**
```typescript
// Exponential decay: score * e^(-lambda * age_in_days)
// Half-life of 365 days: lambda ≈ 0.0019
export function calculateTemporalDecay(
  publishedAt: Date | null,
  halfLifeDays: number = 365
): number {
  if (!publishedAt) return 1.0 // No decay if unknown
  const ageInDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
  const lambda = Math.LN2 / halfLifeDays
  return Math.exp(-lambda * ageInDays)
}
```

**Decay curve with 365-day half-life:**
- 0 days old: 1.0
- 6 months: 0.71
- 1 year: 0.50
- 2 years: 0.25

**Hybrid search integration:**
```typescript
export async function hybridSearch(
  query: string,
  options?: {
    mode?: 'vector' | 'keyword' | 'hybrid'
    limit?: number
    temporalDecay?: boolean  // NEW
    halfLifeDays?: number    // NEW
  },
  db = database
): Promise<SearchResult[]>
```

When `temporalDecay: true`:
1. Join with videos table to get publishedAt
2. Multiply similarity by decay factor
3. Re-sort by adjusted score

**API change:**
```
GET /api/search?q=cursor&temporalDecay=true&halfLifeDays=180
```

**What Could Break:**
- Performance impact of joining videos table — add index if needed
- Existing search tests must still pass with `temporalDecay: false`

**Done When:**
- [ ] Decay function calculates correct scores
- [ ] Hybrid search accepts temporalDecay option
- [ ] Search API exposes temporalDecay parameter
- [ ] Default behavior unchanged (temporalDecay: false)
- [ ] Tests cover: decay math, search integration, API params

---

### Chunk 5: Auto-extract & Freshness Badge UI

**Goal:** Extract temporal metadata after embedding, show freshness badge on search results.

**Files:**
- `src/lib/temporal/service.ts` — create (batch extraction service)
- `src/lib/embeddings/service.ts` — modify (call temporal extraction after embedding)
- `src/components/search/FreshnessBadge.tsx` — create
- `src/components/search/VideoResultGroup.tsx` — modify (add freshness badge)
- `src/lib/temporal/__tests__/service.test.ts` — create
- `src/components/search/__tests__/FreshnessBadge.test.tsx` — create

**Implementation Details:**

**Service function:**
```typescript
export async function extractTemporalForVideo(
  videoId: number,
  options?: {
    onProgress?: (processed: number, total: number) => void
  },
  db = database
): Promise<{ extracted: number, skipped: number }>
```

**Integration with embedding:**
```typescript
// At end of embedChunks, after embedding + relationships:
const temporalResult = await extractTemporalForVideo(videoId, {
  onProgress: ...
})
```

**FreshnessBadge component:**
```tsx
interface FreshnessBadgeProps {
  publishedAt: Date | null
  className?: string
}

export function FreshnessBadge({ publishedAt, className }: FreshnessBadgeProps) {
  if (!publishedAt) return null

  const ageInDays = Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24))

  if (ageInDays < 90) {
    return <Badge variant="success" className={className}>Fresh</Badge>
  } else if (ageInDays < 365) {
    return <Badge variant="warning" className={className}>{Math.floor(ageInDays / 30)}mo</Badge>
  } else {
    return <Badge variant="secondary" className={className}>{Math.floor(ageInDays / 365)}y old</Badge>
  }
}
```

**Color coding:**
- Green "Fresh": < 3 months
- Yellow "Xmo": 3-12 months
- Gray "Xy old": > 12 months

**Animation (locked vibe: "Smooth, elegant motion"):**
- Badge appear: fade-in (150ms fast transition)
- Search results: stagger-in badges with cards (same timing as cards)
- No hover animation on badge (keep subtle)

**What Could Break:**
- Temporal extraction failure shouldn't fail embedding
- Badge needs publishedAt in search results — verify API returns it

**Done When:**
- [ ] Temporal metadata extracted after embedding
- [ ] Freshness badge shows on search results
- [ ] Color coding reflects content age
- [ ] Extraction errors don't break embedding flow
- [ ] Tests cover: service, badge rendering

## Notes

- Native Postgres approach (Graphiti/graph-e-d deferred — too complex for current scope)
- Temporal decay only — supersedes detection deferred to future story
- Regex extraction ~70% accurate — acceptable for MVP
- Uses `publishedAt` (video publish date), not `createdAt` (when added to DB)
- Story 2 (Graph RAG) must be implemented first to avoid merge conflicts
