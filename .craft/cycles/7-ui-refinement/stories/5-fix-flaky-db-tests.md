---
name: fix-flaky-db-tests
title: Fix flaky DB test isolation
status: complete
cycle: ui-refinement
story_number: 5
created: 2026-02-11
updated: 2026-02-11
priority: urgent
chunks_total: 1
chunks_complete: 1
---

# Story: Fix flaky DB test isolation

## Spark
11 test files all use generic `youtubeId` values like `vid1`, `vid2`, etc. When the full test suite runs, these Postgres-backed tests execute concurrently against the same `goldminer_test` database, causing unique constraint violations and stale data reads. Different runs produce different failures depending on which files collide. Fix by giving each test file unique `youtubeId` prefixes.

## Chunks

### Chunk 1: Add unique youtubeId prefixes per test file

**Status:** pending

**Goal:** Make all 11 DB test files use unique `youtubeId` prefixes so they don't collide when running concurrently.

**Files (all modify):**
- `src/app/api/personas/status/__tests__/route.test.ts` — prefix `ps-`
- `src/app/api/channels/videos/__tests__/route.test.ts` — prefix `cv-`
- `src/app/api/search/__tests__/route.test.ts` — prefix `sr-`
- `src/app/discovery/__tests__/page.test.tsx` — prefix `dp-`
- `src/lib/personas/__tests__/context.test.ts` — prefix `pc-`
- `src/components/discovery/__tests__/CatchUpSection.test.tsx` — prefix `cu-`
- `src/lib/db/__tests__/temporal-metadata.test.ts` — prefix `tm-`
- `src/lib/db/__tests__/relationships.test.ts` — prefix `rl-`
- `src/lib/db/__tests__/search.test.ts` — prefix `ds-`
- `src/lib/search/__tests__/aggregate.test.ts` — prefix `ag-`
- `src/lib/search/__tests__/vector-search.test.ts` — prefix `vs-`
- `src/lib/db/__tests__/insights.test.ts` — prefix `in-`
- `src/app/api/videos/[id]/embed/__tests__/route.test.ts` — prefix `em-`

**Implementation Details:**
- In each file, find-and-replace `youtubeId: 'vid` with `youtubeId: '[prefix]vid` (e.g., `vid1` becomes `ps-vid1`)
- Also update any string references to these IDs used in assertions or URL construction
- Keep TRUNCATE in beforeEach — the prefixes prevent cross-file collision, TRUNCATE handles within-file cleanup
- No changes to production code, only test files

**Done When:**
- [ ] Full test suite passes consistently (run 2-3 times to confirm no flakiness)
- [ ] No two test files share the same youtubeId values
