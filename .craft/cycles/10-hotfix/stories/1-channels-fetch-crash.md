---
name: fix-channels-fetch-crash
title: Fix frontend crash on /api/channels error
status: active
cycle: hotfix
story_number: 1
created: 2026-02-14
updated: 2026-02-14
priority: urgent
chunks_total: 1
chunks_complete: 0
current_chunk: 1
---

# Story: Fix frontend crash on /api/channels error

## Spark
DiscoveryContent.tsx calls `response.json()` before checking `response.ok` on the `/api/channels` fetch. When the API returns a 500 with an empty body, `json()` throws a parse error that crashes the component instead of showing the error state gracefully.

## Chunk 1: Fix fetch error handling

**What:** Check `response.ok` before calling `response.json()`, use `.text()` for error bodies.

**Files:**
- `src/components/discovery/DiscoveryContent.tsx`
- `src/app/discovery/__tests__/page.test.tsx`
