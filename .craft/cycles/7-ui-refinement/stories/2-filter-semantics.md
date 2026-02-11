---
name: fix-filter-semantics
title: Fix filter semantics across Discovery and Knowledge Bank tabs
status: complete
cycle: ui-refinement
story_number: 2
created: 2026-02-11
updated: 2026-02-11
priority: urgent
chunks_total: 2
chunks_complete: 2
---

# Story: Fix filter semantics across Discovery and Knowledge Bank tabs

## Spark
The "Videos / Transcripts" content type filter on the Discovery tab is misleading — it actually filters by `inBank` status (saved vs not saved), not by content type. Discovery has no transcripts to show. Meanwhile, Knowledge Bank has two actual content types (videos and non-video transcripts) but no way to filter between them. Fix both tabs so filters match their actual semantics.

## Decisions

### Discovery Filter Relabel
Rename the Discovery content type filter from "All / Videos / Transcripts" to "All / Saved / Not Saved". Same `inBank` filtering logic, corrected labels.

### Knowledge Bank Content Type Filter
Add a content type filter to the Knowledge Bank tab: "All / Videos / Transcripts". This filters by actual content type — video entries vs non-video transcript entries that already exist in the system. Filter only visible when browsing the grid, hidden during search.

## Chunks

### Chunk 1: Relabel Discovery Filter to Saved / Not Saved

**Status:** pending

**Goal:** Change Discovery's `ContentTypeFilter` labels from "All / Videos / Transcripts" to "All / Saved / Not Saved".

**Files:**
- `src/components/discovery/ContentTypeFilter.tsx` — modify
- `src/app/discovery/page.tsx` — modify
- `src/components/discovery/__tests__/ContentTypeFilter.test.tsx` — modify
- `src/app/discovery/__tests__/page.test.tsx` — modify

**Implementation Details:**
- In `ContentTypeFilter.tsx`:
  - Change type at line 11: `'all' | 'videos' | 'transcripts'` → `'all' | 'saved' | 'not-saved'`
  - Change `DISPLAY_LABELS` at lines 18-22: `{ all: 'All', saved: 'Saved', 'not-saved': 'Not Saved' }`
  - Update the three `DropdownMenuItem` onClick values at lines 38-42 from `'all'`/`'videos'`/`'transcripts'` to `'all'`/`'saved'`/`'not-saved'`, and update their display text
- In `discovery/page.tsx`:
  - Line 162: `contentType === 'videos'` → `contentType === 'not-saved'` (filters `!video.inBank`)
  - Line 164: `contentType === 'transcripts'` → `contentType === 'saved'` (filters `video.inBank`)
- Tests: Find-and-replace old labels/values in both test files. TypeScript will catch any missed type references.

**Done When:**
- [ ] Discovery filter shows "All / Saved / Not Saved"
- [ ] "Saved" shows `inBank: true`, "Not Saved" shows `inBank: false`
- [ ] All tests pass

---

### Chunk 2: Add Content Type Filter to Knowledge Bank

**Status:** pending

**Goal:** Add a pill dropdown filtering Knowledge Bank videos by `sourceType` (`'youtube'` | `'transcript'`).

**Files:**
- `src/components/videos/ContentTypeFilter.tsx` — create
- `src/app/page.tsx` — modify

**Implementation Details:**
- New component `src/components/videos/ContentTypeFilter.tsx`:
  - Copy the pill dropdown pattern from `src/components/discovery/ContentTypeFilter.tsx`
  - Type: `'all' | 'youtube' | 'transcript'` (matches DB `sourceType` values)
  - Labels: `{ all: 'All', youtube: 'Videos', transcript: 'Transcripts' }`
  - Same styling: `rounded-full px-4 py-1.5 text-sm bg-muted` with `ChevronDown`
- In `src/app/page.tsx`:
  - Add state: `const [contentType, setContentType] = useState<KBContentTypeValue>('all')`
  - Add `useMemo` to filter `videos` by `video.sourceType`:
    ```tsx
    const filteredVideos = useMemo(() => {
      if (contentType === 'all') return videos
      return videos.filter(v => v.sourceType === contentType)
    }, [videos, contentType])
    ```
  - Place filter in a toolbar row between the search bar and the content area, only when `!showSearchResults`:
    ```tsx
    {!showSearchResults && videos.length > 0 && (
      <div className="flex items-center gap-2 mb-4">
        <ContentTypeFilter selected={contentType} onChange={setContentType} />
      </div>
    )}
    ```
  - Pass `filteredVideos` to `VideoGrid` instead of `videos`

**Done When:**
- [ ] Knowledge Bank shows content type pill dropdown above the grid
- [ ] "Videos" shows only `sourceType: 'youtube'`
- [ ] "Transcripts" shows only `sourceType: 'transcript'`
- [ ] Filter hidden during search
- [ ] Composes with focus area filter
