---
name: automation
title: Automation
status: active
priority: medium
created: 2026-02-05
updated: 2026-02-06
cycle: mcp-intelligence
story_number: 4
chunks_total: 5
chunks_complete: 2
current_chunk: 3
---

# Story: Automation

## Spark

Turn Gold Miner from a manual tool into an automated content pipeline. Set up cron jobs to monitor RSS feeds for followed channels. When new videos appear, automatically fetch transcripts and generate embeddings.

Use Vercel cron with Next.js API routes. Database-backed job queue for reliability.

> *"what you're gonna do is set up a cron job once a day, twice a day, whatever, checks the RSS feed. Checks against what you already have in terms of the video list, find the delta."*
> *"Cron Job, RSS, new video, programmatic extract, database, queue trigger agent to summarize, summarized, done."*

**Scope clarification:** This story focuses on Transcript + Embed automation only. Auto-insights would trigger Claude API calls for every new video, which has cost implications and should be opt-in (deferred to future story).

## Dependencies

**Blocked by:** RAG Foundation cycle (complete) — needs transcript and embedding infrastructure
**Blocks:** None

## Acceptance

- [ ] RSS feed parsing extracts video metadata correctly
- [ ] Channels table tracks `feedUrl` for followed channels
- [ ] Jobs table stores pending automation tasks with status tracking
- [ ] Cron endpoint runs on schedule (configurable via vercel.json)
- [ ] Delta detection finds new videos not in database
- [ ] Job processor fetches transcripts and generates embeddings
- [ ] Failed jobs retry with exponential backoff (max 3 attempts)
- [ ] Existing manual add flow unchanged
- [ ] Tests cover RSS parsing, delta detection, job processing

## Chunks

### Chunk 1: RSS Feed Fetching & Parsing

**Goal:** Create utility to fetch and parse YouTube RSS feeds, extracting video metadata.

**Files:**
- `src/lib/automation/rss.ts` — create
- `src/lib/automation/types.ts` — create
- `src/lib/automation/__tests__/rss.test.ts` — create

**Implementation Details:**

**RSS feed URL format:**
```typescript
// YouTube channel RSS feed pattern
const getFeedUrl = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
```

**Types:**
```typescript
export interface RSSVideo {
  youtubeId: string
  title: string
  channelId: string
  channelName: string
  publishedAt: Date
  description: string
}

export interface RSSFeedResult {
  channelId: string
  channelName: string
  videos: RSSVideo[]
  fetchedAt: Date
}
```

**Parser function:**
```typescript
export async function fetchChannelFeed(channelId: string): Promise<RSSFeedResult> {
  const feedUrl = getFeedUrl(channelId)
  const response = await fetch(feedUrl)
  const xml = await response.text()
  // Parse XML using fast-xml-parser or similar
  // Extract video entries from <entry> elements
  // Map to RSSVideo objects
}
```

**What Could Break:**
- YouTube rate limiting on RSS fetches — add delay between channels
- XML parsing edge cases — test with real feeds
- Channel IDs vs handles — may need lookup

**Done When:**
- [ ] Can fetch RSS feed for a channel ID
- [ ] Parses video entries correctly
- [ ] Returns typed RSSFeedResult
- [ ] Handles fetch errors gracefully
- [ ] Tests cover: successful parse, empty feed, invalid channel

---

### Chunk 2: Channel Schema Extension & API

**Goal:** Extend channels table to track RSS feed URLs, add API for managing automation settings.

**Files:**
- `src/lib/db/schema.ts` — modify (extend channels table)
- `src/app/api/channels/[id]/automation/route.ts` — create
- `src/lib/db/queries.ts` — modify (add channel automation queries)

**Implementation Details:**

**Schema extension:**
```typescript
export const channels = pgTable('channels', {
  // ... existing fields
  feedUrl: text('feed_url'),           // RSS feed URL
  autoFetch: boolean('auto_fetch').default(false), // Enable automation
  lastFetchedAt: timestamp('last_fetched_at'),     // Last RSS check
  fetchIntervalHours: integer('fetch_interval_hours').default(12),
})
```

**API endpoint:**
```typescript
// PATCH /api/channels/[id]/automation
// Body: { autoFetch: boolean, fetchIntervalHours?: number }
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const channelId = parseInt(params.id)
  const body = await request.json()
  // Validate with Zod
  // Update channel automation settings
  // Return updated channel
}
```

**Query functions:**
```typescript
export async function getChannelsForAutoFetch(db = database) {
  return db.select()
    .from(channels)
    .where(eq(channels.autoFetch, true))
}

export async function updateChannelLastFetched(
  channelId: number,
  db = database
) {
  return db.update(channels)
    .set({ lastFetchedAt: new Date() })
    .where(eq(channels.id, channelId))
}
```

**What Could Break:**
- Migration may fail if channels table doesn't exist — it does from Discovery flow
- Need to populate feedUrl for existing channels — can be NULL, populated on first fetch

**Done When:**
- [ ] Channels table has automation fields
- [ ] API endpoint updates automation settings
- [ ] Query returns channels due for fetching
- [ ] `npm run db:push` succeeds
- [ ] Existing channel functionality unchanged

---

### Chunk 3: Job Queue System

**Goal:** Create database-backed job queue for reliable async processing.

**Files:**
- `src/lib/db/schema.ts` — modify (add jobs table)
- `src/lib/automation/queue.ts` — create
- `src/lib/automation/__tests__/queue.test.ts` — create

**Implementation Details:**

**Schema:**
```typescript
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'fetch_transcript' | 'generate_embeddings'
  payload: jsonb('payload').notNull(), // { videoId, youtubeId, ... }
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('jobs_status_idx').on(table.status),
  typeIdx: index('jobs_type_idx').on(table.type),
}))
```

**Queue functions:**
```typescript
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  db = database
): Promise<number> {
  const [job] = await db.insert(jobs).values({ type, payload }).returning()
  return job.id
}

export async function claimNextJob(
  type?: JobType,
  db = database
): Promise<Job | null> {
  // SELECT ... WHERE status = 'pending' ORDER BY createdAt LIMIT 1 FOR UPDATE SKIP LOCKED
  // UPDATE status = 'processing', startedAt = now(), attempts++
  // Return the job
}

export async function completeJob(jobId: number, db = database): Promise<void>
export async function failJob(jobId: number, error: string, db = database): Promise<void>
```

**What Could Break:**
- Concurrent job claims — use FOR UPDATE SKIP LOCKED for safety
- Job stuck in processing — add timeout/cleanup mechanism

**Done When:**
- [ ] Jobs table created with proper indexes
- [ ] Can enqueue jobs with typed payloads
- [ ] Can claim and process jobs atomically
- [ ] Failed jobs increment attempts counter
- [ ] Tests cover: enqueue, claim, complete, fail, retry limit

---

### Chunk 4: Cron Endpoint & Delta Detection

**Goal:** Create cron-triggered endpoint that checks RSS feeds and queues new videos.

**Files:**
- `src/app/api/cron/check-feeds/route.ts` — create
- `src/lib/automation/delta.ts` — create
- `vercel.json` — modify (add cron config)
- `src/lib/automation/__tests__/delta.test.ts` — create

**Implementation Details:**

**Cron endpoint:**
```typescript
// GET /api/cron/check-feeds
// Called by Vercel cron scheduler
export async function GET(request: Request) {
  // Verify cron secret (Vercel adds CRON_SECRET header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const channels = await getChannelsForAutoFetch()
  let newVideosQueued = 0

  for (const channel of channels) {
    const feed = await fetchChannelFeed(channel.channelId)
    const newVideos = await findNewVideos(feed.videos, channel.id)

    for (const video of newVideos) {
      // Create video record
      const videoId = await createVideoFromRSS(video, channel.id)
      // Queue transcript fetch
      await enqueueJob('fetch_transcript', { videoId, youtubeId: video.youtubeId })
      newVideosQueued++
    }

    await updateChannelLastFetched(channel.id)
  }

  return NextResponse.json({ checked: channels.length, queued: newVideosQueued })
}
```

**Delta detection:**
```typescript
export async function findNewVideos(
  rssVideos: RSSVideo[],
  channelId: number,
  db = database
): Promise<RSSVideo[]> {
  // Get existing youtubeIds for this channel
  const existing = await db.select({ youtubeId: videos.youtubeId })
    .from(videos)
    .where(eq(videos.channelId, channelId))

  const existingIds = new Set(existing.map(v => v.youtubeId))

  // Return videos not in database
  return rssVideos.filter(v => !existingIds.has(v.youtubeId))
}
```

**Vercel cron config:**
```json
{
  "crons": [
    {
      "path": "/api/cron/check-feeds",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

**What Could Break:**
- Cron secret not set — fail gracefully with clear error
- Too many channels causing timeout — process in batches
- Rate limiting from YouTube — add delays between fetches

**Done When:**
- [ ] Cron endpoint responds to scheduled calls
- [ ] Auth check prevents unauthorized access
- [ ] Delta detection finds new videos correctly
- [ ] New videos queued for processing
- [ ] Channel lastFetchedAt updated
- [ ] Tests cover: delta detection, empty delta, auth failure

---

### Chunk 5: Job Processor & Pipeline Integration

**Goal:** Process queued jobs to fetch transcripts and generate embeddings.

**Files:**
- `src/app/api/cron/process-jobs/route.ts` — create
- `src/lib/automation/processor.ts` — create
- `vercel.json` — modify (add second cron)
- `src/lib/automation/__tests__/processor.test.ts` — create

**Implementation Details:**

**Job processor endpoint:**
```typescript
// GET /api/cron/process-jobs
// Runs more frequently to process queued work
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const results = { processed: 0, failed: 0 }
  const maxJobs = 10 // Process up to 10 jobs per invocation

  for (let i = 0; i < maxJobs; i++) {
    const job = await claimNextJob()
    if (!job) break

    try {
      await processJob(job)
      await completeJob(job.id)
      results.processed++
    } catch (error) {
      await failJob(job.id, error.message)
      results.failed++
    }
  }

  return NextResponse.json(results)
}
```

**Job processor:**
```typescript
export async function processJob(job: Job): Promise<void> {
  switch (job.type) {
    case 'fetch_transcript':
      await processFetchTranscript(job.payload as TranscriptJobPayload)
      break
    case 'generate_embeddings':
      await processGenerateEmbeddings(job.payload as EmbeddingsJobPayload)
      break
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}

async function processFetchTranscript(payload: TranscriptJobPayload) {
  const { videoId, youtubeId } = payload

  // Fetch transcript using existing youtube-transcript library
  const transcript = await fetchTranscript(youtubeId)

  // Store transcript
  await updateVideoTranscript(videoId, transcript)

  // Queue embedding generation
  await enqueueJob('generate_embeddings', { videoId })
}

async function processGenerateEmbeddings(payload: EmbeddingsJobPayload) {
  const { videoId } = payload

  // Use existing embeddings service
  await embedChunks(videoId, {
    onProgress: (p) => console.log(`Embedding progress: ${p.processed}/${p.total}`)
  })
}
```

**Additional cron config:**
```json
{
  "crons": [
    {
      "path": "/api/cron/check-feeds",
      "schedule": "0 */12 * * *"
    },
    {
      "path": "/api/cron/process-jobs",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**What Could Break:**
- Transcript fetch failures — retry with backoff
- Embedding failures — job marked failed, can retry manually
- Vercel function timeout (10s hobby, 60s pro) — limit jobs per invocation

**Done When:**
- [ ] Job processor claims and processes jobs
- [ ] Transcript jobs fetch and store transcripts
- [ ] Embedding jobs use existing embeddings service
- [ ] Failed jobs retry up to maxAttempts
- [ ] Second cron configured for job processing
- [ ] Tests cover: job processing, failure handling, retry logic

## Notes

- Vercel cron: https://vercel.com/docs/cron-jobs
- Run feed check 1-2x daily (every 12 hours)
- Run job processor every 5 minutes
- Delta detection: compare RSS youtubeIds against existing videos
- Database-backed queue for reliability (no external dependencies)
- Error handling with retry logic (max 3 attempts)
- Auto-insights deferred — would trigger Claude API calls for every video (cost implications)
