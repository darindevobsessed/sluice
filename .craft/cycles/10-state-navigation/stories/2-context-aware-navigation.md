---
name: context-aware-navigation
title: "Context-Aware Navigation"
status: planning
priority: high
created: 2026-02-13
updated: 2026-02-13
cycle: state-navigation
story_number: 2
chunks_total: 0
chunks_complete: 0
current_chunk: 0
---

# Story: Context-Aware Navigation

## Spark
Navigation flows become contextual — the app remembers where you came from. When adding a video from Discovery, the success state offers "Back to Discovery" (with filters intact) instead of only "Browse Knowledge Bank." Video detail's back button returns to the originating page, not always `/`. Uses a `returnTo` URL parameter passed through navigation chains. Covers both Add Video and Add Transcript flows.

## Key Flows
- Discovery (filtered) → "Add to KB" → `/add?url=...&returnTo=/discovery?channel=abc&type=not-saved` → Success → "Back to Discovery" with filters
- Discovery → Video detail → `/videos/123?returnTo=/discovery?channel=abc` → back → Discovery with filters
- KB (searching) → Video detail → `/videos/123?returnTo=/?q=react&type=youtube` → back → KB with search/filters
- Add Transcript flow also supports returnTo

## Implementation Notes
- `returnTo` param for all contextual navigation (explicit, survives refresh)
- Fallback to `/` when no `returnTo` present (direct navigation, bookmarks)
- Success state labels are contextual: "Back to Discovery" vs "Browse Knowledge Bank" based on returnTo origin

## Dependencies
**Blocked by:** 1-url-filter-state
**Blocks:** none

## Acceptance
<!-- Detailed criteria added via plan-chunks -->

## Chunks
<!-- Detailed chunks added via plan-chunks -->
