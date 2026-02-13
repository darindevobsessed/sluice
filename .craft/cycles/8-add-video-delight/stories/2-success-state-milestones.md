---
name: success-state-milestones
title: "Transform success state with milestones and what's next card"
status: active
priority: high
created: 2026-02-12
updated: 2026-02-12
cycle: add-video-delight
story_number: 2
chunks_total: 3
chunks_complete: 2
---

# Story: Transform success state with milestones and what's next card

## Spark
When a video is successfully added, the current success state is functional but flat — it doesn't celebrate or guide. This story transforms it with milestone detection (first video, 10th video, new channel) and a "What's next?" card that suggests natural next actions like viewing the video, extracting insights, or adding another. The success moment should feel like an achievement, not just a confirmation.

## Dependencies
**Blocked by:** none
**Blocks:** none

## Acceptance
- [ ] POST /api/videos returns milestone data (totalVideos, channelVideoCount, isNewChannel)
- [ ] Milestone message appears for counts 1, 5, 10, 25, 50, 100 and new channels
- [ ] No milestone message for non-milestone counts (most common case)
- [ ] "What's next?" card shows 3 actions: View Video, Add Another, Knowledge Bank
- [ ] All actions work (navigation + reset)
- [ ] Tone is warm and informational, not gamified (per locked pattern)
- [ ] `animate-fadeIn` no-op fixed to working `animate-in fade-in duration-200`
- [ ] SuccessState backward-compatible (milestones prop is optional)
- [ ] All tests pass (API + unit + integration)

## Chunks

### Chunk 1: Extend POST /api/videos response with milestone data

**Status:** pending

**Goal:** After inserting a video, query stats and return milestone context alongside the video object so the client has everything it needs without a second fetch.

**Files:**
- `src/app/api/videos/route.ts` — modify (around line 225, before the return)
- `src/app/api/videos/__tests__/route.test.ts` — modify (add test for milestone data in POST response)

**Implementation Details:**
- Import `getVideoStats` from `@/lib/db` and `getDistinctChannels` from `@/lib/db/search`
- After the `createdVideo` insert completes (line 224), before the return (line 225), add:
  ```ts
  const stats = await getVideoStats()
  const channels = await getDistinctChannels()
  const channelVideoCount = createdVideo.channel
    ? channels.find(c => c.channel === createdVideo.channel)?.videoCount ?? 0
    : 0
  ```
- Change response from `{ video: createdVideo }` to:
  ```ts
  {
    video: createdVideo,
    milestones: {
      totalVideos: stats.count,
      channelVideoCount,
      isNewChannel: channelVideoCount === 1 && createdVideo.channel !== null,
    }
  }
  ```
- Runs after insert — counts include the new video. No race condition.
- Response is backward-compatible — existing clients ignore extra `milestones` field.
- **Tests:** Add test verifying POST response includes `milestones` with expected shape. Verify `isNewChannel: true` when inserting first video from a channel.

**What Could Break:**
- `getDistinctChannels` may not be in `src/lib/db/index.ts` barrel — import directly from `src/lib/db/search` if needed
- Stats queries add ~2ms to POST response — negligible

**Done When:**
- [ ] POST /api/videos response includes `milestones` object
- [ ] `milestones.totalVideos` accurately reflects count after insert
- [ ] `milestones.isNewChannel` is true for first video from a channel
- [ ] API tests pass

---

### Chunk 2: Milestone message and "What's next?" card in SuccessState

**Status:** pending

**Goal:** Enhance SuccessState with a contextual milestone line below the success heading, and replace the two flat buttons with a "What's next?" card section offering 3 guided actions. Fix the `animate-fadeIn` no-op.

**Files:**
- `src/components/add-video/SuccessState.tsx` — modify (add milestone props, milestone text, "What's next?" section)
- `src/components/add-video/__tests__/SuccessState.test.tsx` — create (new test file)

**Implementation Details:**

**Extend SuccessState props** (line 7-14):
```ts
interface SuccessStateProps {
  title: string
  thumbnail?: string | null
  onReset: () => void
  description?: string
  videoId?: number | null
  sourceType?: 'youtube' | 'transcript'
  milestones?: {
    totalVideos: number
    channelVideoCount: number
    isNewChannel: boolean
  }
}
```

**Milestone detection logic** — pure helper function:
```ts
function getMilestoneMessage(
  milestones: SuccessStateProps['milestones'],
): string | null {
  if (!milestones) return null
  if (milestones.totalVideos === 1)
    return 'Your first video — welcome to your knowledge bank'
  if (milestones.isNewChannel)
    return 'A new creator in your knowledge bank'
  if (milestones.totalVideos === 5)
    return '5 videos strong — your collection is taking shape'
  if (milestones.totalVideos === 10)
    return '10 videos and counting — building something valuable'
  if (milestones.totalVideos === 25)
    return '25 videos — your knowledge bank is a real resource'
  if (milestones.totalVideos === 50)
    return '50 videos — impressive dedication'
  if (milestones.totalVideos === 100)
    return '100 videos — a serious knowledge base'
  return null
}
```
- First video (total=1) takes priority over isNewChannel when both true
- Most adds return `null` — no milestone. That's the common case.

**Milestone text** — render below the success heading (after line 33), only when exists:
```tsx
{milestoneMessage && (
  <p className="mb-6 text-sm text-primary animate-in fade-in duration-300">
    {milestoneMessage}
  </p>
)}
```
- `text-primary` (green) for subtle emphasis, `text-sm` keeps it secondary

**"What's next?" section** — replace the flat buttons (lines 58-73) with:
```tsx
<div className="space-y-3 text-left">
  <p className="text-sm font-medium text-muted-foreground">What's next?</p>
  {videoId && (
    <Link href={`/videos/${videoId}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent">
      <Eye className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="font-medium">View video details</p>
        <p className="text-muted-foreground">Explore the transcript, extract insights, and more</p>
      </div>
    </Link>
  )}
  <button onClick={onReset}
    className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-sm text-left transition-colors hover:bg-accent">
    <Plus className="h-4 w-4 text-muted-foreground" />
    <div>
      <p className="font-medium">Add another video</p>
      <p className="text-muted-foreground">Keep building your knowledge bank</p>
    </div>
  </button>
  <Link href="/"
    className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent">
    <Search className="h-4 w-4 text-muted-foreground" />
    <div>
      <p className="font-medium">Browse Knowledge Bank</p>
      <p className="text-muted-foreground">Search across everything you've collected</p>
    </div>
  </Link>
</div>
```
- Import `Eye`, `Plus`, `Search` from `lucide-react`
- Card pattern follows PersonaSuggestion.tsx style
- `text-left` overrides parent `text-center`
- `transition-colors` for hover (not `transition-all` — per GPU perf work)

**Fix `animate-fadeIn` no-op** — line 20: change `animate-fadeIn` to `animate-in fade-in duration-200`

**Tests (SuccessState.test.tsx):**
- Renders success heading and video title
- Shows milestone for totalVideos=1 (first video)
- Shows milestone for isNewChannel=true
- Shows no milestone for count=7 (non-milestone)
- Renders 3 "What's next?" action items
- "View video" links to `/videos/[id]`
- "Add another" calls onReset on click
- "Browse Knowledge Bank" links to `/`
- Backward-compatible with no milestones prop

**What Could Break:**
- Removing old Button-based layout changes visual structure — verify with and without milestones
- `animate-fadeIn` → `animate-in fade-in duration-200` is a visual fix (fadeIn was a no-op)

**Done When:**
- [ ] Milestone text appears for milestone counts
- [ ] New channel milestone works
- [ ] "What's next?" shows 3 action cards
- [ ] All actions work
- [ ] SuccessState tests pass

---

### Chunk 3: Wire milestone data from AddVideoPage to SuccessState

**Status:** pending

**Goal:** Pass milestone data from the POST API response through AddVideoPage state into SuccessState. Update integration tests.

**Files:**
- `src/components/add-video/AddVideoPage.tsx` — modify (store milestones from API response, pass to SuccessState)
- `src/components/add-video/__tests__/AddVideoPage.test.tsx` — modify (add milestone data to mock responses, test rendering)

**Implementation Details:**

**AddVideoPage state:**
- Add `const [milestones, setMilestones] = useState<{ totalVideos: number, channelVideoCount: number, isNewChannel: boolean } | undefined>()`
- After parsing POST response (where `data.video` is extracted), also extract `data.milestones` and call `setMilestones(data.milestones)`
- Pass `milestones={milestones}` to `<SuccessState>` alongside existing props
- Reset milestones in `handleReset` function

**Test updates (AddVideoPage.test.tsx):**
- Update mock POST responses to include `milestones` field: `{ video: {...}, milestones: { totalVideos: 1, channelVideoCount: 1, isNewChannel: true } }`
- Add test: milestone message renders in success state after submission
- Add test: milestones reset when user clicks "Add Another"

**What Could Break:**
- Story 1 also modifies AddVideoPage.test.tsx — implementer should read current file state
- The `data.milestones` extraction must be null-safe (API might not return it in edge cases)

**Done When:**
- [ ] Milestone data flows from API → AddVideoPage state → SuccessState props
- [ ] Milestone message renders on success screen
- [ ] Milestones reset on "Add Another"
- [ ] All AddVideoPage integration tests pass
