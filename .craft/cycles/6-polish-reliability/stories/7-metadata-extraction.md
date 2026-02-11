---
name: youtube-metadata-extraction
title: Extract YouTube metadata (publishedAt, description, duration) during ingestion
status: complete
cycle: polish-reliability
story_number: 7
created: 2026-02-10
updated: 2026-02-10
priority: urgent
chunks_total: 3
chunks_complete: 3
---

# Story: Extract YouTube metadata during ingestion

## Spark
Videos are missing `publishedAt`, `description`, and `duration` because the YouTube oEmbed API doesn't return them. These fields were manually populated via the gm-ingest command as a workaround. The backend needs to auto-fetch metadata from the YouTube page HTML during video creation so future videos are populated automatically.

## Scope
**Included:**
- Metadata extraction library: fetch YouTube page HTML, parse `publishedAt`, `description`, `duration` from meta tags with fallback patterns
- Add `description` column to videos table (schema migration)
- Update POST /api/videos to accept `duration` and `description`, and auto-fetch metadata when a video with youtubeId is created
- Backfill script for any remaining videos with null publishedAt

**Excluded:**
- No YouTube Data API key required — all data comes from page scraping
- No changes to gm-ingest command (it already works, backend handles metadata now)
- No UI changes

## Technical Concerns
- YouTube page structure could change — meta tag parsing should be resilient with fallbacks
- Rate limiting: scraping YouTube pages in bulk (backfill) should be throttled
- Auto-fetch adds ~1-2s latency to video creation (acceptable tradeoff)

## Hardest Constraint
YouTube occasionally serves different HTML structures or requires consent cookies. The meta tag approach (`<meta itemprop="datePublished">`) is the most stable, but needs a fallback to the JSON-LD or `dateText` patterns if the primary parse fails.

## Acceptance
- Given a new video is saved via POST /api/videos with a youtubeId, then publishedAt, description, and duration are auto-populated from YouTube
- Given a video is saved with metadata already provided by the caller, then caller-provided values take priority over fetched values
- Given YouTube metadata fetch fails, then the video save still succeeds (graceful degradation)
- Given existing videos with null publishedAt, when the backfill script runs, then metadata fields are populated
- Given a YouTube video ID, then fetchVideoPageMetadata extracts publishedAt, description, and duration with fallback patterns

## Chunks

### Chunk 1: Schema + Metadata Extraction Library

**Goal:** Add `description` column to videos table and create the metadata extraction library that parses YouTube page HTML.

**Files:**
- `src/lib/db/schema.ts` — modify (add `description` text column)
- `src/lib/youtube/metadata.ts` — create (fetchVideoPageMetadata function)
- `src/lib/youtube/__tests__/metadata.test.ts` — create (unit tests with mocked HTML)
- `src/lib/youtube/types.ts` — modify (add VideoPageMetadata interface)
- `src/lib/youtube/index.ts` — modify (add export)

**Implementation Details:**
- Add `description: text('description')` to videos table (nullable)
- Run `npx drizzle-kit push`
- `VideoPageMetadata` interface: `{ publishedAt: string | null, description: string | null, duration: number | null }`
- `fetchVideoPageMetadata(videoId: string): Promise<VideoPageMetadata>`:
  - Fetch `https://www.youtube.com/watch?v=${videoId}` with `Accept-Language: en` header
  - Extract `publishedAt` — primary: `<meta itemprop="datePublished" content="...">`, fallback: `"dateText":{"simpleText":"..."}` (parse with `new Date()`)
  - Extract `description` — `<meta name="description" content="...">` or `<meta property="og:description">`
  - Extract `duration` — `<meta itemprop="duration" content="PT...">` (parse ISO 8601 to seconds)
  - Return nulls for any field that fails extraction
- Follow `channel-parser.ts` pattern for HTML regex extraction

**What Could Break:**
- YouTube HTML changes (mitigated by multiple fallback patterns)
- YouTube consent page for some regions (mitigated by Accept-Language header)

**Done When:**
- [ ] `description` column exists in videos table
- [ ] `fetchVideoPageMetadata` extracts all 3 fields
- [ ] Multiple fallback patterns for publishedAt
- [ ] All tests pass with mocked HTML fixtures

### Chunk 2: Auto-fetch Metadata on Video Save

**Goal:** Modify POST /api/videos to accept duration and description, and automatically fetch metadata from YouTube when a video with youtubeId is created.

**Files:**
- `src/app/api/videos/route.ts` — modify (add fields to Zod schema, auto-fetch metadata)
- `src/app/api/videos/__tests__/route.test.ts` — modify (add tests for auto-fetch)

**Implementation Details:**
- Add `duration: z.number().int().positive().optional()` and `description: z.string().optional()` to POST Zod schema
- After validation, if `youtubeId` is present and `publishedAt`/`description`/`duration` are not provided in the request body:
  - Call `fetchVideoPageMetadata(youtubeId)`
  - Merge extracted values into the insert (only fill fields not already provided by caller)
- Include `publishedAt`, `description`, `duration` in the Drizzle insert
- If metadata fetch fails, continue with save — just don't populate those fields (log warning)
- Add tests: auto-fetch when youtubeId present, skip fetch when metadata already provided, graceful handling when fetch fails

**What Could Break:**
- Adds ~1-2s latency to video creation (YouTube page fetch) — acceptable tradeoff
- Existing callers that already provide publishedAt won't be affected (their values take priority)

**Done When:**
- [ ] POST /api/videos accepts `duration` and `description`
- [ ] Auto-fetches metadata when youtubeId present and fields missing
- [ ] Caller-provided values take priority over fetched values
- [ ] Graceful degradation when YouTube fetch fails
- [ ] All existing + new tests pass

### Chunk 3: Backfill Script

**Goal:** Script to populate metadata for existing videos with null publishedAt.

**Files:**
- `scripts/backfill-published-at.ts` — create
- `package.json` — modify (add `db:backfill-published-at` script)

**Implementation Details:**
- Follow `scripts/migrate-data.ts` pattern: `#!/usr/bin/env npx tsx`, `import 'dotenv/config'`, Drizzle ORM
- Query videos where `publishedAt IS NULL` and `youtubeId IS NOT NULL`
- For each: call `fetchVideoPageMetadata(youtubeId)` directly (library import)
- Update with extracted `publishedAt`, `description`, `duration`
- `--dry-run` flag, 1.5s throttle between requests, per-video error handling
- Progress + summary output

**What Could Break:**
- Videos without youtubeId skipped automatically
- YouTube rate limiting mitigated by throttle

**Done When:**
- [ ] Finds videos with null publishedAt
- [ ] Fetches metadata with throttling
- [ ] Updates database
- [ ] --dry-run support
- [ ] Per-video error handling + summary

## Notes
- Confirmed working extraction patterns from the YouTube page:
  - `<meta itemprop="datePublished" content="2025-06-09T06:00:15-07:00">` (best — ISO 8601)
  - `"dateText":{"simpleText":"Jun 9, 2025"}` (fallback — needs date parsing)
- The `channel-parser.ts` library is the pattern to follow for HTML scraping with regex
- `publishedAt` is critical for temporal decay in search ranking (`calculateTemporalDecay`)
- The save API already accepts `publishedAt` — adding `duration` and `description` to Zod schema
- `duration` column already exists in DB, `description` column is new
- Existing videos were manually populated via gm-ingest command — backfill is a safety net for gaps
