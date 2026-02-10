---
name: content-type-filter
title: "Add content type filter to discovery page"
status: active
cycle: polish-reliability
story_number: 5
priority: medium
created: 2026-02-10
updated: 2026-02-10
chunks_total: 2
chunks_complete: 0
---

# Story: Add content type filter to discovery page

## Spark
Users want to filter discovery content by type - seeing only unprocessed videos, only transcripts (processed videos), or both. This complements the existing channel filter to provide better content discovery and organization.

## Scope
**Included:**
- Content type filter dropdown component
- Filter logic for videos vs transcripts based on `inBank` property
- Integration with existing channel filter (both filters work together)
- Visual indication of filter state

**Excluded:**
- Changes to API data structure
- Modifying how `inBank` is determined
- Advanced filtering (date ranges, search, etc.)

## Preserve
- Existing channel filter dropdown functionality
- Discovery page layout and responsive behavior
- DiscoveryVideoGrid pagination behavior
- Existing discovery page tests

## Hardest Constraint
Composing two client-side filters (channel + content type) in a single useMemo without introducing complexity. Both filters must work independently and together.

## Technical Concerns
- None significant — this is a direct copy of the ChannelFilterDropdown pattern with static options

## Dependencies
**Blocked by:** none
**Blocks:** none

## Decisions

### Filter Pattern
**Decision:** Follow ChannelFilterDropdown pattern exactly (shadcn DropdownMenu, pill-shaped trigger)
**Rationale:** Identical UX pattern already exists in the app. Consistent look and behavior.

### Filter Labels
**Decision:** "All", "Videos", "Transcripts"
**Rationale:** User preference. "Videos" = not in bank (inBank: false), "Transcripts" = in bank (inBank: true).

### Filter State
**Decision:** Ephemeral React state (no localStorage persistence)
**Rationale:** Same as channel filter — page-scoped, not a global preference.

## Acceptance
- [ ] User can select "All", "Videos", or "Transcripts" from a filter dropdown
- [ ] Content type filter works alongside channel filter (both applied simultaneously)
- [ ] Filter state is visually clear to the user (trigger shows selected label)
- [ ] "Videos" shows items where `inBank: false`
- [ ] "Transcripts" shows items where `inBank: true`
- [ ] Default state shows all content ("All" selected)
- [ ] Filter persists during refresh actions
- [ ] Responsive design works on mobile

## Chunks

### Chunk 1: ContentTypeFilter component

**Goal:** Create a standalone dropdown component that lets users filter by content type, following the ChannelFilterDropdown pattern exactly.

**Files:**
- `src/components/discovery/ContentTypeFilter.tsx` — **create**
- `src/components/discovery/__tests__/ContentTypeFilter.test.tsx` — **create**

**Implementation Details:**
- Copy ChannelFilterDropdown pattern from `src/components/discovery/ChannelFilterDropdown.tsx`
- Props interface: `{ selected: 'all' | 'videos' | 'transcripts', onChange: (value: 'all' | 'videos' | 'transcripts') => void }`
- Export the type: `export type ContentTypeValue = 'all' | 'videos' | 'transcripts'`
- shadcn `DropdownMenu` with pill-shaped trigger: `rounded-full px-4 py-1.5 text-sm bg-muted hover:bg-muted/80 transition-colors`
- Trigger text: "All", "Videos", or "Transcripts" based on `selected` prop
- `ChevronDown` icon from `lucide-react` in trigger (`h-4 w-4 opacity-50`)
- Menu items: "All" at top, "Videos", "Transcripts" — no separator needed (only 3 items)
- Clicking an option calls `onChange` with the corresponding value
- Tests: render with each selected value, verify trigger text, open menu and verify all 3 items, click each and verify callback

**What Could Break:**
- Nothing significant — straightforward static dropdown

**Done When:**
- [ ] Component renders with correct trigger text for each selected value
- [ ] Dropdown lists all 3 options
- [ ] Selecting an option calls `onChange` with the correct value
- [ ] Tests pass

### Chunk 2: Integrate filter into Discovery page

**Goal:** Wire the ContentTypeFilter into the discovery page header, compose with existing channel filter in `filteredVideos` useMemo.

**Files:**
- `src/app/discovery/page.tsx` — modify (add state, extend useMemo, render in header between channel filter and refresh button)
- `src/app/discovery/__tests__/page.test.tsx` — modify (add content type filter integration tests)

**Implementation Details:**
- Import `ContentTypeFilter` and `ContentTypeValue` from `@/components/discovery/ContentTypeFilter`
- Add state: `const [contentType, setContentType] = useState<ContentTypeValue>('all')`
- Extend `filteredVideos` useMemo to chain both filters:
  ```
  let result = discoveryVideos
  if (selectedChannelId) result = result.filter(v => v.channelId === selectedChannelId)
  if (contentType === 'videos') result = result.filter(v => !v.inBank)
  if (contentType === 'transcripts') result = result.filter(v => v.inBank)
  return result
  ```
- Add `contentType` to useMemo dependency array
- Render `<ContentTypeFilter selected={contentType} onChange={setContentType} />` in header, between ChannelFilterDropdown and Refresh button
- Only render when `channels.length > 0` (same guard as channel filter)
- Layout: `[FollowInput] [Channel ▼] [Content Type ▼] [Refresh]`
- Tests: verify dropdown renders, select "Videos" and verify only inBank:false shown, select "Transcripts" and verify only inBank:true shown, verify both filters compose together

**What Could Break:**
- Header layout on narrow screens — already using flex-wrap, should be fine
- Need test data with mixed inBank values to test filtering

**Done When:**
- [ ] Content type dropdown appears on discovery page when channels are followed
- [ ] Selecting "Videos" shows only items where inBank is false
- [ ] Selecting "Transcripts" shows only items where inBank is true
- [ ] Selecting "All" shows all items
- [ ] Both filters work together (channel + content type)
- [ ] Existing discovery page tests still pass
- [ ] `npm test` passes clean

## Notes
- `DiscoveryVideo` interface at `src/components/discovery/DiscoveryVideoCard.tsx` line 18 has `inBank: boolean`
- `ChannelFilterDropdown` at `src/components/discovery/ChannelFilterDropdown.tsx` is the exact pattern to replicate
- Discovery page `filteredVideos` useMemo at line 151 currently only handles channel filter — extend it
- Both filters are ephemeral React state, no persistence needed
