---
name: discovery-following
title: Discovery & Following
status: active
priority: high
created: 2026-02-05
updated: 2026-02-07
cycle: experience
story_number: 2
chunks_total: 5
chunks_complete: 4
current_chunk: 5
---

# Story: Discovery & Following

## Spark

Build the discovery page as the command center for staying current. Two core sections: Catch-up (new content since last visit, chronological) and Following (channel management with video cards). Users paste a YouTube channel URL to follow a creator, see their latest videos in horizontal scroll cards, and can "Add to Bank" directly. Catch-up shows unread content since last visit.

Merges the backlog "Discovery Feed" story into a cohesive discovery experience.

> *"I wanna catch up. Give me a catch up page. Where I don't have to watch all the videos and just lets me read it like their news articles and, like, this is very important. You probably read this one, and it just gives me a catch up since the last time that I looked at the page."*

**Key decisions:**
- Catch-up: simple chronological ordering (newest first), not importance-ranked
- Track "last visited" timestamp (localStorage for MVP, can move to DB later)
- Channel following UI: paste URL, parse formats (@handle, /channel/, /c/), follow/unfollow
- Horizontal scroll cards per channel with "Add to Bank" / "In Bank" badges
- Reuse existing automation infrastructure (RSS parsing, delta detection, channels table)

## Visual Direction

**Vibe:** Dashboard Tiles
**Feel:** Consistent, visual-first, YouTube-familiar
**Inspiration:** YouTube's subscription feed, Apple TV+ browse

**Layout:**
```
┌──────────────────────────────────────────────┐
│  [Follow a Channel.....................] [+] │
│                                              │
│  ── Catch Up (3 new) ──────────────────────  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 🟢thumb  │ │ 🟢thumb  │ │  thumb   │     │
│  │ Title    │ │ Title    │ │ Title    │     │
│  │ @chan 2h │ │ @chan 5h │ │ @chan 1d │     │
│  │[Add Bank]│ │[✓ Bank] │ │[Add Bank]│     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  ── @Fireship ──────────────── Unfollow ──   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ →  │
│  │  thumb   │ │  thumb   │ │  thumb   │     │
│  └──────────┘ └──────────┘ └──────────┘     │
└──────────────────────────────────────────────┘
```

**Key Elements:**
- Cards throughout: reuse VideoCard in compact horizontal variant
- Green dot badge on catch-up cards for "new since last visit"
- Section headers with inline actions (Unfollow, channel name)
- Follow input at top as prominent search-style bar
- Horizontal scroll with CSS scroll-snap per channel
- "In Bank" badge pops in, "Add to Bank" button on unbanked videos

**Motion:**
- Skeleton shimmer while loading channels and videos (table-stakes)
- Hover lift on video cards (existing pattern, scale 1.02 + shadow)
- Follow input expand/collapse transition
- "In Bank" badge state transition
- Horizontal scroll momentum with scroll-snap

## Dependencies

**Blocked by:** None
**Blocks:** Story 3 (Similar Creators needs following infrastructure)

## Acceptance

- [ ] Users can paste a YouTube channel URL (@handle, /channel/, /c/ formats) to follow a creator
- [ ] Followed channels show in vertical sections with horizontal scroll video cards
- [ ] Each video card shows thumbnail, title, date, and "Add to Bank" or "In Bank" badge
- [ ] "Add to Bank" navigates to /add page with URL prefilled
- [ ] Catch-up section shows videos published since last visit, ordered chronologically
- [ ] Green dot badge on new-since-last-visit videos
- [ ] "All caught up" empty state when no new content
- [ ] Unfollow button removes channel from following list
- [ ] Refresh button re-fetches all channel feeds
- [ ] Horizontal scroll with snap behavior per channel row
- [ ] Skeleton loading while fetching channel data
- [ ] Responsive layout works on mobile viewports

## Chunks

### Chunk 1: Channel URL Parser & Follow API

**Goal:** Create channel URL parsing for all YouTube formats and API routes for following/unfollowing channels with their video feeds.

**Files:**
- `src/lib/youtube/channel-parser.ts` — create (parse @handle, /c/, /channel/ URLs to channel ID)
- `src/lib/youtube/__tests__/channel-parser.test.ts` — create
- `src/app/api/channels/route.ts` — create (GET all followed channels, POST follow new channel)
- `src/app/api/channels/[id]/route.ts` — create (DELETE unfollow)
- `src/app/api/channels/[id]/videos/route.ts` — create (GET videos for channel with "inBank" flag)

**Implementation Details:**
- Channel parser: regex patterns for `youtube.com/@handle`, `youtube.com/channel/UCXXX`, `youtube.com/c/name`
- For @handle format: attempt RSS feed URL with handle -> if feed returns, extract channel ID from feed XML; fallback: fetch channel page and scrape `channel_id` meta tag
- GET `/api/channels`: query all from channels table, return array with autoFetch, lastFetchedAt fields
- POST `/api/channels`: accept `url` string, parse to channel ID, fetch RSS to get channel name + validate, insert into channels table, return channel
- DELETE `/api/channels/[id]`: remove from channels table (cascade will handle related data)
- GET `/api/channels/[id]/videos`: call `fetchChannelFeed()` from existing RSS infrastructure, cross-reference with videos table to set `inBank: boolean` on each result
- Follow existing route patterns from `src/app/api/channels/[id]/automation/route.ts`
- Zod validation on all inputs

**What Could Break:**
- @handle resolution depends on YouTube not blocking server-side requests
- RSS feed URL requires the `channel_id` format (UCXXX), not @handle — may need resolution step
- Rate limiting on rapid follows

**Done When:**
- [ ] Channel URL parser handles all 3 formats with tests
- [ ] POST follow creates channel entry and fetches initial feed
- [ ] GET videos returns RSS videos with inBank flag
- [ ] DELETE unfollow removes channel
- [ ] All routes have Zod validation

---

### Chunk 2: Discovery Page — Following Section

**Goal:** Build the channel following section with horizontal scroll video cards, follow input, and unfollow action.

**Files:**
- `src/app/discovery/page.tsx` — modify (replace placeholder with full discovery page)
- `src/components/discovery/FollowChannelInput.tsx` — create (URL input with follow button)
- `src/components/discovery/ChannelSection.tsx` — create (channel header + horizontal scroll row)
- `src/components/discovery/DiscoveryVideoCard.tsx` — create (compact card for horizontal scroll)

**Implementation Details:**
- Page layout: follow input at top, then channel sections listed vertically
- FollowChannelInput: search-style bar with `[Follow a Channel...] [+]` pattern, validates URL, calls POST API, shows loading/error states
- Use existing shadcn Collapsible for expand/collapse animation on follow input
- ChannelSection: header row with channel name, @handle, "Last updated X ago", Unfollow button; below: horizontal scroll row of video cards
- Horizontal scroll: `overflow-x-auto scroll-snap-type-x-mandatory` on container, `scroll-snap-align-start` on cards, min-width per card (~240px)
- DiscoveryVideoCard: compact variant — thumbnail (16:9, smaller), title (2-line clamp), published date, "Add to Bank" button or "In Bank" badge
- "Add to Bank" -> navigate to `/add?url=https://youtube.com/watch?v=VIDEOID`
- "In Bank" badge: green checkmark Badge component with `variant="secondary"`
- Empty state when no channels followed: guide text with example URLs
- Skeleton loading: row of VideoCardSkeleton while fetching RSS

**What Could Break:**
- Horizontal scroll needs touch-friendly behavior on mobile
- Too many channels could cause slow page load (each needs RSS fetch)

**Done When:**
- [ ] Follow input parses URL and adds channel
- [ ] Channel sections show with horizontal scroll video cards
- [ ] "Add to Bank" navigates to /add with URL prefilled
- [ ] "In Bank" badge shows for videos already in Knowledge Bank
- [ ] Unfollow removes channel section
- [ ] Empty state guides users to add first channel
- [ ] Skeleton loading while fetching

---

### Chunk 3: Catch-Up Section & Last Visited Tracking

**Goal:** Build the catch-up section showing new videos since last visit across all followed channels, ordered chronologically.

**Files:**
- `src/hooks/useLastVisited.ts` — create (localStorage sync hook for last visited timestamp)
- `src/components/discovery/CatchUpSection.tsx` — create (chronological grid of new-since-last-visit videos)
- `src/app/discovery/page.tsx` — modify (add catch-up section above following sections)
- `src/app/api/channels/videos/route.ts` — create (GET all videos across followed channels, with sinceTimestamp filter)

**Implementation Details:**
- `useLastVisited()`: reads/writes `gold-miner-last-visited` from localStorage, returns `{lastVisitedAt, markVisited}`, auto-calls `markVisited()` on page mount (after initial render to capture "new" state first)
- API: GET `/api/channels/videos?since=ISO_TIMESTAMP` — fetches all followed channels' RSS feeds via Promise.all(), filters to videos published after `since`, sorts chronologically (newest first), adds inBank flag
- CatchUpSection: header "Catch Up (N new)", grid of DiscoveryVideoCard with green dot badge overlaid on new items
- Green dot: `absolute top-2 left-2 h-3 w-3 rounded-full bg-primary` on card (primary green)
- If no new videos: show "You're all caught up!" message
- Section only renders when lastVisitedAt is set (not first visit)
- First visit fallback: show all recent videos (last 7 days)

**What Could Break:**
- Promise.all() on many channels could be slow or timeout — consider aborting after 10 seconds
- publishedAt from RSS may differ from actual upload time (YouTube quirk)

**Done When:**
- [ ] Last visited timestamp persists in localStorage
- [ ] Catch-up section shows videos published since last visit
- [ ] Green dot badge on new videos
- [ ] Chronological ordering (newest first)
- [ ] "All caught up" empty state
- [ ] First visit shows recent videos (fallback)

---

### Chunk 4: Add to Bank Integration & Refresh

**Goal:** Wire "Add to Bank" flow to prefill the Add Video page, add refresh button for re-fetching all feeds, and handle edge cases.

**Files:**
- `src/components/add-video/AddVideoPage.tsx` — modify (read `?url=` query param and prefill URL input)
- `src/app/discovery/page.tsx` — modify (add refresh button, wire loading states)
- `src/components/discovery/ChannelSection.tsx` — modify (add refresh per-channel)

**Implementation Details:**
- AddVideoPage: use `useSearchParams()` to read `url` query param on mount, if present set URL state and trigger auto-fetch of metadata (existing debounce flow handles this)
- Refresh button: top-right of discovery page, calls re-fetch on all channel video APIs, shows loading spinner
- Per-channel refresh: small refresh icon in channel header, re-fetches that channel's RSS
- Handle "In Bank" state change: after navigating back from /add (video now banked), state should update — use `visibilitychange` event or re-fetch on page focus
- AbortController for RSS fetches to prevent stale responses on rapid navigation

**What Could Break:**
- URL encoding: YouTube URLs with special chars need proper encoding in query params
- Navigating back from /add page may not trigger re-render

**Done When:**
- [ ] "Add to Bank" navigates to /add?url=VIDEO_URL and prefills input
- [ ] Add Video page auto-fetches metadata when URL param present
- [ ] Refresh button re-fetches all feeds
- [ ] "In Bank" status updates after adding a video
- [ ] No URL encoding issues

---

### Chunk 5: Polish & Animations

**Goal:** Add finishing touches — hover effects, scroll snap, skeleton loading, and responsive layout.

**Files:**
- `src/components/discovery/DiscoveryVideoCard.tsx` — modify (add hover lift animation)
- `src/components/discovery/ChannelSection.tsx` — modify (add scroll-snap CSS)
- `src/app/discovery/page.tsx` — modify (responsive adjustments, final layout polish)
- `src/components/discovery/FollowChannelInput.tsx` — modify (expand/collapse transition)

**Implementation Details:**
- Hover lift on video cards: `transition-all duration-200 hover:scale-[1.02] hover:shadow-lg` (match existing VideoCard pattern)
- Scroll snap: container `scroll-snap-type: x mandatory`, cards `scroll-snap-align: start`
- Follow input expand: Collapsible component with smooth height transition
- "In Bank" badge transition: `transition-opacity duration-200` for smooth appearance
- Responsive: on mobile (<768px), cards stack 2 per row instead of horizontal scroll; catch-up section goes single column
- Final sweep: check all loading states, error states, empty states render correctly
- Page title integration with TopBar (from Story 1): `usePageTitle('Discovery')` — if TopBar isn't implemented yet, keep existing `<h1>` as fallback

**What Could Break:**
- Scroll-snap behavior varies between browsers
- Mobile responsive breakpoints need testing

**Done When:**
- [ ] Hover animations match existing VideoCard pattern
- [ ] Horizontal scroll snaps cleanly
- [ ] Follow input expands/collapses smoothly
- [ ] Responsive layout works on mobile
- [ ] All loading, error, empty states render correctly
- [ ] No console errors

## Notes

- Channel URL parser from backlog story (parseChannelUrl supporting 3 URL formats)
- RSS fetcher already exists in `src/lib/automation/rss.ts` — reuse for video feed
- Channels table already has autoFetch, feedUrl, lastFetchedAt fields
- "In Bank" detection: check video youtubeId against videos table
- "Add to Bank" navigates to /add with ?url= prefilled
- Empty state guides users to add first channel
- Refresh button re-fetches all channel RSS feeds
- Consider batching RSS fetches to avoid timeout
- Existing automation API route at `src/app/api/channels/[id]/automation/route.ts` — follow same patterns
