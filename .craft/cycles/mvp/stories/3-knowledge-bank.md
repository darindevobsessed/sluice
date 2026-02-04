---
name: knowledge-bank
title: Knowledge Bank
status: active
priority: high
created: 2026-02-03
updated: 2026-02-03
cycle: mvp
story_number: 3
chunks_total: 5
chunks_complete: 1
---

# Story: Knowledge Bank

## Spark

The home of all extracted knowledge. A "Dashboard" design with stats header showing collection value (video count, hours of content, channel count) that makes users feel proud of what they've built. Below that, a prominent search bar for full-text search across titles and transcripts, then a responsive card grid displaying saved videos. Clicking a card opens a dedicated detail page with embedded video player and clickable timestamped transcript. Empty state ("The Promise") inspires new users to start building their knowledge vault.

## Dependencies

**Blocked by:** Story 2 (Add Video) — needs content to display
**Blocks:** Story 4 (Claude Insights) — provides the view where insights attach

## Acceptance

- [ ] Stats header shows video count, total hours, channel count
- [ ] Stats update dynamically as collection changes
- [ ] Search filters videos in real-time (debounced)
- [ ] Full-text search works across titles and transcript content
- [ ] Video cards display in responsive grid (1→4 columns)
- [ ] Cards show thumbnail, title, channel, duration, date added
- [ ] Card hover has subtle shadow lift
- [ ] Clicking card navigates to detail page
- [ ] Empty state displays "The Promise" design with CTA
- [ ] Detail page shows embedded YouTube player
- [ ] Transcript displays with parsed timestamps
- [ ] Clicking timestamp seeks video to that position
- [ ] Back navigation returns to Knowledge Bank

## Chunks

### Chunk 1: FTS5 Full-Text Search Setup

**Goal:** Enable SQLite full-text search on videos table for fast transcript and title search.

**Files:**
- `src/lib/db/schema.ts` — modify (add FTS5 virtual table)
- `src/lib/db/migrations/001_fts.sql` — create (FTS5 setup SQL)
- `drizzle.config.ts` — modify (add custom migration for FTS)

**Implementation Details:**
- Create FTS5 virtual table: `videos_fts` linked to videos table
- Index columns: `title`, `transcript`, `channel`
- Add triggers to keep FTS in sync when videos are inserted/updated/deleted
- Create search function in `src/lib/db/index.ts`:
  ```typescript
  export function searchVideos(query: string): Video[] {
    // Use FTS5 MATCH syntax with ranking
  }
  ```
- Handle empty query (return all videos, sorted by createdAt desc)

**What Could Break:**
- FTS5 may not be available in all SQLite builds — better-sqlite3 includes it
- Triggers need to match table structure exactly

**Done When:**
- [ ] FTS5 virtual table created
- [ ] Search returns ranked results for query
- [ ] Empty query returns all videos
- [ ] Insert/update/delete keeps FTS in sync

---

### Chunk 2: Video Card & Stats Components

**Goal:** Create the video card UI and stats header components for the Knowledge Bank.

**Files:**
- `src/components/videos/VideoCard.tsx` — create
- `src/components/videos/StatsHeader.tsx` — create
- `src/components/videos/EmptyState.tsx` — create

**Implementation Details:**

**VideoCard:**
- Layout per locked decision:
  - Thumbnail (aspect-ratio 16:9, rounded-lg)
  - Duration badge (bottom-right of thumbnail, bg-black/80)
  - Title (truncate to 2 lines, font-semibold)
  - Channel name (text-muted-foreground, text-sm)
  - Date added (text-muted-foreground, text-xs)
- Use shadcn/ui Card as base
- Hover: shadow-lg, scale(1.02), transition-all
- Click navigates to `/videos/[id]`
- Skeleton loading variant

**StatsHeader:**
- Three stat cards in a row (responsive: stack on mobile)
- Each shows: number (large), label (muted)
- Values: video count, total hours, channel count
- Subtle background (surface-secondary)

**EmptyState ("The Promise"):**
- Mountain + sparkle icon/illustration
- "Start building your knowledge vault"
- "Save videos • Search transcripts • Extract insights"
- Primary CTA button → `/add`

**What Could Break:**
- Thumbnail aspect ratio on various screen sizes
- Text truncation browser support (line-clamp)

**Done When:**
- [ ] VideoCard displays all required info
- [ ] Card hover effect works smoothly
- [ ] StatsHeader shows three metrics
- [ ] EmptyState matches locked design
- [ ] All components have skeleton variants

---

### Chunk 3: Knowledge Bank Page

**Goal:** Build the main Knowledge Bank page with stats, search, and responsive card grid.

**Files:**
- `src/app/page.tsx` — modify (replace placeholder with Knowledge Bank)
- `src/components/videos/VideoGrid.tsx` — create
- `src/components/videos/VideoSearch.tsx` — create
- `src/app/api/videos/route.ts` — modify (add GET with search + stats)

**Implementation Details:**

**Page Layout:**
- Page header: "Knowledge Bank" (h1)
- StatsHeader component below title
- VideoSearch component below stats
- VideoGrid below search (or EmptyState if no videos)

**VideoSearch:**
- Input with search icon
- Debounced (300ms) real-time filtering
- Placeholder: "Search videos and transcripts..."
- Clear button when has value
- Uses AbortController to cancel stale requests

**VideoGrid:**
- CSS Grid with responsive columns
- 1 col (mobile) → 2 col (md) → 3 col (lg) → 4 col (xl)
- Gap: 24px
- Loading skeleton grid while fetching

**API route `GET /api/videos`:**
- Query params: `?q=search_term`
- Returns: `{ videos: Video[], stats: { count, totalHours, channels } }`
- Uses FTS5 search if query provided
- Returns all videos if no query (sorted by createdAt desc)

**What Could Break:**
- Search debouncing race conditions — use AbortController
- Grid responsiveness on edge cases

**Done When:**
- [ ] Stats header shows accurate counts
- [ ] Grid displays all saved videos
- [ ] Search filters in real-time
- [ ] Empty state displays when no videos
- [ ] "No results" state for empty search results
- [ ] Loading skeleton while fetching

---

### Chunk 4: Transcript Parser Utility

**Goal:** Parse YouTube transcript format into structured data with timestamps.

**Files:**
- `src/lib/transcript/parse.ts` — create
- `src/lib/transcript/types.ts` — create

**Implementation Details:**
- Parse YouTube transcript format:
  ```
  0:00
  Introduction to the topic
  0:45
  Main content begins here
  with multiple lines sometimes
  1:30
  Next section
  ```
- Output structure:
  ```typescript
  interface TranscriptSegment {
    timestamp: string;      // "0:00", "1:30", "10:45"
    seconds: number;        // 0, 90, 645
    text: string;           // The content for this segment
  }
  ```
- Handle edge cases:
  - Timestamps with hours (1:00:00)
  - Text spanning multiple lines between timestamps
  - Missing timestamps (treat as continuation)
  - Malformed input (return as single segment)
- Helper: `timestampToSeconds(timestamp: string): number`
- Helper: `secondsToTimestamp(seconds: number): string`
- Helper: `formatDuration(seconds: number): string` (for video duration display)

**What Could Break:**
- Varied YouTube transcript formats
- Copy/paste artifacts (extra whitespace, encoding)

**Done When:**
- [ ] Parses standard YouTube transcript format
- [ ] Handles hours:minutes:seconds format
- [ ] Multi-line text grouped correctly
- [ ] Graceful fallback for malformed input
- [ ] All helpers tested and working

---

### Chunk 5: Video Detail Page

**Goal:** Build the full video detail page with embedded player and clickable transcript.

**Files:**
- `src/app/videos/[id]/page.tsx` — create
- `src/components/videos/VideoPlayer.tsx` — create
- `src/components/videos/TranscriptView.tsx` — create
- `src/components/videos/VideoMetadata.tsx` — create
- `src/app/api/videos/[id]/route.ts` — create

**Implementation Details:**

**Route:** `/videos/[id]` (dynamic route)

**API route `GET /api/videos/[id]`:**
- Returns single video with all fields
- 404 if not found

**Page Layout:**
- Back button (← Knowledge Bank) at top
- Video title (h1)
- VideoMetadata row: channel, date added, tags (pills)
- VideoPlayer (embedded YouTube)
- "Extract Insights" button (placeholder for Story 4, disabled)
- TranscriptView below

**VideoPlayer:**
- YouTube iframe embed with `youtubeId` prop
- Responsive (max-width: 800px, aspect-ratio 16:9)
- Expose `seekTo(seconds)` via ref for transcript clicks
- Use YouTube iframe API or URL params (`?start=seconds`)

**TranscriptView:**
- Renders parsed transcript segments
- Each segment: timestamp button + text
- Timestamp styled as pill (monospace, muted bg)
- Click timestamp → calls player.seekTo(seconds)
- Scrollable container with comfortable max-height
- Current segment highlighting (stretch goal)

**VideoMetadata:**
- Channel name (link-styled)
- Date added ("Added Jan 15, 2026")
- Tags as pills (if present)
- Duration

**What Could Break:**
- YouTube iframe API for seeking — use URL parameter approach initially
- Transcript click → player seek coordination
- Very long transcripts — virtualization may be needed later

**Done When:**
- [ ] Detail page renders for valid video ID
- [ ] 404 page for invalid ID
- [ ] YouTube video embeds and plays
- [ ] Transcript displays with parsed timestamps
- [ ] Clicking timestamp seeks video to that position
- [ ] Back navigation works
- [ ] Metadata displays correctly
- [ ] Placeholder "Extract Insights" button visible

## Notes

- Uses "The Dashboard" design (locked) with stats header
- Empty state is "The Promise" — inspirational, not cutesy
- FTS5 enables fast full-text search without external services
- Timestamp parsing handles YouTube's copy/paste format
- Video player seeking uses URL params for simplicity
- Card grid is responsive (1 col mobile, 2-3 col tablet, 4 col desktop)
- Video detail page is where Claude Insights will attach (Story 4)
