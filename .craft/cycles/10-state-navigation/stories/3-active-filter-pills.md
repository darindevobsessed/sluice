---
name: active-filter-pills
title: "Active Filter Pills"
status: active
priority: medium
created: 2026-02-13
updated: 2026-02-14
cycle: state-navigation
story_number: 3
chunks_total: 3
chunks_complete: 2
current_chunk: 3
---

# Story: Active Filter Pills

## Spark
A shared filter pill bar component that renders active filters as dismissible pills (`[Label: Value ×]`). Used on both Discovery (channel, content type) and Knowledge Bank (content type, search query). Shows a "Clear all" option when 2+ filters are active. Sits between the page header/controls and the content grid. Dismissing a pill updates the URL params, which updates the filtered results. When no filters are active, the pill bar is hidden (zero height, no layout shift).

## Examples
- Discovery: `[Creator: Fireship ×]` `[Status: Not Saved ×]` `Clear all`
- KB: `[Type: YouTube ×]` `[Search: "react hooks" ×]`

## Implementation Notes
- Focus Area NOT shown as pill (already visible in top bar, global setting)
- Shared component, page-specific filter config passed as props
- Pills read from and write to URL searchParams (from Story 1)

## Dependencies
**Blocked by:** 1-url-filter-state
**Blocks:** none

## Decisions
- Generic `FilterPill` interface: `{ label, value, onDismiss }` — pages build their own pill arrays
- "Clear all" shown at 2+ pills, uses `onClearAll` callback
- Pill dismissal resets page param on Discovery (avoids stale pagination)
- Search query pill on KB: value shows quoted text `"react hooks"`
- `page` param NOT shown as a pill (pagination is separate)
- Compose with existing `Badge` component (`variant="secondary"`, already `rounded-full`)

## Acceptance
- [ ] Discovery: active channel shows as `[Creator: Name ×]` pill
- [ ] Discovery: active type shows as `[Status: Value ×]` pill
- [ ] KB: active type shows as `[Type: Value ×]` pill
- [ ] KB: active search shows as `[Search: "query" ×]` pill
- [ ] Dismissing a pill clears that filter via URL params
- [ ] "Clear all" shown when 2+ pills, clears all filters
- [ ] No pill bar visible when no filters active (zero layout shift)
- [ ] Discovery pill dismiss resets page to 1
- [ ] KB search pill dismiss clears VideoSearch input
- [ ] All existing tests continue to pass

## Chunks

### Chunk 1: FilterPillBar Shared Component + Tests

**Goal:** Create the reusable FilterPillBar component with pill rendering, dismiss buttons, and "Clear all" logic. TDD — tests first.

**Files:**
- `src/components/filters/FilterPillBar.tsx` — create
- `src/components/filters/__tests__/FilterPillBar.test.tsx` — create

**Implementation Details:**
- **Interface** (exported for page-specific usage):
  ```tsx
  export interface FilterPill {
    label: string   // e.g., "Creator"
    value: string   // e.g., "Fireship"
    onDismiss: () => void
  }

  interface FilterPillBarProps {
    pills: FilterPill[]
    onClearAll?: () => void
    className?: string
  }
  ```
- **Rendering:** Map `pills` array. Each pill: `<Badge variant="secondary" className="gap-1.5 pr-1.5 text-sm">` from `@/components/ui/badge` with `{label}: {value}` text and `<button onClick={onDismiss}><X className="h-3 w-3" /></button>`. Badge already has `rounded-full` base class.
- **"Clear all":** Render `<Button variant="ghost" size="sm" onClick={onClearAll}>Clear all</Button>` from `@/components/ui/button` when `pills.length >= 2` AND `onClearAll` is provided.
- **Layout:** `<div className={cn("flex flex-wrap items-center gap-2", className)}>` using `cn()` from `@/lib/utils`.
- **Empty state:** Return `null` when `pills.length === 0`.
- **Accessibility:** Each dismiss button gets `aria-label={`Remove ${label}: ${value} filter`}`.
- **Icons:** Import `X` from `lucide-react` (already used in `VideoSearch.tsx`).
- **Tests (TDD — write FIRST):**
  - Renders pills with correct `label: value` text
  - Dismiss button calls `onDismiss` for correct pill
  - "Clear all" shown when 2+ pills, hidden when 0-1 pills
  - "Clear all" calls `onClearAll` callback
  - Returns null when `pills` array is empty
  - Each dismiss button has correct aria-label
  - Follow pattern from `src/components/discovery/__tests__/ContentTypeFilter.test.tsx` — `userEvent.setup()`, `vi.fn()`, `render`, `screen`

**What Could Break:**
- Badge `secondary` variant visual weight — if it doesn't match filter dropdown styling (`bg-muted`), use `className` override on Badge.

**Done When:**
- [ ] FilterPillBar renders pills with label:value format
- [ ] X button on each pill calls its onDismiss callback
- [ ] "Clear all" appears when 2+ pills, calls onClearAll
- [ ] Empty pills array renders nothing (null return)
- [ ] All tests pass

### Chunk 2: Integrate into Discovery Page

**Goal:** Wire FilterPillBar into DiscoveryContent. Map channel and type URL params to pills. Dismiss updates URL and resets page.

**Files:**
- `src/components/discovery/DiscoveryContent.tsx` — modify

**Implementation Details:**
- **Import:** `import { FilterPillBar } from '@/components/filters/FilterPillBar'` and `import type { FilterPill } from '@/components/filters/FilterPillBar'`
- **Build pills array** using `useMemo` — derive from existing state already in DiscoveryContent:
  ```tsx
  const filterPills = useMemo(() => {
    const pills: FilterPill[] = []
    if (selectedChannel) {
      const channelName = channels.find(c => c.id === selectedChannel)?.name ?? selectedChannel
      pills.push({
        label: 'Creator',
        value: channelName,
        onDismiss: () => updateParams({ channel: null, page: null }),
      })
    }
    if (contentType !== 'all') {
      const typeLabel = contentType === 'saved' ? 'Saved' : 'Not Saved'
      pills.push({
        label: 'Status',
        value: typeLabel,
        onDismiss: () => updateParams({ type: null, page: null }),
      })
    }
    return pills
  }, [selectedChannel, channels, contentType, updateParams])
  ```
  - `selectedChannel` is read from `searchParams.get('channel')` (already at line ~63)
  - `channels` is the existing `useState<Channel[]>` (already at line ~37)
  - `contentType` is validated from `searchParams.get('type')` (already at line ~68)
  - `updateParams` is from `useURLParams()` (already at line ~60)
- **"Clear all" handler:**
  ```tsx
  const handleClearAllFilters = useCallback(() => {
    updateParams({ channel: null, type: null, page: null })
  }, [updateParams])
  ```
- **Insert JSX** — between filter controls and video content. After the `</div>` closing the flex header row with channel dropdown + content type filter, before the video grid section:
  ```tsx
  <FilterPillBar
    pills={filterPills}
    onClearAll={handleClearAllFilters}
    className="mb-4"
  />
  ```
- **No test file changes needed** — DiscoveryContent has no existing unit tests. The FilterPillBar's own tests cover component behavior.

**What Could Break:**
- Channel name lookup timing — `channels` loads async. Safe: pills only show when channel IS selected (user already saw the name).
- Pill dismiss resets page — intentional, matches existing `handleChannelChange` behavior.

**Done When:**
- [ ] Discovery shows `[Creator: Fireship ×]` when channel filter active
- [ ] Discovery shows `[Status: Not Saved ×]` when type filter active
- [ ] Dismissing a pill clears that filter and resets page
- [ ] "Clear all" clears all filters and resets page
- [ ] No pill bar visible when no filters active
- [ ] Existing Discovery functionality unchanged

### Chunk 3: Integrate into Knowledge Bank Page

**Goal:** Wire FilterPillBar into KnowledgeBankContent. Map type and search query URL params to pills. Verify search dismiss cascades to VideoSearch input.

**Files:**
- `src/components/knowledge-bank/KnowledgeBankContent.tsx` — modify

**Implementation Details:**
- **Import:** `import { FilterPillBar } from '@/components/filters/FilterPillBar'` and `import type { FilterPill } from '@/components/filters/FilterPillBar'`
- **Build pills array** using `useMemo`:
  ```tsx
  const filterPills = useMemo(() => {
    const pills: FilterPill[] = []
    if (contentType !== 'all') {
      const typeLabel = contentType === 'youtube' ? 'YouTube' : 'Transcript'
      pills.push({
        label: 'Type',
        value: typeLabel,
        onDismiss: () => updateParams({ type: null }),
      })
    }
    if (urlQuery.trim()) {
      pills.push({
        label: 'Search',
        value: `"${urlQuery}"`,
        onDismiss: () => updateParams({ q: null }),
      })
    }
    return pills
  }, [contentType, urlQuery, updateParams])
  ```
  - `contentType` is validated from `searchParams.get('type')` (already at line ~55-57)
  - `urlQuery` is `searchParams.get('q') || ''` (already at line ~49)
  - `updateParams` is from `useURLParams()` (already at line ~48)
- **"Clear all" handler:**
  ```tsx
  const handleClearAllFilters = useCallback(() => {
    updateParams({ type: null, q: null })
  }, [updateParams])
  ```
- **Insert JSX** — after the PersonaPanel section, before the ContentTypeFilter/content area. Around line 233 after the closing `</div>` of the persona panel section:
  ```tsx
  <FilterPillBar
    pills={filterPills}
    onClearAll={handleClearAllFilters}
    className="mb-4"
  />
  ```
- **Search dismiss cascade:** `updateParams({ q: null })` → URL changes → `urlQuery` becomes `''` → `VideoSearch` receives `defaultValue=""` → internal state syncs via `useEffect` (VideoSearch line ~26-29) → `showSearchResults` becomes false → results hide. PersonaPanel also clears since `isQueryQuestion` checks `urlQuery`.

**What Could Break:**
- Search pill dismiss vs PersonaPanel — clearing `urlQuery` to `''` cascades correctly: `isQueryQuestion` becomes false, `useEnsemble` receives `null`. Verified.
- ContentTypeFilter still visible — intentional, pills are additive secondary indicators.

**Done When:**
- [ ] KB shows `[Type: YouTube ×]` when content type filter active
- [ ] KB shows `[Search: "react hooks" ×]` when search query active
- [ ] Dismissing search pill clears VideoSearch input
- [ ] Dismissing type pill resets to "all"
- [ ] "Clear all" clears both filters
- [ ] No pill bar visible when no filters active
- [ ] PersonaPanel clears when search pill dismissed
- [ ] All existing tests pass
