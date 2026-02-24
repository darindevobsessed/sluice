# Search Guide

How to search your Sluice knowledge bank effectively. This guide covers search modes, API parameters, scoring mechanics, and tips for getting the best results.

Source: [`src/lib/search/hybrid-search.ts`](../src/lib/search/hybrid-search.ts) and [`src/app/api/search/route.ts`](../src/app/api/search/route.ts)

---

## Search Modes

Sluice supports three search modes. **Hybrid** (the default) combines the strengths of both vector and keyword search.

| Mode | How It Works | Best For | Score Type |
|------|-------------|----------|------------|
| **Hybrid** (default) | Vector + keyword results fused with Reciprocal Rank Fusion (k=60) | General searching — almost always the right choice | RRF score (0.01-0.03 typical) |
| **Vector** | Cosine similarity on 384-dim embeddings via pgvector `<=>` operator | Semantic/conceptual queries ("how to make code faster") | Cosine similarity (0.0-1.0) |
| **Keyword** | PostgreSQL case-insensitive `ILIKE` matching on chunk content | Exact terms, names, acronyms ("HNSW", "pgvector", "RSC") | Binary (1.0 for all matches) |

### When to Use Each Mode

**Hybrid** handles most queries well because it captures both semantic meaning and exact terms. A search for "React performance optimization" finds:
- Chunks about "making React apps faster" (vector match — semantic similarity)
- Chunks that literally contain "React performance" (keyword match — exact terms)
- Results appearing in both lists score higher (RRF fusion)

**Vector-only** is useful when you're searching for concepts rather than specific terms:
- "How do experienced developers approach debugging?" — finds relevant content even if no chunk contains those exact words
- "Best practices for code review" — catches chunks about "peer review process" and "pull request feedback"

**Keyword-only** is useful for finding specific names, versions, or proper nouns:
- "pgvector 0.7.0" — exact version reference
- "bun 1.2" — specific technology version
- "HNSW" — acronym that embedding models may not handle well

---

## API Parameters

Source: [`src/app/api/search/route.ts`](../src/app/api/search/route.ts)

### Request

```
GET /api/search?q=query&mode=hybrid&limit=10&temporalDecay=false&halfLifeDays=365&focusAreaId=1
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | `string` | (required) | Search query text. Returns empty results if blank. |
| `mode` | `string` | `hybrid` | Search mode: `vector`, `keyword`, or `hybrid`. Invalid values fall back to `hybrid`. |
| `limit` | `integer` | `10` | Max results to return (1-50). In hybrid mode, `limit * 3` chunks are fetched internally for better video aggregation. |
| `temporalDecay` | `string` | `false` | Set to `"true"` to weight results by publication date (recent = higher score). |
| `halfLifeDays` | `integer` | `365` | Half-life for temporal decay in days. After this many days, a result's score drops to 50%. |
| `focusAreaId` | `integer` | — | Filter results to a specific focus area (user-defined category). |

### Response

Source: `SearchResponse` interface in [`src/app/api/search/route.ts:17-24`](../src/app/api/search/route.ts)

```typescript
interface SearchResponse {
  chunks: SearchResult[]   // Raw chunk results with similarity scores
  videos: VideoResult[]    // Aggregated by video (what the UI shows)
  query: string            // Echo back
  mode: SearchMode         // "vector" | "keyword" | "hybrid"
  timing: number           // Milliseconds
  hasEmbeddings: boolean   // false if no videos have been embedded yet
}
```

Each video result (source: `VideoResult` in [`src/lib/search/aggregate.ts`](../src/lib/search/aggregate.ts)):

```typescript
interface VideoResult {
  videoId: number
  youtubeId: string | null
  title: string
  channel: string | null
  thumbnail: string | null
  publishedAt?: Date | null
  score: number           // Max chunk score for this video
  matchedChunks: number   // Count of matching chunks
  bestChunk: {
    content: string       // Text of the highest-scoring chunk
    startTime: number | null  // Seconds into video (for timestamp linking)
    similarity: number    // Score of this specific chunk
  }
}
```

### Example Response

```json
{
  "chunks": [...],
  "videos": [
    {
      "videoId": 42,
      "youtubeId": "abc123",
      "title": "PostgreSQL Performance Tips",
      "channel": "Hussein Nasser",
      "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      "publishedAt": "2025-11-15T00:00:00.000Z",
      "score": 0.032,
      "matchedChunks": 3,
      "bestChunk": {
        "content": "The most relevant transcript excerpt from the highest-scoring chunk...",
        "startTime": 245,
        "similarity": 0.032
      }
    }
  ],
  "query": "database indexing strategies",
  "mode": "hybrid",
  "timing": 245,
  "hasEmbeddings": true
}
```

**Caching:** Responses include `Cache-Control: private, max-age=60` — results are cached for 60 seconds on the client.

---

## Search Tips

### Write Natural Queries

Hybrid search understands natural language. Instead of keyword-style queries, describe what you're looking for:

| Instead of | Try |
|-----------|-----|
| `react hooks` | `how to use React hooks effectively` |
| `database index` | `when should I add a database index` |
| `auth jwt` | `JWT vs session-based authentication tradeoffs` |
| `css grid` | `how to build responsive layouts with CSS grid` |

Natural language queries activate the vector search component, which catches semantic matches. Short keyword queries still work (the keyword component catches them), but you'll get better-ranked results with descriptive queries.

### Use Creator Filtering via MCP

If you're looking for a specific creator's perspective, use the MCP `search_rag` tool with the `creator` parameter:

```
search_rag("state management", creator: "Jack Herrington")
```

This performs the full hybrid search first, then filters to only that creator's content. The `creator` filter is a case-insensitive partial match — "Jack" matches "Jack Herrington".

> **Note:** Creator filtering is available via MCP (`search_rag` tool) but not via the UI search bar. In the UI, use Focus Areas to filter by topic.

### Enable Temporal Decay for Evolving Topics

For topics where freshness matters (framework versions, best practices that change), enable temporal decay:

```
GET /api/search?q=Next.js+deployment&temporalDecay=true&halfLifeDays=180
```

With a 180-day half-life:
- Content from today: 100% of original score
- Content from 6 months ago: 50% of original score
- Content from 1 year ago: 25% of original score
- Content from 2 years ago: 6.25% of original score

Older content still appears — it just ranks lower. This is useful for "what's the current best practice for X?" style queries.

### Combine Focus Areas with Search

Focus areas are user-defined categories (e.g., "TypeScript", "DevOps"). Searching within a focus area narrows results to videos you've tagged:

```
GET /api/search?q=testing+patterns&focusAreaId=3
```

This is useful when your knowledge bank spans many topics and you want results from a specific domain. Focus area filtering happens after search — the search still runs across all content, but only matching videos are returned.

### Check hasEmbeddings

If `hasEmbeddings` returns `false` in the response, your videos haven't been embedded yet. Possible reasons:

1. **First run cold start** — The ONNX model takes 10-15 seconds to download (~23MB) before embeddings can generate
2. **Job queue backlog** — Embedding jobs may be queued but not yet processed
3. **No transcript** — Videos without transcripts can't be embedded

The UI shows a "No embeddings yet" message when this happens.

---

## How Scoring Works

### Hybrid Mode Scores (RRF)

Source: `reciprocalRankFusion()` in [`src/lib/search/hybrid-search.ts:65-98`](../src/lib/search/hybrid-search.ts)

In hybrid mode, scores are **Reciprocal Rank Fusion (RRF)** scores. The formula:

```
rrfScore = 1 / (k + rank + 1)
```

Where:
- `k = 60` (constant balancing the two methods)
- `rank` is the 0-indexed position in each result list

For a result appearing at rank 0 in one list: `1/(60+0+1) = 0.0164`
For a result appearing at rank 0 in both lists: `0.0164 + 0.0164 = 0.0328`

**What the scores mean:**

| Score Range | Interpretation |
|-------------|---------------|
| **0.03+** | Strong match — appears near top in both vector and keyword results |
| **0.02-0.03** | Good match — high in one method, present in the other |
| **0.01-0.02** | Moderate match — appears in one method only |
| **< 0.01** | Weak match — low rank in one method |

RRF scores are intentionally small numbers. A score of 0.032 is excellent. Don't compare them to cosine similarity values.

### Vector Mode Scores

Source: `vectorSearch()` in [`src/lib/search/vector-search.ts`](../src/lib/search/vector-search.ts)

In vector-only mode, scores are cosine similarity values converted from pgvector's cosine distance:

```
similarity = 1 - (cosineDistance / 2)
```

This gives a range of 0.0 to 1.0:

| Score Range | Interpretation |
|-------------|---------------|
| **0.8+** | Very high similarity — nearly identical meaning |
| **0.6-0.8** | Strong similarity — same topic, related concepts |
| **0.4-0.6** | Moderate similarity — loosely related |
| **< 0.3** | Filtered out by minimum threshold |

The minimum threshold is 0.3 (hardcoded in `hybridSearch()` at line 167: `vectorSearch(embeddingArray, limit, 0.3, db)`). Results below this threshold are not returned.

### Keyword Mode Scores

All keyword matches get a score of 1.0 (binary match/no-match via SQL `1.0` literal). Ordering within keyword results is determined by database ordering (not ranked by relevance).

Keyword mode is useful when you know the exact term you're looking for. For ranked results, prefer hybrid mode.

---

## Internals: How Hybrid Search Works Step by Step

For developers who want to understand (or modify) the search pipeline:

1. **Query arrives** at `GET /api/search` with parameters parsed from query string
2. **Mode selection** — if `mode=hybrid` (default):
   - Generate query embedding via `generateEmbedding(query)` (~100ms, model cached in memory)
   - Run `vectorSearch()` and `keywordSearch()` in parallel via `Promise.all()`
   - Each method fetches `limit * 2` results to provide enough candidates for fusion
3. **RRF fusion** — `reciprocalRankFusion(vectorResults, keywordResults, k=60)` merges the two lists
4. **Temporal decay** — if `temporalDecay=true`, apply `calculateTemporalDecay()` to adjust scores
5. **Focus area filter** — if `focusAreaId` provided, filter to videos in that focus area
6. **Video aggregation** — `aggregateByVideo()` groups chunks by video, picks best chunk per video
7. **Response** — return `{ chunks, videos, query, mode, timing, hasEmbeddings }`

The entire pipeline typically completes in 100-300ms (warm cache) or 10-15 seconds (cold start with model download).

---

## Further Reading

- **[Core Concepts](core-concepts.md)** — Deep dive into how hybrid search, RRF, and Graph RAG work
- **[MCP Tools Reference](mcp-tools.md)** — Using `search_rag` from Claude Code with creator filtering
- **[Getting Started](getting-started.md)** — Setup if you haven't installed Sluice yet
