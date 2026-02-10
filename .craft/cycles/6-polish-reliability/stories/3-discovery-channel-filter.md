---
name: discovery-channel-filter
title: Discovery channel filter dropdown
status: active
priority: medium
created: 2026-02-09
updated: 2026-02-10
cycle: polish-reliability
story_number: 3
chunks_total: 2
chunks_complete: 0
---

# Story: Discovery channel filter dropdown

## Spark
The discovery page shows all videos from all followed channels in a unified grid. When you follow many channels, it's hard to browse a specific creator's content. Add a dropdown to filter discovery videos by a single followed channel, letting users focus on one creator at a time.

## Scope

**Included:**
- Create ChannelFilterDropdown component following FocusAreaDropdown pattern
- Integrate into discovery page header
- Client-side filtering via `useMemo`
- Pagination auto-reset on filter change (existing mechanism)
- Tests for component and integration

**Excluded:**
- Filter persistence (ephemeral state, resets on page reload)
- Server-side filtering
- Multi-select channel filter
- API changes

## Preserve
- Discovery page existing layout and functionality
- Client-side pagination (24 per page)
- FollowChannelInput and Refresh button in header
- Empty state when no channels followed
- Existing discovery page tests

## Hardest Constraint
Header layout on narrow screens — need to fit the filter dropdown alongside FollowChannelInput and Refresh button without crowding.

## Technical Concerns
- Channel matching: use `channelId` (YouTube channel ID) since both `Channel` and `DiscoveryVideo` share this field
- Pagination resets automatically via existing `videosKey` mechanism in DiscoveryVideoGrid — no extra work needed

## Dependencies
**Blocked by:** none
**Blocks:** none

## Decisions

### Filter Pattern
**Decision:** Follow FocusAreaDropdown pattern (shadcn DropdownMenu, pill-shaped trigger)
**Rationale:** Exact same UX pattern exists in the app. Consistent look and behavior.

### Filter State
**Decision:** Ephemeral React state (no localStorage persistence)
**Rationale:** Page-level filter, not a global app preference. FocusAreas persist because they're cross-page; discovery channel filter is page-scoped.

## Acceptance
- [ ] Given the discovery page, when channels are followed, then a dropdown appears listing all followed channels
- [ ] Given the channel filter dropdown, when a user selects a channel, then only that channel's videos are shown in the grid
- [ ] Given a channel is selected, when the user selects "All Channels", then all channels' videos are shown again
- [ ] Given no channels are followed, when viewing discovery, then no filter dropdown appears
- [ ] Given a filter is active and videos are paginated, when the filter changes, then pagination resets to page 1

## Chunks

### Chunk 1: ChannelFilterDropdown component

**Goal:** Create a standalone dropdown component that lets users select a followed channel to filter by, following the FocusAreaDropdown pattern.

**Files:**
- `src/components/discovery/ChannelFilterDropdown.tsx` — **create**
- `src/components/discovery/__tests__/ChannelFilterDropdown.test.tsx` — **create**

**Implementation Details:**
- Follow FocusAreaDropdown pattern exactly (`src/components/layout/FocusAreaDropdown.tsx`)
- Props interface: `{ channels: Channel[], selectedChannelId: string | null, onChannelChange: (channelId: string | null) => void }`
- shadcn `DropdownMenu` with pill-shaped trigger: `rounded-full px-4 py-1.5 text-sm bg-muted hover:bg-muted/80 transition-colors`
- Trigger text: selected channel name, or "All Channels" when `selectedChannelId` is null
- `ChevronDown` icon from `lucide-react` in trigger (`h-4 w-4 opacity-50`)
- Menu items: "All Channels" at top → `DropdownMenuSeparator` → each channel's `name`
- Clicking "All Channels" calls `onChannelChange(null)`, clicking a channel calls `onChannelChange(channel.channelId)`
- Tests: render with channels list, verify default trigger text, open menu and verify items, select channel and verify callback, select "All Channels" and verify null callback

**What Could Break:**
- Channel `channelId` vs `id` — use `channelId` (YouTube channel ID) to match against `DiscoveryVideo.channelId`

**Done When:**
- [ ] Component renders with "All Channels" default trigger text
- [ ] Dropdown lists all provided channels by name
- [ ] Selecting a channel calls `onChannelChange` with the channel's `channelId`
- [ ] Selecting "All Channels" calls `onChannelChange(null)`
- [ ] Tests pass

### Chunk 2: Integrate filter into Discovery page

**Goal:** Wire the dropdown into the discovery page header, add filtering state, and pass filtered videos to the grid.

**Files:**
- `src/app/discovery/page.tsx` — modify (add state, useMemo filter, render dropdown in header ~lines 170-189)
- `src/app/discovery/__tests__/page.test.tsx` — modify (add filter integration tests)

**Implementation Details:**
- Add state: `const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)`
- Compute filtered videos: `const filteredVideos = useMemo(() => selectedChannelId ? discoveryVideos.filter(v => v.channelId === selectedChannelId) : discoveryVideos, [discoveryVideos, selectedChannelId])`
- Pass `filteredVideos` to `DiscoveryVideoGrid` instead of raw `discoveryVideos`
- Render `ChannelFilterDropdown` in header between `FollowChannelInput` and Refresh button
- Only render when `channels.length > 0` (matches existing empty state guard)
- Pagination auto-resets via existing `videosKey` mechanism in DiscoveryVideoGrid
- Tests: mock fetch to return channels + videos, verify dropdown renders, select a channel and verify grid shows only that channel's videos, verify "All Channels" shows all

**What Could Break:**
- Header layout on narrow screens — verify dropdown flows naturally with flex-wrap
- Selected channel has zero videos in feed — grid shows its existing empty state (acceptable)

**Done When:**
- [ ] Dropdown appears on discovery page when channels are followed
- [ ] Selecting a channel filters the video grid to only that channel's videos
- [ ] Selecting "All Channels" shows all videos again
- [ ] Pagination resets to page 1 when filter changes
- [ ] No dropdown when no channels are followed
- [ ] Existing discovery page tests still pass

## Notes
- Discovery page is at `src/app/discovery/page.tsx`
- Videos are currently client-side paginated (24 per page), sorted by publishedAt descending
- FocusAreaDropdown at `src/components/layout/FocusAreaDropdown.tsx` is the exact pattern to replicate
- Both `Channel` and `DiscoveryVideo` objects have a `channelId` field (YouTube channel ID) for matching
