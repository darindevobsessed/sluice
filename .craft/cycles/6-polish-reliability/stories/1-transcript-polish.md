---
name: transcript-polish
title: Optional source field and transcript thumbnail icon
status: active
cycle: polish-reliability
story_number: 1
created: 2026-02-09
updated: 2026-02-10
priority: high
chunks_total: 4
chunks_complete: 1
---

# Story: Optional source field and transcript thumbnail icon

## Spark
Two quality-of-life improvements for the add-transcript experience: make the Source field optional (it was required because it reused the YouTube channel column), and give transcripts a visual identity with a transcript SVG icon wherever thumbnails appear — so they don't look like broken/missing images in the grid.

## Scope

**Included:**
- Make `channel` column nullable in DB schema (`src/lib/db/schema.ts`)
- Update API Zod validation: `channel` optional for `sourceType: 'transcript'`, still required for `sourceType: 'youtube'`
- Remove required validation from Source field in add-transcript form UI, label "(optional)"
- Create a reusable transcript SVG icon component
- Display SVG icon everywhere thumbnails appear (Knowledge Bank grid, success state, search results)
- Fix backend NULL safety (MCP tools, getDistinctChannels, persona suggestions, similar creators)
- Update tests to cover nullable channel and transcript icon

**Excluded:**
- Renaming the `channel` column (too many touchpoints)
- Changes to YouTube video ingestion flow
- Transcript icon on video detail page (title is enough context there)
- Changes to discovery page (only shows YouTube videos)

## Preserve
- YouTube video flow must remain unchanged (channel still required)
- Persona system (groups by channel) — NULL channels just get skipped
- Similar creators feature — NULL channels naturally excluded
- Search functionality — channel-based keyword search still works for entries that have one
- All existing tests that pass today must continue to pass

## Hardest Constraint
The `channel` column is referenced in ~30+ locations across the codebase (search, personas, MCP tools, discovery, components). Making it nullable means every reference needs to handle the NULL case gracefully — most will naturally work (SQL queries skip NULLs, UI conditionally renders), but each must be audited. The MCP tools `channel.toLowerCase()` crash is the highest-risk item.

## Technical Concerns
- Drizzle schema change requires `drizzle-kit push` to apply
- Zod schema needs conditional validation (channel required only when sourceType is youtube)
- SVG icon component should match the aspect ratio and sizing of YouTube thumbnails for visual consistency in grids
- MCP tools line 38: `r.channel.toLowerCase()` will crash on NULL — must fix with optional chaining

## Recommendations
- Use `.superRefine()` for conditional Zod validation (existing pattern in the route)
- Use a simple, clean document/lines SVG icon that fits the "Prospector's Clarity" design vibe
- TranscriptIcon accepts `className` prop for flexible sizing across locations

## Dependencies
**Blocked by:** None
**Blocks:** None

## Decisions

### Channel Nullability
**Type:** component
**Choice:** inline
**Details:** Keep column named `channel`, make nullable. NULL when transcript source left blank. Display nothing for NULL channel (no "Unknown" placeholder).

### Transcript Thumbnail
**Type:** component
**Choice:** inline
**Details:** Transcript SVG icon displayed everywhere thumbnails appear (grids, cards, success state). Consistent sizing via aspect-video container. Not on video detail page.

### Source Field Label
**Type:** component
**Choice:** inline
**Details:** Label reads "Source (optional)" to match Tags and Notes labeling pattern.

## Acceptance
- [ ] Given a user on the add-transcript form, when they leave Source blank and submit, then the transcript saves successfully with NULL channel
- [ ] Given a transcript with no source, when it appears in the Knowledge Bank grid, then no channel/source text is displayed (no "Unknown" placeholder)
- [ ] Given a transcript entry, when it appears anywhere thumbnails show (grid, success state, search results), then a transcript SVG icon displays instead of blank space
- [ ] Given a YouTube video entry, when adding via the add-video form, then channel/source remains required (no regression)
- [ ] Given existing data with non-null channels, when the schema migration runs, then all existing data is preserved
- [ ] Given a transcript with NULL channel, when MCP search_knowledge returns it, then no crash occurs

## Chunks

### Chunk 1: Schema + API + Type Cascade

**Goal:** Make `channel` nullable in the DB, update API validation, and cascade the type change through all TypeScript interfaces.

**Files:**
- `src/lib/db/schema.ts` — modify (remove `.notNull()` from `channel`)
- `src/app/api/videos/route.ts` — modify (conditional Zod: channel required for youtube, optional for transcript)
- `src/lib/search/types.ts` — modify (`channel: string | null`)
- `src/lib/search/aggregate.ts` — modify (`channel: string | null`)
- `src/lib/graph/types.ts` — modify (`channel: string | null` in RelatedChunk)

**Implementation Details:**
- Remove `.notNull()` from `channel` column in schema, run `drizzle-kit push`
- Zod: use `.superRefine()` — if `sourceType === 'youtube'`, require channel; if `sourceType === 'transcript'`, channel is optional. Empty string from form → `undefined` → stored as NULL
- Update all 3 TypeScript interfaces that define `channel: string` to `channel: string | null`
- Existing conditional validation pattern at line 111 of route.ts (youtubeId check) can be extended

**What Could Break:**
- TypeScript strict mode will flag every consumer of these interfaces — that's intentional, it guides Chunk 2
- `drizzle-kit push` must be run against the actual database

**Done When:**
- [ ] `drizzle-kit push` applies cleanly
- [ ] POST `/api/videos` with `sourceType: 'transcript'` and no channel succeeds (201)
- [ ] POST `/api/videos` with `sourceType: 'youtube'` and no channel fails (400)
- [ ] All type definitions updated

### Chunk 2: Backend NULL Safety

**Goal:** Fix all backend code that assumes `channel` is non-null to prevent crashes and incorrect data.

**Files:**
- `src/lib/mcp/tools.ts` — modify (null check before `.toLowerCase()` at line 38)
- `src/lib/db/search.ts` — modify (`getDistinctChannels` add `WHERE channel IS NOT NULL` at line 71)
- `src/app/api/personas/suggest/route.ts` — modify (filter null channels from group-by query at line 18)
- `src/lib/channels/similarity.ts` — modify (filter NULL from `selectDistinct` candidate channels)
- `src/lib/claude/prompts/extract.ts` — modify (conditionally include `Channel:` line in prompt at line 90)

**Implementation Details:**
- MCP tools: `r.channel?.toLowerCase()` with optional chaining, skip entries where channel is null for creator filter
- `getDistinctChannels()`: add `.where(isNotNull(videos.channel))` to the query
- Persona suggest: add `.where(isNotNull(videos.channel))` to the group-by query
- Similar creators: filter NULL from candidate channel list in `selectDistinct`
- Extract prompt: `${video.channel ? `Channel: ${video.channel}\n` : ''}`
- Note: `getVideoStats` count(distinct channel) naturally excludes NULLs — no change needed
- Note: keyword search `ilike(videos.channel, pattern)` returns false for NULL — no change needed
- Note: FTS trigger handles NULL gracefully — no change needed

**What Could Break:**
- MCP tools crash is the highest-risk item — must verify with a transcript entry that has NULL channel
- `isNotNull` import from drizzle-orm needed

**Done When:**
- [ ] MCP `search_knowledge` tool works when results include NULL-channel entries
- [ ] `getDistinctChannels()` returns no null entries
- [ ] Persona suggestions skip entries with no channel
- [ ] Extract prompt omits Channel line for NULL-channel videos
- [ ] `npm run build` passes clean

### Chunk 3: Transcript Icon + UI Updates

**Goal:** Create the transcript SVG icon and update all display components to show it and handle null channel.

**Files:**
- `src/components/icons/TranscriptIcon.tsx` — **create** (reusable SVG component)
- `src/components/add-transcript/AddTranscriptPage.tsx` — modify (Source optional, label "(optional)", send null for empty)
- `src/components/videos/VideoCard.tsx` — modify (transcript icon fallback in thumbnail area, conditional channel at line 96)
- `src/components/videos/VideoMetadata.tsx` — modify (conditional channel + separator dot at line 35)
- `src/components/search/VideoResultGroup.tsx` — modify (transcript icon fallback at lines 40-53, conditional channel at line 83)
- `src/components/search/ChunkResult.tsx` — modify (conditional channel at line 84)
- `src/components/video/RelatedChunkCard.tsx` — modify (conditional channel at line 18)
- `src/components/add-video/SuccessState.tsx` — modify (transcript icon when sourceType is transcript and no thumbnail)

**Implementation Details:**
- TranscriptIcon: simple document-with-lines SVG, accepts `className` prop, uses `text-muted-foreground` color, centered in container
- VideoCard thumbnail area: show `<TranscriptIcon>` centered in the `aspect-video` container with `bg-muted` background when `!video.thumbnail`
- All channel displays: wrap in `{video.channel && <span>...</span>}` or `{chunk.channel && ...}` pattern
- VideoMetadata separator dot: only render when `video.channel` is truthy
- AddTranscriptPage: remove `source.trim()` from `canSubmit` check, change label to "Source (optional)", send `channel: source.trim() || undefined` in POST body
- SuccessState: accept optional `sourceType` prop, show TranscriptIcon centered when `sourceType === 'transcript'` and no thumbnail provided

**What Could Break:**
- Icon sizing — must look balanced in the aspect-video container (not too large or small)
- SuccessState props change — verify add-video page still works (passes thumbnail for YouTube)

**Done When:**
- [ ] Transcript entries show SVG icon in Knowledge Bank grid
- [ ] Transcript entries show SVG icon in search results
- [ ] SuccessState shows SVG icon after adding a transcript
- [ ] NULL channel shows no text anywhere (no blank space, no "Unknown")
- [ ] Source field labeled "(optional)" on add-transcript form
- [ ] Form submits successfully with empty Source
- [ ] YouTube add-video flow unchanged

### Chunk 4: Test Updates

**Goal:** Update existing tests and add coverage for nullable channel and transcript icon.

**Files:**
- `src/components/add-transcript/__tests__/AddTranscriptPage.test.tsx` — modify (source optional tests)
- `src/app/api/videos/__tests__/route.test.ts` — modify (add test for transcript without channel)
- `src/components/videos/__tests__/` — add VideoCard transcript icon test if test file exists

**Implementation Details:**
- Update "submit button disabled when source is missing" test — button should now be enabled with just title + transcript (min 50 chars)
- Add test: submit with empty source sends no channel in request body
- Add test: submit with source value sends channel in request body
- Add API test: POST with `sourceType: 'transcript'` and no channel → 201 with null channel in response
- Add API test: POST with `sourceType: 'youtube'` and no channel → 400 error
- Add component test: VideoCard with null thumbnail renders TranscriptIcon SVG
- Add component test: VideoCard with null channel doesn't render channel text
- Verify all existing tests still pass without modification (except the source-required test)

**What Could Break:**
- Existing test fixtures with hardcoded channel values should continue to work (non-null values unchanged)

**Done When:**
- [ ] All existing tests pass (no regressions except intentional source-required change)
- [ ] New test cases cover: optional source submit, transcript without channel API, transcript icon rendering, null channel display
- [ ] `npm test` passes clean

## Notes
- The `channel` column was originally designed for YouTube channels but was repurposed as "Source" for transcripts. Keeping the column name avoids a massive rename across 30+ files.
- The SVG icon should use muted colors that fit the existing card grid aesthetic.
- Video detail page intentionally excluded from transcript icon — title provides enough context there.
- Discovery page only shows YouTube videos, so no changes needed there.
