---
name: persona-status-cleanup
title: Clean up PersonaStatus layout on Knowledge Bank
status: active
cycle: polish-reliability
story_number: 7
created: 2026-02-10
updated: 2026-02-10
priority: medium
chunks_total: 2
chunks_complete: 0
---

# Story: Clean up PersonaStatus layout on Knowledge Bank

## Spark
The PersonaStatus section shows all 13 channels as pills of varying widths, dominating the page before the search bar. Most channels are at 1/5 progress with "4 more needed" — visual noise that buries the one active persona. Pills are all different sizes making the layout look thrown together.

## Scope
**Included:**
- Show max 5 channels by default, sorted by progress (active first, then highest transcript count)
- "Show all N channels" / "Show less" toggle to expand/collapse remaining channels
- Uniform pill sizing: min-width so small pills don't shrink, truncate long channel names with ellipsis
- Consistent pill layout so rows look intentional, not scattered

**Excluded:**
- No changes to the PersonaStatus API endpoint
- No changes to persona creation flow
- No new components — just modify PersonaStatus.tsx

## Hardest Constraint
Sorting and slicing must put active personas first, then "ready to create" (at threshold), then building channels by transcript count descending — so the 5 visible pills are always the most relevant.

## Acceptance
- [ ] Only 5 channels visible by default
- [ ] Active personas always visible (never hidden behind toggle)
- [ ] "Show all N channels" button expands the rest
- [ ] "Show less" collapses back to 5
- [ ] Pills have uniform widths (min-width + truncated names)
- [ ] Layout looks clean and intentional — no jagged rows
- [ ] Search bar visible without scrolling on a typical viewport
- [ ] Existing PersonaStatus tests still pass

## Chunks

### Chunk 1: Sorting + show/hide toggle

**Goal:** Sort channels into correct priority order (active > ready > building by count desc), show max 5 by default, add expand/collapse toggle.

**Files:**
- `src/components/personas/PersonaStatus.tsx` — modify (add sort function, expand state, toggle button, slice to 5)
- `src/components/personas/__tests__/PersonaStatus.test.tsx` — modify (add tests for limit, toggle, sort order)

**Implementation Details:**
- Add `useState<boolean>(false)` for `expanded`
- Sort channels: active (has `personaId`) first, then ready (`transcriptCount >= threshold` but no persona), then building (below threshold) — within each tier, sort by `transcriptCount` desc
- Slice sorted array to 5 when `!expanded`
- Add "Show all N channels" / "Show less" button after the pills — use `Button` component with `variant="ghost"` size `"xs"`
- Ensure active personas are always in visible set (they sort first, so they'll always be in the top 5 unless there are 6+ active — handle that edge case by showing all active + fill to 5)
- The API response (`/api/personas/status`) already provides `personaId`, `transcriptCount`, and `threshold` — use these for sorting

**What Could Break:**
- Existing tests use 1-3 channels, all below the 5-channel threshold — they won't break
- Sort logic needs to match what the API provides (`personaId`, `transcriptCount`, `threshold`)

**Done When:**
- [ ] Only 5 channels visible by default when >5 exist
- [ ] Active personas always visible (never behind toggle)
- [ ] "Show all N channels" button reveals the rest
- [ ] "Show less" collapses back to 5
- [ ] Sort order: active > ready > building by count
- [ ] Existing 13 tests still pass

### Chunk 2: Uniform pill sizing

**Goal:** Make all pills similar width with min-width and truncated long channel names, so the layout looks intentional.

**Files:**
- `src/components/personas/PersonaStatus.tsx` — modify (add min-width, max-width, truncate classes)
- `src/components/personas/__tests__/PersonaStatus.test.tsx` — modify (verify truncated names render with title attribute for hover)

**Implementation Details:**
- Add `min-w-[160px]` to each pill container so short-named channels don't shrink
- Add `max-w-[280px]` to prevent overly wide pills from long names + progress info
- Add `truncate` class on the channel name span (text-overflow: ellipsis)
- Add `title` attribute with full channel name so users can hover to see the full name
- Use `transition-all duration-200` on the pills container for smooth expand/collapse
- Ensure the flex-wrap layout with these constraints creates even-looking rows

**What Could Break:**
- Very long names like "AI News & Strategy Daily | Nate B Jones" may need a tighter max-width
- Progress bar + "X more needed" text needs to fit within the max-width constraint

**Done When:**
- [ ] Pills have consistent minimum width
- [ ] Long channel names truncated with ellipsis
- [ ] Full name available on hover (title attribute)
- [ ] Layout looks clean — no jagged, scattered rows
- [ ] Search bar visible without scrolling
- [ ] All tests pass

## Notes
- Pattern to follow: `src/components/personas/PersonaStatus.tsx` created in story 4-ux-clarity (complete)
- API endpoint `/api/personas/status` returns `{ channels: Channel[], threshold: number }` — no changes needed
- API already sorts active first then by transcript count desc — client-side re-sort adds "ready" tier
- ensemble.test.ts and other persona tests mock PersonaStatus — no cascade test changes
- Button component has `variant="ghost"` and `size="xs"` — use for toggle button
