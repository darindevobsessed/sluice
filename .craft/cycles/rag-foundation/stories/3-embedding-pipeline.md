---
name: embedding-pipeline
title: Embedding Pipeline
status: active
priority: high
created: 2026-02-05
updated: 2026-02-06
cycle: rag-foundation
story_number: 3
chunks_total: 4
chunks_complete: 1
---

# Story: Embedding Pipeline

## Spark

Set up Transformers.js (@huggingface/transformers) for local embedding generation — free, no API costs, runs on your machine. Convert transcript text into vector embeddings that capture semantic meaning.

Design a smart chunking strategy: break transcripts at semantic boundaries (topic shifts, ~500 tokens per chunk with overlap). Preserve timestamp metadata on each chunk for future temporal queries (Cycle 2).

Store embeddings in Postgres using PG Vector's vector type (384 dimensions for all-MiniLM-L6-v2).

> *"Instead of using OpenAI's embedding API, which means for every single transcript, you're gonna have to pay OpenAI to do the embeddings. You can use this really cool one called fast embed. Fast embed will run locally on your server and will create those embeddings for you."*

**Note:** We chose Transformers.js over FastEmbed because:
- FastEmbed-js repository was archived (Jan 2026)
- Transformers.js is backed by Hugging Face with active maintenance
- Better Vercel deployment compatibility with documented workarounds

## Dependencies

**Blocked by:** Story 1 (Database Migration) — needs PG Vector for storage
**Blocks:** Story 4 (RAG Search)

## Acceptance

- [ ] Transformers.js installed and configured with singleton pattern
- [ ] all-MiniLM-L6-v2 model generates 384-dimensional embeddings
- [ ] Transcripts are chunked at ~500 tokens with 100-char overlap
- [ ] Each chunk preserves start/end timestamps from transcript segments
- [ ] Embeddings stored in `chunks` table with pgvector
- [ ] Progress callbacks work during embedding generation
- [ ] API route generates embeddings for a video on demand
- [ ] UI shows embedding progress for long transcripts
- [ ] Batch processing handles 100+ chunks efficiently
- [ ] Re-embedding triggered when transcript updates

## Chunks

### Chunk 1: Transformers.js Setup with Singleton Pattern

**Goal:** Install and configure Transformers.js with proper singleton pattern for reuse across requests

**Files:**
- `src/lib/embeddings/pipeline.ts` — create
- `src/lib/embeddings/index.ts` — create
- `next.config.ts` — modify (add experimental config)
- `package.json` — modify (add dependency)

**Implementation Details:**
- Install `@huggingface/transformers` via npm (not pnpm - compatibility issues reported)
- Create singleton class that preserves pipeline between requests
- Handle dev vs production differently (preserve across hot reloads in dev)
- Use `Xenova/all-MiniLM-L6-v2` model (384 dimensions)
- Configure cache directory for Vercel compatibility: `env.cacheDir = '/tmp/.cache'`
- Add next.config.ts experimental settings:
  ```typescript
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
    outputFileTracingExcludes: {
      '/': [
        'node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/!(libonnxruntime.so.1|onnxruntime_binding.node)',
      ],
    },
  }
  ```

**What Could Break:**
- onnxruntime-node platform compatibility — test on your Mac first
- Memory usage if model doesn't load correctly
- Hot reload issues in dev without proper singleton handling

**Done When:**
- [ ] `@huggingface/transformers` installed
- [ ] Singleton pipeline class created with getInstance()
- [ ] next.config.ts updated with experimental settings
- [ ] Can call `generateEmbedding("test")` and get 384-dimension Float32 array
- [ ] Works across multiple requests without re-downloading model

---

### Chunk 2: Smart Chunking with Timestamp Preservation

**Goal:** Create chunking utility that splits transcripts at semantic boundaries while preserving timestamps

**Files:**
- `src/lib/embeddings/chunker.ts` — create
- `src/lib/embeddings/types.ts` — create

**Implementation Details:**
- Define chunk target size: ~2000 characters (~500 tokens)
- Define overlap: 100 characters for context continuity
- Input: Array of transcript segments with `{ text, offset (ms) }`
- Output: Array of chunks with `{ content, startTime, endTime, segmentIndices }`
- Chunking algorithm:
  1. Accumulate segments until approaching target size
  2. Try to break at sentence boundaries (., !, ?)
  3. If no sentence boundary, break at word boundary
  4. Record start time from first segment, end time from last
  5. Include overlap from previous chunk's end
- Handle edge cases:
  - Very long single segments (split mid-segment)
  - Very short transcripts (single chunk)
  - Empty segments (skip)

**What Could Break:**
- Transcript segments without proper offsets — add fallback
- Unicode sentence detection — use simple regex first

**Done When:**
- [ ] ChunkData type defined with content, startTime, endTime
- [ ] chunkTranscript() function handles normal transcripts
- [ ] Overlap is included between consecutive chunks
- [ ] Timestamps accurately reflect chunk boundaries
- [ ] Edge cases handled (long segments, short transcripts)
- [ ] Unit tests pass for chunking logic

---

### Chunk 3: Embedding Service with Progress Callbacks

**Goal:** Create service that generates embeddings for chunks with progress reporting and batch optimization

**Files:**
- `src/lib/embeddings/service.ts` — create
- `src/lib/embeddings/index.ts` — modify (export service)

**Implementation Details:**
- Service function: `embedChunks(chunks: ChunkData[], onProgress?: (current, total) => void)`
- Batch processing: Process in batches of 32 for memory efficiency
- Progress callback fires after each batch completes
- Return type: Array of chunks with embeddings attached
- Handle errors gracefully:
  - If single chunk fails, log and continue with others
  - Return partial results with error flags
- Database integration:
  - Accept optional videoId parameter
  - If provided, store chunks directly to database
  - Use transaction for atomicity
- Performance target: <5 seconds for typical transcript (50-100 chunks)

**What Could Break:**
- Memory pressure with large batches — 32 is conservative
- Pipeline not initialized — ensure singleton is ready
- Database connection issues — wrap in try/catch

**Done When:**
- [ ] embedChunks() generates embeddings for array of chunks
- [ ] Progress callback fires with (current, total) after each batch
- [ ] Batch size of 32 works without memory issues
- [ ] Can store results directly to database when videoId provided
- [ ] Errors in single chunks don't crash entire operation
- [ ] Performance is acceptable (<5s for 100 chunks)

---

### Chunk 4: API Route and UI Integration

**Goal:** Create API endpoint for embedding generation and integrate with video detail UI

**Files:**
- `src/app/api/videos/[id]/embed/route.ts` — create
- `src/hooks/useEmbedding.ts` — create
- `src/components/video/EmbedButton.tsx` — create
- `src/app/videos/[id]/page.tsx` — modify (add embed button)

**Implementation Details:**
- POST `/api/videos/[id]/embed` endpoint:
  - Fetch transcript for video
  - Check if already embedded (skip if chunks exist with embeddings)
  - Chunk transcript using chunker
  - Generate embeddings using service
  - Store to database
  - Return chunk count and timing
- useEmbedding hook:
  - Track embedding state: idle | loading | success | error
  - Track progress: { current, total }
  - Polling approach for progress (SSE would be better but more complex)
- EmbedButton component:
  - Shows "Generate Embeddings" when no embeddings exist
  - Shows progress bar during generation
  - Shows "Embedded (N chunks)" when complete
  - Disable during processing
- Add button to video detail page near transcript section

**What Could Break:**
- Long-running request timeout — Vercel has 10s limit on Hobby
- Missing transcript — check and show helpful error
- Race conditions if button clicked twice — disable during processing

**Done When:**
- [ ] API route generates embeddings for video by ID
- [ ] Skips if video already has embeddings
- [ ] useEmbedding hook tracks state and progress
- [ ] EmbedButton shows appropriate state (idle/loading/success)
- [ ] Progress updates during long operations
- [ ] Error states handled with user-friendly messages
- [ ] Button integrated into video detail page
- [ ] Re-embed option available if transcript updated

## Notes

- Transformers.js: https://huggingface.co/docs/transformers.js
- Model: Xenova/all-MiniLM-L6-v2 (384 dimensions, Apache 2.0 license)
- Chunk size: ~500 tokens (~2000 chars) with 100 char overlap
- Batch size: 32 chunks per batch for memory efficiency
- Re-embed on transcript update (compare transcript hash)
- Progress indicator critical for UX on long transcripts
- Future: Consider pre-bundling model for Vercel Hobby tier deployment
- Alternative (if issues): Voyage AI has 200M free tokens as backup
