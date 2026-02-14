---
name: batch-add-from-discovery
title: "Batch Add from Discovery"
status: active
cycle: state-navigation
story_number: 4
created: 2026-02-14
updated: 2026-02-14
priority: high
chunks_total: 3
chunks_complete: 2
---

# Story: Batch Add from Discovery

## Spark
Select multiple videos on the Discovery tab and add them all to the knowledge bank at once. Each card gets a checkbox overlay on hover. When 1+ videos are selected, a floating action bar slides up from the bottom with "Add X to Bank" and a count. Batch-POSTs all selected videos with per-card completion feedback as each finishes. Currently each video requires navigating to /add individually.

## Delivery
Checkbox multi-select on Discovery cards (not-saved only) feeds into a floating action bar at the bottom of the page. The batch add stays on the Discovery page — no navigation to /add. A custom hook orchestrates concurrent transcript-fetch + save operations (max 2 at a time, reusing existing APIs) while each card shows real-time progress with spinner → checkmark animations. After all complete, the video list refreshes to reflect updated bank status.

## Decisions
### Selection Pattern
**Type:** component
**Choice:** inline

### Action Bar
**Type:** component
**Choice:** drawer

### Card Selection Indicator
**Type:** visibility
**Choice:** rich

## Visual Direction
**Vibe:** Checkbox Select + Floating Action Bar
**Feel:** Efficient, purposeful, clean
**Inspiration:** Gmail bulk actions, Figma multi-select, Google Photos
**Key tokens:** `bg-primary/10` selected overlay, `ring-2 ring-primary` selected border
**Motion:** checkbox: fade 150ms; floating-bar: translateY 200ms ease-out; selected-ring: ring-opacity 150ms; batch-progress: per-card checkmark fade 300ms stagger

## Wireframe
```
┌─────────────────────────────────────────────┐
│ Discovery                                   │
│ [Follow channel...] [Creator▾] [Type▾] [⟳]  │
│                                             │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │☑ 🖼  │ │☐ 🖼  │ │☑ 🖼  │ │  🖼  │       │
│ │Title │ │Title │ │Title │ │Title │       │
│ │2d ago│ │5d ago│ │1w ago│ │1w ago│       │
│ │Add.. │ │Add.. │ │Add.. │ │In Bnk│       │
│ └──────┘ └──────┘ └──────┘ └──────┘       │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  ☑ 2 selected    [Add 2 to Bank]   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Acceptance
- [ ] Not-saved cards show checkbox on hover, in-bank cards do not
- [ ] Selecting 1+ videos shows floating action bar with count
- [ ] "Add X to Bank" processes all selected videos without leaving Discovery
- [ ] Each card shows spinner while adding, green checkmark when done
- [ ] Failed adds show error state per-card
- [ ] Max 2 concurrent operations, 429 rate limits retried
- [ ] After batch completes, video list refreshes and selection clears
- [ ] All existing tests continue to pass

## Notes
- Checkbox only appears on not-saved cards (cards with "In Bank" badge are not selectable)
- Reuses existing POST /api/youtube/transcript + POST /api/videos endpoints (no new API)
- Client-side concurrency control: max 2 parallel operations
- Each video needs transcript fetched — 429 responses retried after Retry-After delay
- 409 (duplicate) treated as success, not error
- Per-card completion animation: card transitions to "Added" state with checkmark as each individual add completes
- Existing embeddings pipeline (after() callback) handles embedding generation automatically
- Selection state is local (useState with Set<string> of youtubeIds) — no URL persistence needed

## Chunks

### Chunk 1: Selection State + Checkbox UI

**Goal:** Add selection state management and checkbox overlays to Discovery video cards.

**Files:**
- `src/components/discovery/DiscoveryVideoCard.tsx` — modify (add selection props, checkbox overlay, selected ring)
- `src/components/discovery/__tests__/DiscoveryVideoCard.test.tsx` — modify (add selection tests)
- `src/components/discovery/DiscoveryVideoGrid.tsx` — modify (pass selection props through to cards)
- `src/components/discovery/DiscoveryContent.tsx` — modify (add `useState<Set<string>>` for selection, handlers)

**Implementation Details:**
- **DiscoveryVideoCard.tsx** — add optional props to the existing `DiscoveryVideoCardProps` interface (line 21-27):
  ```tsx
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (youtubeId: string) => void
  ```
  Add checkbox overlay as first child inside the thumbnail `<div>` (line 43). Absolute positioned top-left (`absolute top-2 left-2 z-10`). Use a native `<input type="checkbox">` styled with `size-5 rounded border-2 accent-primary cursor-pointer`. Visible on hover via `opacity-0 group-hover:opacity-100` — but always visible when `selected` is true. On click, call `onToggleSelect(video.youtubeId)` with `e.stopPropagation()` to prevent card click.

  When `selected`, add ring to the Card: `ring-2 ring-primary` and overlay on thumbnail: `<div className="absolute inset-0 bg-primary/10 z-[5]" />`. Only render checkbox + selection UI when `selectable` is true (not-saved cards: `!video.inBank`).

  Move the green "new" dot (line 52-54) to `right-2` to avoid collision with checkbox at `left-2`.

  Motion: checkbox `transition-opacity duration-150`, selected ring `transition-all duration-150`.

- **DiscoveryVideoGrid.tsx** — add props: `selectedIds?: Set<string>`, `onToggleSelect?: (youtubeId: string) => void`. Pass to each DiscoveryVideoCard at line 79: `selectable={!video.inBank}`, `selected={selectedIds?.has(video.youtubeId)}`, `onToggleSelect={onToggleSelect}`.

- **DiscoveryContent.tsx** — add at line 58: `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())`. Add handler:
  ```tsx
  const handleToggleSelect = useCallback((youtubeId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(youtubeId)) next.delete(youtubeId)
      else next.add(youtubeId)
      return next
    })
  }, [])
  ```
  Pass `selectedIds` and `onToggleSelect={handleToggleSelect}` to DiscoveryVideoGrid at line 306. Clear selection when filters change (add `setSelectedIds(new Set())` to `handleChannelChange`, `handleContentTypeChange`).

- **Tests:** Verify checkbox renders on not-saved cards, doesn't render on in-bank cards, toggle fires `onToggleSelect`, selected card has `ring-primary` class, checkbox visible on hover.

**What Could Break:**
- Green "new" dot position change — minor visual shift, test may need updating if it checks `left-2`.
- `e.stopPropagation()` on checkbox must not interfere with card's existing Link navigation.

**Done When:**
- [ ] Not-saved cards show checkbox on hover
- [ ] In-bank cards have no checkbox
- [ ] Clicking checkbox toggles selection state
- [ ] Selected cards show ring-2 ring-primary + bg-primary/10 overlay
- [ ] Filter changes clear selection
- [ ] All existing DiscoveryVideoCard tests still pass

### Chunk 2: Floating Batch Action Bar

**Goal:** Create a floating action bar that appears at the bottom when videos are selected.

**Files:**
- `src/components/discovery/FloatingBatchBar.tsx` — create
- `src/components/discovery/__tests__/FloatingBatchBar.test.tsx` — create
- `src/components/discovery/DiscoveryContent.tsx` — modify (add FloatingBatchBar)

**Implementation Details:**
- **FloatingBatchBar.tsx** — new component:
  ```tsx
  interface FloatingBatchBarProps {
    selectedCount: number
    onAdd: () => void
    onClear: () => void
    isAdding?: boolean
  }
  ```
  Renders a fixed-position bar at bottom center: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`. Styled: `bg-card border rounded-xl shadow-xl px-6 py-3 flex items-center gap-4`. Contains:
  - `<span className="text-sm font-medium">{selectedCount} selected</span>`
  - `<Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>`
  - `<Button size="sm" onClick={onAdd} disabled={isAdding}>Add {selectedCount} to Bank</Button>`

  Wrap in a conditional: only render when `selectedCount > 0`. Use `animate-in slide-in-from-bottom-4 duration-200` (shadcn animation util) for slide-up entrance. When `isAdding`, show spinner in the Add button and disable both buttons.

- **DiscoveryContent.tsx** — import and render FloatingBatchBar after the DiscoveryVideoGrid (line 313):
  ```tsx
  <FloatingBatchBar
    selectedCount={selectedIds.size}
    onAdd={handleBatchAdd}
    onClear={() => setSelectedIds(new Set())}
    isAdding={isBatchAdding}
  />
  ```
  Add placeholder `handleBatchAdd` and `isBatchAdding` state (wired in Chunk 3).

- **Tests:** Bar renders when count > 0, hidden when 0, shows correct count, Add button calls onAdd, Clear calls onClear, buttons disabled when isAdding.

**What Could Break:**
- Fixed positioning may overlap with pagination or other bottom elements — test scroll behavior.
- z-50 must be above card content but below any modals.

**Done When:**
- [ ] Bar hidden when no selections
- [ ] Bar slides up when 1+ selected
- [ ] Shows correct count
- [ ] "Add X to Bank" and "Clear" buttons work
- [ ] Buttons disabled during batch add

### Chunk 3: Batch Add Logic + Per-Card Progress

**Goal:** Wire the batch add flow — concurrent transcript fetch + save with per-card status animation.

**Files:**
- `src/hooks/useBatchAdd.ts` — create
- `src/hooks/__tests__/useBatchAdd.test.ts` — create
- `src/components/discovery/DiscoveryVideoCard.tsx` — modify (add batch status overlay)
- `src/components/discovery/DiscoveryVideoGrid.tsx` — modify (pass batch status)
- `src/components/discovery/DiscoveryContent.tsx` — modify (wire useBatchAdd)

**Implementation Details:**
- **useBatchAdd.ts** — custom hook:
  ```tsx
  type BatchItemStatus = 'pending' | 'fetching-transcript' | 'saving' | 'done' | 'error'

  interface BatchItem {
    youtubeId: string
    status: BatchItemStatus
    error?: string
  }

  interface UseBatchAddReturn {
    startBatch: (videos: DiscoveryVideo[]) => void
    batchStatus: Map<string, BatchItem>
    isRunning: boolean
    results: { success: number; failed: number }
  }
  ```
  Implementation: accepts array of DiscoveryVideo objects. Processes with concurrency limit of 2 using a simple queue pattern. For each video:
  1. Set status `'fetching-transcript'`
  2. POST `/api/youtube/transcript` with `{ videoId: video.youtubeId }`
  3. If 429 (rate limited), wait `Retry-After` seconds and retry once
  4. Set status `'saving'`
  5. POST `/api/videos` with `{ youtubeId, title: video.title, channel: video.channelName, thumbnail: 'https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg', transcript, sourceType: 'youtube' }`
  6. If 409 (duplicate), mark as `'done'` (already in bank — not an error)
  7. Set status `'done'` or `'error'`

  Uses `useRef` for the queue and `useState` for the status Map (trigger re-renders on status changes). `isRunning` is true while any items are pending/in-progress. After all complete, call an `onComplete` callback passed by the parent.

- **DiscoveryVideoCard.tsx** — add optional `batchStatus?: BatchItemStatus` prop. When present, render status overlay on the thumbnail:
  - `'fetching-transcript'` / `'saving'`: spinner overlay (`absolute inset-0 bg-background/60 flex items-center justify-center z-10` + `animate-spin` icon)
  - `'done'`: green checkmark overlay (same positioning, `bg-green-500/20` + `Check` icon from lucide-react, `animate-in fade-in duration-300`)
  - `'error'`: red X overlay with `bg-red-500/20`

  When status is `'done'`, hide the checkbox and "Add to Bank" button — show "In Bank" badge instead (the card transitions to the "added" state visually).

- **DiscoveryVideoGrid.tsx** — add `batchStatus?: Map<string, BatchItem>` prop, pass `batchStatus={batchStatus?.get(video.youtubeId)?.status}` to each card.

- **DiscoveryContent.tsx** — wire it all together:
  ```tsx
  const { startBatch, batchStatus, isRunning, results } = useBatchAdd()

  const handleBatchAdd = useCallback(() => {
    const videosToAdd = discoveryVideos.filter(v => selectedIds.has(v.youtubeId) && !v.inBank)
    startBatch(videosToAdd)
  }, [selectedIds, discoveryVideos, startBatch])
  ```
  Pass `isAdding={isRunning}` to FloatingBatchBar. Pass `batchStatus` to DiscoveryVideoGrid. After batch completes, refetch videos (`fetchVideos()`) to update `inBank` status from server, then clear selection.

- **Tests for useBatchAdd:** Mock fetch for transcript and video APIs. Test: processes 2 at a time, handles 429 retry, handles 409 duplicate gracefully, reports per-item status changes, final counts are correct. Test error handling: transcript fetch fails → item marked error, video save fails → item marked error.

**What Could Break:**
- Race condition: if user navigates away mid-batch, cleanup needed (AbortController in useEffect return)
- Rate limit: if batch is >10 videos, later ones will hit 429 — retry logic handles this
- State sync: after batch completes, `fetchVideos()` refresh may show stale data if embeddings haven't finished — acceptable since embeddings are background

**Done When:**
- [ ] Clicking "Add X to Bank" starts batch processing
- [ ] Cards show spinner while transcript is fetching/saving
- [ ] Cards show green checkmark when done (fade-in 300ms)
- [ ] Cards show error state on failure
- [ ] Maximum 2 concurrent operations
- [ ] 429 rate limit responses are retried after delay
- [ ] 409 duplicates treated as success
- [ ] After batch completes, video list refreshes and selection clears
- [ ] All existing tests pass
