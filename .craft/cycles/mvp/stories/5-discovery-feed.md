---
name: discovery-feed
title: Discovery Feed
status: ready
priority: medium
created: 2026-02-03
updated: 2026-02-03
cycle: mvp
story_number: 5
chunks_total: 4
chunks_complete: 0
---

# Story: Discovery Feed

## Spark

Stay current with channels you care about. Users paste a YouTube channel URL, we parse the channel ID (handling @handle, /channel/, /c/ formats) and subscribe to its RSS feed — no YouTube API key needed. The Discovery page shows followed channels vertically with their latest 3-5 videos as horizontal scroll cards. Each video card has "Add to Bank" that navigates to the Add Video page with URL prefilled. Videos already in the bank show "✓ In Bank" badge. Turns Gold Miner from a manual tool into a content pipeline.

## Dependencies

**Blocked by:** Story 1 (App Shell) — needs layout and database for channel storage
**Blocks:** None (can run in parallel with Stories 3-4 after Story 1)

## Acceptance

- [ ] User can paste YouTube channel URL and follow the channel
- [ ] Channel URL formats supported: @handle, /channel/ID, /c/name
- [ ] Channel preview shown before following (name, handle)
- [ ] Followed channels display with latest videos from RSS
- [ ] Videos display in horizontal scroll per channel
- [ ] Video cards show thumbnail, title, duration, published date
- [ ] "Add to Bank" navigates to /add with URL prefilled
- [ ] Videos already in bank show "✓ In Bank" badge
- [ ] Unfollow removes channel from feed
- [ ] Refresh button fetches latest from RSS
- [ ] Empty state guides users to add first channel

## Chunks

### Chunk 1: Channel URL Parser & RSS Fetcher

**Goal:** Create utilities for parsing YouTube channel URLs and fetching RSS feeds.

**Files:**
- `src/lib/youtube/channel-parser.ts` — create
- `src/lib/youtube/rss.ts` — create
- `src/lib/youtube/channel-types.ts` — create

**Implementation Details:**

**Channel URL Parser:**
Parse various YouTube channel URL formats:
```typescript
// Supported formats:
// https://www.youtube.com/@fireship
// https://www.youtube.com/c/Fireship
// https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA
// https://youtube.com/@fireship

interface ParsedChannel {
  type: 'handle' | 'custom' | 'id';
  value: string; // @fireship, Fireship, or UCsBjURrPoezykLs9EqgamOA
}

export function parseChannelUrl(url: string): ParsedChannel | null
```

**Channel ID Resolution:**
- For @handle and /c/ URLs, need to fetch the page to get channel ID
- Scrape or use oEmbed to resolve to channel ID
- Cache resolved IDs

**RSS Fetcher:**
```typescript
// YouTube RSS format:
// https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID

interface RSSVideo {
  videoId: string;
  title: string;
  published: Date;
  thumbnail: string;
  channelId: string;
  channelName: string;
}

export async function fetchChannelRSS(channelId: string): Promise<RSSVideo[]>
```

- Parse XML response with DOMParser or xml2js
- Return latest 10 videos (we'll display 3-5)
- Handle fetch errors gracefully

**What Could Break:**
- @handle resolution may need page scraping
- RSS feed structure changes
- CORS issues — fetch server-side

**Done When:**
- [ ] Parse all 3 URL formats
- [ ] Resolve handles to channel IDs
- [ ] Fetch and parse RSS feed
- [ ] Return structured video data

---

### Chunk 2: Channels Database & API

**Goal:** Add channels table and API routes for managing followed channels.

**Files:**
- `src/lib/db/schema.ts` — modify (add channels table)
- `src/app/api/channels/route.ts` — create
- `src/app/api/channels/[id]/route.ts` — create
- `src/app/api/channels/[id]/videos/route.ts` — create

**Implementation Details:**

**Channels table schema:**
```typescript
export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(), // UUID
  channelId: text('channel_id').notNull().unique(), // YouTube channel ID
  name: text('name').notNull(),
  handle: text('handle'), // @handle if available
  thumbnailUrl: text('thumbnail_url'),
  lastFetched: integer('last_fetched', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

**API Routes:**

**POST /api/channels** — Follow a channel
- Body: `{ url: string }` (YouTube channel URL)
- Parse URL, resolve channel ID
- Fetch channel info (name, handle, thumbnail)
- Create channel record
- Return: `{ channel: Channel }`

**GET /api/channels** — List followed channels
- Returns all channels with video counts from bank
- Ordered by lastFetched desc

**DELETE /api/channels/[id]** — Unfollow a channel
- Removes channel from database
- Does NOT remove videos already in bank

**GET /api/channels/[id]/videos** — Get latest videos for channel
- Fetches RSS feed
- Updates lastFetched timestamp
- Returns videos with `inBank: boolean` flag
- `inBank` = true if video's youtubeId exists in videos table

**What Could Break:**
- Channel ID resolution for @handles
- Duplicate channel follows — unique constraint

**Done When:**
- [ ] Channels table created
- [ ] Can follow channel via API
- [ ] Can list followed channels
- [ ] Can unfollow channel
- [ ] Video list includes "in bank" flag
- [ ] Last fetched timestamp updates

---

### Chunk 3: Discovery Page UI

**Goal:** Build the Discovery page with channel sections and video cards.

**Files:**
- `src/app/discovery/page.tsx` — modify (replace placeholder)
- `src/components/discovery/ChannelSection.tsx` — create
- `src/components/discovery/DiscoveryVideoCard.tsx` — create
- `src/components/discovery/FollowChannelInput.tsx` — create
- `src/components/discovery/DiscoveryEmptyState.tsx` — create

**Implementation Details:**

**Page Layout:**
- Header: "Discovery" + "Follow a Channel" button + "Refresh" button
- Followed channels listed vertically
- Each channel is a ChannelSection
- EmptyState when no channels

**FollowChannelInput (Collapsible):**
- Default: "Follow a Channel" button
- Expanded: Input + Follow + Cancel buttons
- Shows channel preview before confirming
- Loading state while resolving channel
- Error state if invalid URL

**ChannelSection:**
- Header row: Channel name, @handle, "Updated X ago", [Unfollow]
- Horizontal scroll container with video cards
- Show 3-5 videos per channel
- Scroll indicator when more available
- Loading skeleton while fetching

**DiscoveryVideoCard:**
- Thumbnail with duration badge
- Title (2 lines, truncate)
- Published date ("3 days ago")
- "Add to Bank" button OR "✓ In Bank" badge
- Click "Add to Bank" → `router.push('/add?url=...')`

**What Could Break:**
- Horizontal scroll on touch devices
- Many channels = many API calls (consider batching)

**Done When:**
- [ ] Page shows followed channels
- [ ] Can follow new channel via input
- [ ] Channel sections show latest videos
- [ ] Horizontal scroll works smoothly
- [ ] "Add to Bank" navigates with prefilled URL
- [ ] "In Bank" badge shows for added videos
- [ ] Unfollow removes channel
- [ ] Empty state displays correctly

---

### Chunk 4: Refresh & URL Prefill Integration

**Goal:** Wire up refresh functionality and integrate with Add Video page URL prefill.

**Files:**
- `src/app/discovery/page.tsx` — modify (add refresh)
- `src/app/add/page.tsx` — modify (handle URL query param)
- `src/hooks/useDiscoveryRefresh.ts` — create

**Implementation Details:**

**Refresh Button:**
- Click triggers re-fetch of all channel RSS feeds
- Shows loading spinner during refresh
- Updates "Updated X ago" timestamps
- Toast notification: "Feed refreshed"

**useDiscoveryRefresh hook:**
```typescript
export function useDiscoveryRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    setIsRefreshing(true);
    // Fetch all channels in parallel
    await Promise.all(channels.map(c => fetchVideos(c.id)));
    setIsRefreshing(false);
  };

  return { isRefreshing, refresh };
}
```

**Add Video URL Prefill:**
- Add Video page reads `?url=` query param
- If present, auto-populate URL input
- Auto-trigger URL validation and preview
- User just needs to paste transcript

```typescript
// In Add Video page
const searchParams = useSearchParams();
const prefillUrl = searchParams.get('url');

useEffect(() => {
  if (prefillUrl) {
    setUrl(prefillUrl);
    validateAndFetchPreview(prefillUrl);
  }
}, [prefillUrl]);
```

**"In Bank" Detection:**
- When fetching channel videos, check each against videos table
- Return `inBank: boolean` for each video
- DiscoveryVideoCard uses this to show badge vs button

**What Could Break:**
- URL encoding in query params
- Race conditions during refresh

**Done When:**
- [ ] Refresh button fetches all channels
- [ ] Loading state during refresh
- [ ] Timestamps update after refresh
- [ ] Add Video page reads URL from query
- [ ] URL input pre-populated and validated
- [ ] "In Bank" detection works correctly

## Notes

- YouTube RSS feed: `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`
- @handle resolution requires fetching channel page (no direct API)
- Parse channel ID from page HTML or use oEmbed trick
- Video embeds use standard YouTube iframe (no API key)
- Consider caching RSS responses (5-10 min TTL)
- Refresh is manual for MVP; could add auto-refresh later
- "In Bank" check is by youtubeId match in videos table
