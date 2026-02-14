---
name: channels-retry-logic
title: Add retry logic for transient HMR 500s on Discovery page
status: active
cycle: hotfix
story_number: 2
created: 2026-02-14
updated: 2026-02-14
priority: urgent
chunks_total: 1
chunks_complete: 0
current_chunk: 0
---

# Story: Add retry logic for transient HMR 500s on Discovery page

## Spark
Next.js HMR compilation causes transient empty-body 500s on API routes before handlers execute. The Discovery page's `fetchChannels` calls `response.json()` before checking `response.ok`, and has no retry logic — so a single 500 permanently shows "Failed to load channels." Frontend needs: (1) check `response.ok` before `.json()`, (2) retry on 500 with backoff so the UI recovers automatically once the server stabilizes.

## Scope
**Included:**
- Fix `fetchChannels` in DiscoveryContent.tsx: check `response.ok` before `.json()`, use `.text()` for error bodies
- Add retry logic (3 attempts, 1s delay) to `fetchChannels` so transient 500s self-heal
- Apply same retry pattern to `fetchVideos` (same file, same vulnerability)
- Update tests to cover retry behavior with fake timers

**Excluded:**
- Server-side fixes (the 500 is at Next.js compilation layer, not route handler)
- Other pages/components (Discovery is the only page that permanently breaks)
- Global fetch wrapper or utility (inline the retry, keep it simple)

## Hardest Constraint
Tests must not introduce real delays — use `vi.useFakeTimers()` for retry waits. The `setIsLoading(false)` must only fire once after all retries exhaust (not per-attempt).

## Chunk 1: Fix fetch error handling and add retry logic

**What:** Fix `response.ok` before `.json()`, add retry with delay to both `fetchChannels` and `fetchVideos`, update tests.

**Files:**
- `src/components/discovery/DiscoveryContent.tsx` — fix fetchChannels and fetchVideos
- `src/app/discovery/__tests__/page.test.tsx` — add retry tests, update error handling tests
