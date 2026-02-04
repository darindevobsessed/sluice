---
name: add-video
title: Add Video
status: active
priority: high
created: 2026-02-03
updated: 2026-02-03
cycle: mvp
story_number: 2
chunks_total: 4
chunks_complete: 3
---

# Story: Add Video

## Spark

A conversational single-page flow to add YouTube videos to the knowledge bank. User pastes URL, sees live preview with auto-extracted metadata, then scrolls down to paste transcript with inline instructions. Feels guided and friendly, not like a boring form.

## Dependencies

**Blocked by:** Story 1 (App Shell) — needs layout, navigation, database
**Blocks:** Story 3 (Knowledge Bank) — needs content to display

## Acceptance

- [ ] User can paste YouTube URL and see video preview
- [ ] Metadata (title, channel, thumbnail) auto-extracted via oEmbed
- [ ] Manual fallback fields appear if oEmbed fails
- [ ] Transcript paste area with expandable instructions
- [ ] Tags and notes fields available (optional)
- [ ] Form validates before submission
- [ ] Video saved to database on submit
- [ ] Success state with celebration and next actions
- [ ] Conversational flow — no step indicators

## Chunks

### Chunk 1: YouTube URL Utilities

**Goal:** Create utilities for parsing YouTube URLs and fetching metadata via oEmbed.

**Files:**
- `src/lib/youtube/parse-url.ts` — create
- `src/lib/youtube/oembed.ts` — create
- `src/lib/youtube/types.ts` — create

**Implementation Details:**
- `parseYouTubeUrl(url: string)` returns `{ videoId, isValid }` or null
- Handle URL formats:
  - `youtube.com/watch?v=VIDEO_ID`
  - `youtu.be/VIDEO_ID`
  - `youtube.com/embed/VIDEO_ID`
  - `youtube.com/v/VIDEO_ID`
  - With timestamps, playlists, etc. (extract just video ID)
- `fetchVideoMetadata(videoId: string)` calls YouTube oEmbed:
  - Endpoint: `https://www.youtube.com/oembed?url=https://youtube.com/watch?v={videoId}&format=json`
  - Returns: `{ title, author_name, thumbnail_url }`
- Types: `VideoMetadata`, `ParsedUrl`
- Handle errors gracefully — return null on failure

**What Could Break:**
- oEmbed rate limiting — handled by manual fallback in UI
- Invalid URLs — validate before fetching

**Done When:**
- [x] parseYouTubeUrl handles all common formats
- [x] fetchVideoMetadata returns metadata or null
- [x] Types exported for use in components

---

### Chunk 2: URL Input & Video Preview Section

**Goal:** Create the top section of the Add Video page — conversational URL input with live preview.

**Files:**
- `src/app/add/page.tsx` — modify (replace placeholder)
- `src/components/add-video/AddVideoPage.tsx` — create
- `src/components/add-video/VideoPreviewCard.tsx` — create

**Implementation Details:**
- Page header: "Add a Video" (h1)
- Conversational prompt: "What video would you like to add?"
- URL input (shadcn/ui Input) with validation on change
- Loading spinner while fetching metadata
- On valid URL + successful oEmbed: show VideoPreviewCard
- VideoPreviewCard layout:
  - Thumbnail on left (rounded corners)
  - Title, channel name, "✓ Looks good" on right
  - Embedded video player below (optional, can be toggled)
- If oEmbed fails: show editable fields for title and channel (manual fallback)
- Form state managed with useState or react-hook-form
- Once video confirmed, transcript section appears below (scroll into view)

**What Could Break:**
- Need shadcn/ui Input, Card components from Story 1
- oEmbed failure — manual fallback fields

**Done When:**
- [x] Page renders with conversational header
- [x] URL input validates YouTube URLs
- [x] Valid URL triggers metadata fetch with loading state
- [x] VideoPreviewCard shows thumbnail, title, channel
- [x] Manual fallback fields appear if oEmbed fails
- [x] Video preview feels like a confirmation, not just data

---

### Chunk 3: Transcript Section & Instructions

**Goal:** Create the transcript paste area with inline expandable instructions.

**Files:**
- `src/components/add-video/TranscriptSection.tsx` — create
- `src/components/add-video/TranscriptInstructions.tsx` — create
- `src/components/add-video/OptionalFields.tsx` — create

**Implementation Details:**
- Section prompt: "Now paste the transcript:"
- Large textarea (min-height: 300px, generous padding)
- "How do I get this?" link — toggles CollapsibleInstructions
- Instructions content:
  > 1. Open the video on YouTube
  > 2. Click the ⋯ (three dots) below the video
  > 3. Select "Show transcript"
  > 4. Click anywhere in the transcript panel
  > 5. Press Ctrl+A (Cmd+A on Mac) to select all
  > 6. Press Ctrl+C (Cmd+C on Mac) to copy
  > 7. Paste here!
- Character count display below textarea
- OptionalFields section below:
  - Tags input (comma-separated, simple for MVP)
  - Notes textarea (smaller, 2-3 rows)
- "Add to Knowledge Bank" button at bottom
- Button disabled until transcript has content (min 50 chars)

**What Could Break:**
- Very large transcripts — consider debouncing textarea updates
- Collapsible needs proper animation

**Done When:**
- [x] Transcript textarea renders with generous size
- [x] Instructions toggle open/closed smoothly
- [x] Instructions are clear and complete
- [x] Tags input accepts comma-separated values
- [x] Notes field available
- [x] Character count updates as user types
- [x] Submit button enables when transcript has content

---

### Chunk 4: Form Submission & Success State

**Goal:** Handle form submission, save to database, show success celebration.

**Files:**
- `src/app/api/videos/route.ts` — create (API route)
- `src/components/add-video/AddVideoPage.tsx` — modify (add submit handler)
- `src/components/add-video/SuccessState.tsx` — create

**Implementation Details:**
- API route `POST /api/videos`:
  - Validate request body with zod schema:
    - youtubeId: string (required)
    - title: string (required)
    - channel: string (required)
    - thumbnail: string (optional)
    - transcript: string (required, min 50 chars)
    - tags: string[] (optional)
    - notes: string (optional)
  - Insert into videos table via Drizzle
  - Return created video with ID
- Form submit handler:
  - Disable button, show loading spinner
  - Call API route via fetch
  - On success: transition to SuccessState
  - On error: show toast notification with message
- SuccessState component:
  - Celebratory message: "Added to your Knowledge Bank!"
  - Show video thumbnail and title (smaller)
  - Two buttons:
    - "View Video" → links to `/videos/[id]` (route exists from Story 3)
    - "Add Another" → resets form to initial state
  - Subtle animation on appear (fade in, slight scale)

**What Could Break:**
- Database connection from Story 1
- API validation errors — handle gracefully

**Done When:**
- [ ] API route validates and saves video to database
- [ ] Form shows loading state during submission
- [ ] Success state displays with video info
- [ ] "View Video" links to correct route
- [ ] "Add Another" resets form completely
- [ ] Errors display via toast notification
- [ ] Success feels rewarding, not just functional

## Notes

- Use YouTube oEmbed API for metadata (no API key needed)
- Parse video ID from various YouTube URL formats
- Transcript paste area should be generous (large textarea)
- Consider showing a preview of the video embed while adding
- Success state should feel rewarding
- Conversational flow locked — no step indicators, single page
- Manual fallback if oEmbed fails — user can edit title/channel
