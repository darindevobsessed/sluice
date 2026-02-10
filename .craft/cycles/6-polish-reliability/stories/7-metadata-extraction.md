---
name: youtube-metadata-extraction
title: Extract YouTube metadata (publishedAt, description, duration) during ingestion
status: planning
cycle: polish-reliability
story_number: 7
created: 2026-02-10
updated: 2026-02-10
priority: urgent
chunks_total: 0
chunks_complete: 0
---

# Story: Extract YouTube metadata during ingestion

## Spark
Videos ingested via `/gm-ingest` are missing `publishedAt` (and other useful fields like description and duration) because the YouTube oEmbed API doesn't return them. The YouTube page itself has this data in meta tags (e.g. `<meta itemprop="datePublished" content="2025-06-09T06:00:15-07:00">`). We need to extract these fields during ingestion using the same pattern as transcript fetching — a project API endpoint that curls the YouTube page and parses the metadata.

## Scope
**Included:**
- New API endpoint `POST /api/youtube/metadata` that accepts a `videoId`, fetches the YouTube page, and extracts `publishedAt`, `description`, and `duration` from meta tags
- Update `/gm-ingest` skill to call this endpoint and include `publishedAt` in the save payload
- Backfill script to update existing videos with null `publishedAt`

**Excluded:**
- No YouTube Data API key required — all data comes from page scraping
- No changes to the video save API schema (it already accepts `publishedAt`)
- No UI changes

## Technical Concerns
- YouTube page structure could change — meta tag parsing should be resilient with fallbacks
- Rate limiting: scraping YouTube pages in bulk (backfill) should be throttled

## Hardest Constraint
YouTube occasionally serves different HTML structures or requires consent cookies. The meta tag approach (`<meta itemprop="datePublished">`) is the most stable, but needs a fallback to the JSON-LD or `dateText` patterns if the primary parse fails.

## Acceptance
- Given a video is ingested via `/gm-ingest`, when saved to the knowledge bank, then `publishedAt` is populated with the correct date
- Given existing videos with null `publishedAt`, when the backfill script runs, then all videos get their publish dates filled
- Given a YouTube video ID, when `POST /api/youtube/metadata` is called, then it returns `publishedAt` as an ISO 8601 string

## Notes
- Confirmed working extraction patterns from the YouTube page:
  - `<meta itemprop="datePublished" content="2025-06-09T06:00:15-07:00">` (best — ISO 8601)
  - `"dateText":{"simpleText":"Jun 9, 2025"}` (fallback — needs date parsing)
- The `/api/youtube/transcript` endpoint is the pattern to follow for the new metadata endpoint
- `publishedAt` is critical for temporal decay in search ranking (`calculateTemporalDecay`)
