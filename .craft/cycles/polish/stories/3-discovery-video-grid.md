---
name: discovery-video-grid
title: Discovery Page Video Grid Redesign
status: active
priority: medium
created: 2026-02-08
updated: 2026-02-08
chunks_total: 4
chunks_complete: 0
---

# Story: Discovery Page Video Grid Redesign

## Spark
Replace the Discovery page's horizontal-scroll tile sections with a unified YouTube-style video grid. One big responsive grid of all discovery videos, client-side pagination, newest first. Show focus area badges on cards that are already in the Knowledge Bank.

## Scope

**Included:**
- Replace horizontal scroll sections with one unified responsive video grid
- Client-side pagination (fetch all RSS videos, paginate in browser, ~24 per page)
- Focus area badges on Discovery cards for videos already in Knowledge Bank
- Responsive columns (1→2→3→4→5 across breakpoints)
- Keep FollowChannelInput and channel management flow

**Excluded:**
- Search/filter on the discovery page (separate story)
- Video recommendations or "for you" algorithm
- Changes to the Knowledge Bank (home page) grid
- Server-side pagination or RSS caching
- Focus area quick-assign from Discovery (badges only, no dropdown)

## Preserve
- FollowChannelInput and channel follow/unfollow flow
- DiscoveryVideoCard "Add to Bank" / "In Bank" pattern
- Existing VideoCard on Knowledge Bank page (untouched)
- RSS data fetching via `/api/channels/videos`
- Channel management via `/api/channels`

## Hardest Constraint
RSS feeds are fetched live from YouTube. With many channels, initial load could be slow. Client-side pagination avoids repeated fetches but requires good skeleton loading state during the initial fetch.

## Dependencies
**Blocked by:** None
**Blocks:** None

## Decisions

### Layout
**Type:** layout
**Choice:** Replace all horizontal scroll sections with one unified grid. No more CatchUpSection/ChannelSection/SimilarCreatorsSection as separate horizontal scroll areas.

### Pagination
**Type:** component
**Choice:** Client-side pagination. Fetch all RSS videos on page load, paginate locally. 24 videos per page.

### Focus Areas on Discovery
**Type:** component
**Choice:** Show focus area badges on Discovery cards for videos already in the Knowledge Bank. Lookup by youtubeId. No quick-assign dropdown on Discovery.

### Design Lock Override
**Type:** technical
**Choice:** Unlock locked.md Discovery Feed section to permit grid layout and pagination (previously prohibited).

## Visual Direction
**Vibe:** YouTube browse page — content-dense but clean
**Feel:** Scannable, inviting, content-forward
**Inspiration:** YouTube home, Netflix browse
**Key tokens:** Existing card patterns, consistent thumbnail aspect ratios, gap-6 grid spacing

## Acceptance
- [ ] Given the Discovery page, when loaded, then all videos display in a responsive grid (not horizontal scroll sections)
- [ ] Given more than 24 videos, when viewing the grid, then pagination controls appear at the bottom
- [ ] Given a narrow viewport (mobile), when viewing the grid, then cards stack into fewer columns gracefully
- [ ] Given the grid, when clicking a video card, then navigation to video detail works correctly
- [ ] Given a video in the Knowledge Bank with focus areas, when shown on Discovery, then focus area badges display on its card
- [ ] Given a new channel is followed, when the page updates, then new videos appear in the grid
- [ ] Given no channels are followed, when viewing Discovery, then an appropriate empty state shows

## Definition of Done
- [ ] All chunks complete
- [ ] All acceptance criteria verified
- [ ] Tests written and passing
- [ ] Preserve list confirmed intact
- [ ] No regressions in related features
- [ ] Build passes

## Chunks

### Chunk 1: Unlock Design + Build Pagination Component

**Goal:** Update locked.md to permit grid layout and pagination on Discovery. Create a reusable Pagination component.

**Files:**
- `.craft/design/locked.md` — modify (unlock grid + pagination for Discovery)
- `src/components/discovery/Pagination.tsx` — create

**Implementation Details:**
- Update locked.md Discovery Feed section: replace "Not Allowed: Grid layout" and "Not Allowed: Pagination" with the new permitted patterns
- Build Pagination component: page numbers, prev/next buttons, disabled states
- Use shadcn Button for controls, `cn()` for styling
- Props: `{ currentPage: number, totalPages: number, onPageChange: (page: number) => void }`
- Accessible: aria-labels, keyboard navigable, current page indicator (aria-current)
- Style: primary color for active page, muted for others, disabled opacity for prev/next at bounds
- Show max ~7 page buttons with ellipsis for large page counts

**What Could Break:**
- Nothing — additive component, documentation change

**Done When:**
- [ ] locked.md updated to permit grid + pagination on Discovery
- [ ] Pagination component renders correctly with page numbers
- [ ] Prev/next buttons disabled at bounds
- [ ] onPageChange fires with correct page number
- [ ] Ellipsis shows for large page counts
- [ ] Component is accessible (aria-current, keyboard nav)

### Chunk 2: Adapt DiscoveryVideoCard for Grid + Focus Area Badges

**Goal:** Make DiscoveryVideoCard work in grid layout (remove hardcoded scroll classes) and show focus area badges for videos that are in the Knowledge Bank.

**Files:**
- `src/components/discovery/DiscoveryVideoCard.tsx` — modify (remove scroll classes, add focus area badges)
- `src/components/discovery/ChannelSection.tsx` — modify (pass scroll classes explicitly via className)

**Implementation Details:**
- Remove `min-w-[240px] snap-start shrink-0` from DiscoveryVideoCard's default classes
- In ChannelSection (if still used anywhere), pass these as `className` prop where scroll layout is needed
- Add optional prop `focusAreas?: { id: number, name: string, color: string }[]` to DiscoveryVideoCard
- When `focusAreas` is provided and non-empty, render Badge components below the date (same pattern as VideoCard on Knowledge Bank)
- CatchUpSection already passes `className="min-w-0"` — verify it still works or is no longer needed

**What Could Break:**
- If ChannelSection is still imported elsewhere, scroll classes must be passed explicitly
- CatchUpSection grid layout should be unaffected (it already overrides with className)

**Done When:**
- [ ] DiscoveryVideoCard fills grid cell naturally (no fixed min-width)
- [ ] Focus area badges display on cards where focusAreas prop is provided
- [ ] Cards without focusAreas render normally (no badges)
- [ ] Existing horizontal scroll usage (if any remains) still works with explicit className

### Chunk 3: Build DiscoveryVideoGrid Component

**Goal:** Create a grid component for discovery videos with client-side pagination. Takes all videos, slices by page, displays in responsive grid.

**Files:**
- `src/components/discovery/DiscoveryVideoGrid.tsx` — create

**Implementation Details:**
- Props: `{ videos: DiscoveryVideo[], isLoading?: boolean, focusAreaMap?: Record<string, { id: number, name: string, color: string }[]> }`
- `focusAreaMap` keyed by youtubeId — Discovery page looks up which videos are in the bank and their focus areas
- Client-side pagination: `useState` for currentPage, 24 videos per page, calculate totalPages
- Responsive grid: `grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Loading state: 24 DiscoveryVideoCardSkeleton in grid layout
- Empty state: message when no videos ("Follow channels to discover videos")
- Render Pagination at bottom when totalPages > 1
- Pass `focusAreas` from focusAreaMap to each DiscoveryVideoCard by matching youtubeId
- Sort videos by publishedAt descending (newest first)
- Scroll to top of grid on page change

**What Could Break:**
- DiscoveryVideo type might not have publishedAt for sorting — verify and fall back to order received
- Performance with 300+ videos client-side should be fine (just array slicing)

**Done When:**
- [ ] Grid renders discovery videos in responsive columns
- [ ] Pagination shows at bottom when needed, navigates between pages
- [ ] Page change scrolls to top of grid
- [ ] Loading state shows skeleton grid
- [ ] Empty state shows appropriate message
- [ ] Focus area badges appear on in-bank videos via focusAreaMap
- [ ] Videos sorted newest first

### Chunk 4: Restructure Discovery Page + Tests

**Goal:** Rewrite the Discovery page to use DiscoveryVideoGrid instead of horizontal scroll sections. Aggregate all channel videos into one grid. Preserve channel management flow.

**Files:**
- `src/app/discovery/page.tsx` — modify (major rewrite)
- `src/app/discovery/__tests__/page.test.tsx` — modify (update for new structure)
- `src/components/discovery/__tests__/DiscoveryVideoGrid.test.tsx` — create
- `src/components/discovery/__tests__/Pagination.test.tsx` — create

**Implementation Details:**
- Remove CatchUpSection, ChannelSection, SimilarCreatorsSection imports and usage
- Keep FollowChannelInput at the top for adding channels
- Fetch all channel videos via `/api/channels/videos` endpoint (no `since` filter — get everything)
- Look up which videos are in the Knowledge Bank: fetch `/api/videos` to get video youtubeIds, build focusAreaMap from the response
- Aggregate all discovery videos into one sorted list, pass to DiscoveryVideoGrid with focusAreaMap
- Keep channel follow/unfollow handlers — on follow/unfollow, refetch videos
- Loading state: pass `isLoading` to DiscoveryVideoGrid
- Update page tests: test grid renders, pagination works, follow/unfollow triggers refetch, empty state
- Add tests for DiscoveryVideoGrid (loading, empty, pagination, focus area badges) and Pagination (page changes, bounds, accessibility)

**What Could Break:**
- Removing section components changes all data fetching flow — moves to page level
- `/api/channels/videos` may be slow with many channels (parallel RSS fetches) — skeleton loading covers this
- Page test rewrite is significant (292 lines currently)

**Done When:**
- [ ] Discovery page shows all videos in a unified responsive grid
- [ ] Pagination works at bottom of grid
- [ ] Following a new channel refetches and shows new videos
- [ ] Unfollowing removes that channel's videos
- [ ] Videos in the Knowledge Bank show focus area badges
- [ ] Loading state shows skeleton grid
- [ ] Empty state (no channels followed) shows helpful message
- [ ] All tests pass including new component tests
- [ ] `npm test` and `npm run build` pass

## Notes
Key files:
- `src/app/discovery/page.tsx` — Discovery page (major rewrite)
- `src/components/discovery/DiscoveryVideoCard.tsx` — adapt for grid + focus area badges
- `src/components/discovery/DiscoveryVideoGrid.tsx` — new grid component
- `src/components/discovery/Pagination.tsx` — new pagination component
- `.craft/design/locked.md` — unlock grid + pagination for Discovery

File Impact:
| File | Chunks | Action |
|------|--------|--------|
| `.craft/design/locked.md` | 1 | modify |
| `src/components/discovery/Pagination.tsx` | 1 | create |
| `src/components/discovery/DiscoveryVideoCard.tsx` | 2 | modify |
| `src/components/discovery/ChannelSection.tsx` | 2 | modify |
| `src/components/discovery/DiscoveryVideoGrid.tsx` | 3 | create |
| `src/app/discovery/page.tsx` | 4 | modify |
| Test files (3) | 4 | create/modify |

Dependencies: Chunk 2 requires 1. Chunk 3 requires 2. Chunk 4 requires 1-3.
