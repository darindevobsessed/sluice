---
name: add-video-gpu-performance
title: Fix GPU performance issues during insight extraction
status: active
cycle: ui-refinement
story_number: 6
created: 2026-02-11
updated: 2026-02-11
priority: high
chunks_total: 2
chunks_complete: 0
---

# Story: Fix GPU performance issues during insight extraction

## Spark
The Video Detail page has GPU performance issues during insight extraction streaming. Root cause is likely `transition-all` on multiple components combined with high-frequency React context re-renders from token-by-token ExtractionProvider state updates. Need to profile with Chrome DevTools to confirm, then apply targeted fixes.

## Chunks

### Chunk 1: Profile and identify the performance bottleneck

**Status:** pending

**Goal:** Use Chrome DevTools performance trace on the Video Detail page (`/videos/[id]`) during active insight extraction to identify what causes GPU spikes.

**Files:**
- No file changes — profiling/investigation only

**Implementation Details:**
- Navigate to a video's detail page at `/videos/[id]` in the browser
- Open the Insights tab and start a Chrome DevTools performance trace
- Trigger "Extract Insights" to begin streaming extraction
- Analyze the trace for:
  - **`transition-all` on InsightSection** (`src/components/insights/InsightSection.tsx:46`) — transitions border-color AND box-shadow (`shadow-blue-500/10`) every time section status changes from `pending` → `working` → `complete`
  - **`transition-all` on Button base** (`src/components/ui/button.tsx:8`) — every button transitions all properties on hover/focus
  - **High-frequency state updates** from `ExtractionProvider` (`src/components/providers/ExtractionProvider.tsx:68`) — `onText` fires per token, creating new `Map` each time, triggering full context re-renders
  - **Multiple concurrent `animate-pulse`** skeleton loaders in InsightSection (`InsightSection.tsx:21`) — 4 divs per section, multiple sections active
  - **Progress bar** `transition-all duration-500` in InsightsPanel (`InsightsPanel.tsx:189`)
- Document: which component(s), which CSS properties, re-render frequency, and GPU layer count

**What Could Break:**
- Nothing — read-only profiling

**Done When:**
- [ ] Root cause identified with specific component(s) and CSS properties
- [ ] Findings documented for chunk 2

---

### Chunk 2: Fix the identified performance issues

**Status:** pending

**Goal:** Apply targeted fixes based on chunk 1 profiling. Below are the most probable targets — actual fix scoped by profiling results.

**Files (most probable based on research):**
- `src/components/insights/InsightSection.tsx` — modify (replace `transition-all` with scoped transitions)
- `src/components/ui/button.tsx` — modify (replace `transition-all` with scoped transitions)
- `src/components/providers/ExtractionProvider.tsx` — modify (batch `onText` state updates with `requestAnimationFrame`)
- `src/components/insights/InsightsPanel.tsx` — modify (scope progress bar transition)

**Implementation Details:**

**InsightSection.tsx (line 46):**
- Replace `transition-all duration-300` with `transition-[border-color,box-shadow] duration-300`
- This prevents transitions on unrelated properties when status changes

**button.tsx (line 8):**
- Replace `transition-all` in the base buttonVariants with `transition-[color,background-color,border-color,box-shadow,opacity]`
- Follow the scoped pattern already used in `input.tsx:11` (`transition-[color,box-shadow]`)
- Test representative pages visually after change (this affects every button in the app)

**ExtractionProvider.tsx (line 68):**
- Only if profiling confirms high re-render frequency as bottleneck
- Wrap `setStateMap` updates in `requestAnimationFrame` batching:
  ```
  rafRef.current = requestAnimationFrame(() => {
    setStateMap(newMap)
  })
  ```
- Coalesces rapid token updates into one render per frame (~60/sec instead of hundreds)

**InsightsPanel.tsx (line 189):**
- Replace `transition-all duration-500 ease-out` on progress bar with `transition-[width] duration-500 ease-out`

**What Could Break:**
- Button visual transitions — verify hover/focus states still animate smoothly on all button variants
- Streaming text smoothness — if RAF batching is applied, verify text still appears to stream (not choppy)
- InsightSection status transitions — verify border/shadow changes still animate between pending/working/complete

**Done When:**
- [ ] GPU spikes eliminated or significantly reduced (confirmed by second performance trace)
- [ ] No visual regression — page still looks and animates correctly
- [ ] All button variants tested visually (hover, focus, disabled states)
- [ ] Streaming text still appears smooth during extraction
