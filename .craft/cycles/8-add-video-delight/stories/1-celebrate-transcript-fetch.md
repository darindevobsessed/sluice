---
name: celebrate-transcript-fetch
title: "Celebrate transcript auto-fetch with personality"
status: active
priority: high
created: 2026-02-12
updated: 2026-02-12
cycle: add-video-delight
story_number: 1
chunks_total: 2
chunks_complete: 1
---

# Story: Celebrate transcript auto-fetch with personality

## Spark
The transcript auto-fetch is the first "magic moment" in the add video flow — a YouTube link turns into usable text automatically. Right now it just silently appears. This story adds dynamic copy and a sparkle moment to the TranscriptSection so users feel the magic of something happening for them. Think "your transcript is ready" with personality, not a clinical status change.

## Dependencies
**Blocked by:** none
**Blocks:** Story 3 (storytelling-loading-states)

## Acceptance
- [ ] Success indicator shows "Transcript ready — pulled from YouTube" with Sparkles icon
- [ ] Success indicator fades in smoothly (animate-in fade-in duration-200)
- [ ] Label says "Your transcript:" when auto-fetched
- [ ] Textarea has subtle green border when auto-fetched
- [ ] All tests pass (unit + integration)
- [ ] No visual regression on manual paste flow

## Chunks

### Chunk 1: Celebrate the auto-fetch success in TranscriptSection

**Status:** pending

**Goal:** Transform the auto-fetch success moment from clinical to celebratory — warmer copy, Sparkles icon, entrance animation, and a subtle green border on the textarea.

**Files:**
- `src/components/add-video/TranscriptSection.tsx` — modify (lines 7, 33-34, 42-46, 72-78)
- `src/components/add-video/__tests__/TranscriptSection.test.tsx` — modify (tests at lines 31-36, 73-79, add new tests)

**Implementation Details:**
- Import `Sparkles` from `lucide-react` alongside existing `Check` (line 7)
- Import `cn` from `@/lib/utils`
- **Label copy change** (line 33-34): Replace `"Transcript:"` with `"Your transcript:"` when `source === "auto"`
- **Success indicator** (lines 42-46): Replace the current span with:
  ```tsx
  <span className="flex items-center gap-1.5 text-sm text-green-600 animate-in fade-in duration-200">
    <Sparkles className="h-3.5 w-3.5" />
    Transcript ready — pulled from YouTube
  </span>
  ```
  - Swaps `Check` for `Sparkles` (the "magic moment" icon, already used in 5+ codebase locations)
  - Copy: "Auto-fetched from YouTube" → "Transcript ready — pulled from YouTube"
  - `animate-in fade-in duration-200` entrance per locked pattern (same as TopBar.tsx:37)
- **Subtle green border on textarea** (line 72-78): Add conditional class when `source === "auto"`:
  ```tsx
  className={cn(
    "min-h-[300px] max-h-[500px] overflow-y-auto text-base leading-relaxed",
    source === "auto" && "border-green-300 dark:border-green-800"
  )}
  ```
- **Update tests:**
  - Test at line 31-36: Change matcher from `/auto-fetched from youtube/i` to `/transcript ready/i`
  - Test at line 73-79: Update label assertion to check for "Your transcript:" when source is auto
  - Add test: verify `animate-in` class is present on success indicator
  - Add test: verify textarea has `border-green-300` class when source is auto

**What Could Break:**
- `cn()` import — confirmed available from `@/lib/utils`
- Dark mode border color — using `dark:border-green-800` for proper contrast

**Done When:**
- [ ] Success indicator shows "Transcript ready — pulled from YouTube" with Sparkles icon
- [ ] Success indicator fades in smoothly
- [ ] Label says "Your transcript:" when auto-fetched
- [ ] Textarea has subtle green border when auto-fetched
- [ ] All TranscriptSection unit tests pass

---

### Chunk 2: Update AddVideoPage integration tests for new copy

**Status:** pending

**Goal:** Fix the 3 integration test assertions in AddVideoPage.test.tsx that match on the old "auto-fetched from youtube" text.

**Files:**
- `src/components/add-video/__tests__/AddVideoPage.test.tsx` — modify (lines 154, 242)

**Implementation Details:**
- Line 154: Change `expect(screen.getByText(/auto-fetched from youtube/i))` to `expect(screen.getByText(/transcript ready/i))`
- Line 242: Same change — `/auto-fetched from youtube/i` → `/transcript ready/i`
- Line 130: "Fetching transcript..." text is unchanged (loading state, not success state) — leave as-is
- No behavioral changes — just text matching updates for new copy

**What Could Break:**
- Regex `/transcript ready/i` matching unintended text — verify uniqueness on page
- Async waitFor timing unaffected by copy changes

**Done When:**
- [ ] All AddVideoPage integration tests pass
- [ ] No test matches on old "auto-fetched from youtube" text anywhere
