# Search Library

Provides vector, keyword, and hybrid search capabilities for the knowledge bank.

## Functions

### `hybridSearch(query, options?, db?)`

Performs hybrid search combining vector similarity and keyword matching using Reciprocal Rank Fusion (RRF).

**Parameters:**
- `query: string` - Text query to search for
- `options?: { mode?: 'vector' | 'keyword' | 'hybrid', limit?: number }` - Search options
  - `mode` - Search strategy (default: 'hybrid')
  - `limit` - Maximum results (default: 10)
- `db?: NodePgDatabase` - Database instance (optional)

**Returns:** `Promise<SearchResult[]>` - Array of results ordered by relevance

**Modes:**
- `'vector'` - Pure semantic similarity using embeddings
- `'keyword'` - Pure keyword matching (case-insensitive)
- `'hybrid'` - Combines both using RRF (recommended)

**Example:**
```typescript
import { hybridSearch } from '@/lib/search';

// Hybrid search (recommended)
const results = await hybridSearch('TypeScript best practices', {
  mode: 'hybrid',
  limit: 10
});

// Keyword-only search (exact terms)
const exactResults = await hybridSearch('async/await', {
  mode: 'keyword'
});

// Vector-only search (semantic)
const semanticResults = await hybridSearch('error handling patterns', {
  mode: 'vector'
});
```

### `vectorSearch(embedding, limit?, threshold?, db?)`

Performs vector similarity search on chunk embeddings.

**Parameters:**
- `embedding: number[]` - Query embedding (384 dimensions)
- `limit?: number` - Maximum results (default: 10)
- `threshold?: number` - Minimum similarity score 0-1 (default: 0.3)
- `db?: NodePgDatabase` - Database instance (optional)

**Returns:** `Promise<SearchResult[]>` - Array of results ordered by similarity

### `searchByQuery(query, limit?, threshold?, db?)`

Convenience function that generates embedding and performs vector search.

**Parameters:**
- `query: string` - Text query
- `limit?: number` - Maximum results (default: 10)
- `threshold?: number` - Minimum similarity score 0-1 (default: 0.3)
- `db?: NodePgDatabase` - Database instance (optional)

**Returns:** `Promise<SearchResult[]>` - Array of results ordered by similarity

## Types

### `SearchResult`

```typescript
interface SearchResult {
  // Chunk data
  chunkId: number;
  content: string;
  startTime: number | null;
  endTime: number | null;
  similarity: number; // 0-1 range, higher is more similar

  // Video metadata
  videoId: number;
  videoTitle: string;
  channel: string;
  youtubeId: string;
  thumbnail: string | null;
}
```

## When to use each mode

### Hybrid (default)
Best for most use cases. Combines semantic understanding with exact term matching.

**Good for:**
- General queries
- Natural language questions
- Mixed semantic + exact term requirements

**Example:** "How to handle errors in TypeScript?"

### Keyword
Best when you need exact term matching, especially for technical terms, code, or acronyms.

**Good for:**
- Technical terms (API names, libraries)
- Acronyms (RRF, TDD, RPC)
- Code snippets
- Exact phrases

**Example:** "useEffect" or "React.memo"

### Vector
Best for semantic/conceptual searches where exact terms don't matter.

**Good for:**
- Conceptual queries
- Finding similar ideas expressed differently
- When keyword matching might be too restrictive

**Example:** "how to clean up side effects" (might find useEffect without mentioning it)

## Implementation Details

### Reciprocal Rank Fusion (RRF)

Hybrid mode uses RRF to combine vector and keyword results:

```
score(chunk) = sum(1 / (k + rank + 1)) for each list the chunk appears in
```

Where:
- `k = 60` (RRF constant, balances contribution from each method)
- `rank` is the 0-based position in the result list

Results appearing in both lists get higher scores because they receive contributions from both.

### Performance

- Keyword search: Fast (database LIKE query)
- Vector search: Fast (pgvector cosine distance index)
- Hybrid search: Slightly slower (runs both in parallel)

Hybrid mode fetches `limit * 2` results from each method before merging to ensure diverse final results.
