---
name: auto-embed
title: Auto-embed on video creation
status: active
priority: high
created: 2026-02-09
updated: 2026-02-10
cycle: polish-reliability
story_number: 2
chunks_total: 3
chunks_complete: 1
---

# Story: Auto-embed on video creation

## Spark
Embeddings are currently user-triggered — after adding a video/transcript, you have to navigate to the detail page and click "Generate Embeddings". This is unnecessary friction. Embeddings should generate automatically in the background when a video is created, so content is immediately searchable. The existing embed button stays as a re-embed fallback for edge cases.

## Scope

**Included:**
- Add Next.js `after()` call in POST /api/videos to trigger embedding generation after response
- Fix pre-existing Re-embed button bug (useEmbedding guard + embed route early return)
- Add test coverage for auto-embed and re-embed

**Excluded:**
- Visual progress indicator on Knowledge Bank page (just detail page EmbedButton)
- Log table for embedding results (console.log only)
- Job queue integration (using `after()` instead — simpler, immediate)
- Changes to add-video or add-transcript UI

## Preserve
- POST /api/videos response time (201 returns immediately, embedding is fire-and-forget)
- EmbedButton "Generate Embeddings" initial state (still works as fallback if auto-embed fails)
- Embedding pipeline behavior (parseTranscript → chunkTranscript → embedChunks)
- Graph relationships + temporal metadata auto-triggered by embedChunks

## Hardest Constraint
Ensuring `after()` works reliably in Next.js 16 dev mode and that the fire-and-forget pattern doesn't silently swallow errors without any observability. The Re-embed fix also needs to not break the initial embed guard (which prevents double-embedding when auto-embed already ran).

## Technical Concerns
- `after()` from `next/server` is stable since Next.js 15.1, but untested in this codebase
- First-ever embedding call loads the ML model (~5-10s), subsequent calls use cached singleton
- Race condition: user navigates to detail page before auto-embed finishes — EmbedButton shows "Generate Embeddings" idle state, which is acceptable
- Mocking `after()` in Vitest requires careful mock scoping

## Dependencies
**Blocked by:** none
**Blocks:** none

## Decisions

### Embedding Trigger Mechanism
**Decision:** Use Next.js `after()` API instead of job queue
**Rationale:** Simpler, immediate execution after response, no cron dependency. The job queue (`enqueueJob` + cron processor) exists but adds latency and complexity for this use case.

### Re-embed Approach
**Decision:** Remove `alreadyEmbedded` early return from embed route, add `reEmbed()` to hook
**Rationale:** `embedChunks` already handles delete+reinsert in a transaction, so the early return is redundant safety. The hook needs a separate `reEmbed()` that bypasses the `hasEmbeddings` guard while keeping `embed()` guarded for normal flow.

## Acceptance
- [ ] Given a user adds a video or transcript, when the POST succeeds, then embedding generation starts automatically in the background via `after()`
- [ ] Given embeddings are generating in the background, when the user navigates to the video detail page, then they see embedding completion or the manual fallback button
- [ ] Given the embed button on the video detail page, when embeddings already exist, then clicking "Re-embed" actually re-generates embeddings
- [ ] Given a background embedding fails, when the user visits the detail page, then the "Generate Embeddings" button is available as a manual fallback
- [ ] Given a video without a transcript, when created, then no embedding is triggered
- [ ] Given the Re-embed button is clicked, then embeddings are deleted and regenerated via transaction

## Chunks

### Chunk 1: Auto-embed trigger in POST /api/videos

**Goal:** After a successful video/transcript creation, trigger the full embedding pipeline in the background using Next.js `after()`.

**Files:**
- `src/app/api/videos/route.ts` — modify (add `after()` call after successful insert)

**Implementation Details:**
- Import `after` from `next/server`
- After the DB insert succeeds and before returning the 201 response, call `after(async () => { ... })`
- Inside the callback: `parseTranscript(video.transcript)` → `chunkTranscript(segments)` → `embedChunks(chunks, undefined, video.id)`
- Wrap in try/catch — log errors with `console.error('[auto-embed] Failed for video ${videoId}:')` but never throw
- Only trigger if the video has a transcript (skip if transcript is empty/null)
- Reuse the same pipeline logic as `processGenerateEmbeddings` in `processor.ts` lines 63-93
- Log success: `console.log('[auto-embed] Generated ${result.successCount} embeddings for video ${videoId}')`

**What Could Break:**
- `after()` behavior in `next dev` — needs manual verification after implementation
- First embedding call loads the ML model (~5-10s)

**Done When:**
- [ ] Adding a video/transcript via POST triggers embedding generation automatically
- [ ] The 201 response returns immediately without waiting for embeddings
- [ ] Errors in the callback don't affect the POST response
- [ ] Console logs show embedding success/failure

### Chunk 2: Fix Re-embed button

**Goal:** Make the Re-embed button functional as a manual fallback for re-generating embeddings.

**Files:**
- `src/hooks/useEmbedding.ts` — modify (add `reEmbed()` function that bypasses the `hasEmbeddings` guard)
- `src/app/api/videos/[id]/embed/route.ts` — modify (remove `alreadyEmbedded` early return at lines 85-91)
- `src/components/video/EmbedButton.tsx` — modify (wire Re-embed button to `reEmbed()` instead of `embed()`)

**Implementation Details:**
- `useEmbedding` hook: add `reEmbed` to the return value — same logic as `embed()` but skips the `if (hasEmbeddings) return` guard. Sets state to `'loading'`, POSTs to embed endpoint, handles success (refetch status) and error states.
- Embed API route: remove the `alreadyEmbedded` early-return block (lines 85-91). `embedChunks` already does delete+reinsert in a transaction, making the check redundant.
- `EmbedButton`: in the success state (line 93), change the Re-embed button's onClick from `embed` to `reEmbed`
- Keep `embed()` function's `hasEmbeddings` guard — it correctly prevents the initial button from triggering when auto-embed already ran

**What Could Break:**
- Removing `alreadyEmbedded` early return means the route always re-processes — verify `embedChunks` transaction handles delete+reinsert correctly
- The Re-embed button should show loading state while re-embedding

**Done When:**
- [ ] Clicking "Re-embed" on an already-embedded video triggers re-embedding
- [ ] Re-embed shows loading state and success/error feedback
- [ ] Initial "Generate Embeddings" button still guards against duplicate work
- [ ] `embedChunks` correctly replaces old chunks with new ones

### Chunk 3: Tests

**Goal:** Add test coverage for auto-embed trigger and re-embed fix.

**Files:**
- `src/app/api/videos/__tests__/route.test.ts` — modify (test `after()` is called on successful POST)
- `src/hooks/__tests__/useEmbedding.test.ts` — create or modify (test `reEmbed` function)

**Implementation Details:**
- Mock `next/server`'s `after` function: `vi.mock('next/server', () => ({ after: vi.fn() }))`
- Test: successful POST with transcript → `after()` is called with a function argument
- Test: successful POST without transcript → `after()` is NOT called (or callback returns early)
- Test: `useEmbedding` hook's `reEmbed()` — calls the embed endpoint even when `hasEmbeddings` is true
- Test: `useEmbedding` hook's `embed()` — still returns early when `hasEmbeddings` is true
- Verify mock scoping doesn't interfere with other `next/server` imports (NextResponse, etc.)

**What Could Break:**
- Mocking `after` from `next/server` may conflict with NextResponse mocking in the same test file

**Done When:**
- [ ] Tests verify `after()` is invoked on successful video creation with transcript
- [ ] Tests verify `after()` is NOT invoked when no transcript
- [ ] Tests verify `reEmbed()` bypasses the `hasEmbeddings` guard
- [ ] Tests verify `embed()` respects the `hasEmbeddings` guard
- [ ] `npm test` passes clean

## Notes
- Next.js `after()` API is stable since v15.1, project uses v16.1.6
- Background job processor exists at `src/lib/automation/processor.ts` with `generate_embeddings` job type — not used here because `after()` is simpler and immediate
- Embedding pipeline is local (Xenova/all-MiniLM-L6-v2), no external API rate limits
- Graph relationships and temporal metadata extraction are already auto-triggered by `embedChunks` service
- Pre-existing Re-embed bug: `useEmbedding.ts` line 51 has `if (hasEmbeddings) return` that blocks re-embed clicks
