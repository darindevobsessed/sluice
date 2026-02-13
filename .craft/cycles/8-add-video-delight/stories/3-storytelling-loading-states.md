---
name: storytelling-loading-states
title: "Storytelling loading state messages"
status: active
priority: medium
created: 2026-02-12
updated: 2026-02-13
cycle: add-video-delight
story_number: 3
chunks_total: 3
chunks_complete: 1
---

# Story: Storytelling loading state messages

## Spark
Loading states during video processing are currently generic spinners or static text. This story replaces them with rotating, contextual messages that tell a story about what's happening — "Fetching video metadata from YouTube...", "Reading the transcript...", "Almost there...". The messages should feel informative and human, turning wait time into engagement time. Apply to both the Add Video page processing steps and the TranscriptSection fetch.

## Dependencies
**Blocked by:** Story 1 (celebrate-transcript-fetch touches TranscriptSection first)
**Blocks:** none

## Acceptance
- [ ] Transcript fetch shows rotating contextual messages (4 messages, 3s interval)
- [ ] Metadata loading spinner shows rotating messages with text
- [ ] Submit buttons say "Adding to your Knowledge Bank..." instead of "Saving..."
- [ ] Messages feel informative and human (not clinical)
- [ ] prefers-reduced-motion shows first message only (no rotation)
- [ ] useRotatingMessages hook is reusable and well-tested
- [ ] All tests pass (hook + component + integration)
- [ ] No visual regression on existing loading states

## Chunks

### Chunk 1: Create useRotatingMessages hook

**Status:** pending

**Goal:** Build a reusable hook that cycles through an array of messages on a timer, returning the current message. Include prefers-reduced-motion support.

**Files:**
- `src/hooks/useRotatingMessages.ts` — create
- `src/hooks/__tests__/useRotatingMessages.test.ts` — create

**Implementation Details:**

**Hook signature:**
```ts
export function useRotatingMessages(
  messages: string[],
  intervalMs = 3000,
): string
```

**Implementation:**
```ts
'use client'

import { useState, useEffect } from 'react'

export function useRotatingMessages(
  messages: string[],
  intervalMs = 3000,
): string {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) return

    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % messages.length)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [messages.length, intervalMs])

  useEffect(() => {
    setIndex(0)
  }, [messages])

  return messages[index] ?? messages[0]
}
```

- Returns `messages[0]` on first render — tests can reliably match first message
- prefers-reduced-motion stays on first message
- Resets to index 0 when messages array reference changes
- Cleanup on unmount via clearInterval
- Callers should define message arrays at module level (outside component) to avoid reference instability

**Tests (useRotatingMessages.test.ts):**
- Returns first message initially
- Cycles to next message after interval (`vi.useFakeTimers()` + `vi.advanceTimersByTime()`)
- Wraps around to first message after all shown
- Respects prefers-reduced-motion (mock `window.matchMedia`)
- Cleans up timer on unmount
- Resets index when messages array changes

**What Could Break:**
- `window.matchMedia` not available in test env — mock with `vi.stubGlobal`
- Messages array stability — document that callers should define outside component

**Done When:**
- [ ] Hook returns current message from rotation
- [ ] 3-second default interval
- [ ] prefers-reduced-motion shows first message only
- [ ] Timer cleans up on unmount
- [ ] All hook tests pass

---

### Chunk 2: TranscriptSection + AddVideoPage loading messages

**Status:** pending

**Goal:** Apply rotating messages to the transcript fetch spinner (TranscriptSection) and the metadata loading spinner (AddVideoPage).

**Files:**
- `src/components/add-video/TranscriptSection.tsx` — modify (fetching state block)
- `src/components/add-video/AddVideoPage.tsx` — modify (metadata loading block, lines ~304-308)
- `src/components/add-video/__tests__/TranscriptSection.test.tsx` — modify (fetching text assertion)
- `src/components/add-video/__tests__/AddVideoPage.test.tsx` — modify (fetching text assertion)

**Implementation Details:**

**TranscriptSection.tsx:**
- Import `useRotatingMessages` from `@/hooks/useRotatingMessages`
- Define message array at module level (outside component):
  ```ts
  const TRANSCRIPT_FETCH_MESSAGES = [
    'Fetching transcript from YouTube...',
    'Reading through the content...',
    'Pulling it all together...',
    'Almost there...',
  ]
  ```
- Inside component, call hook:
  ```ts
  const fetchMessage = useRotatingMessages(TRANSCRIPT_FETCH_MESSAGES)
  ```
- Replace static "Fetching transcript..." text with `{fetchMessage}`
- Keep the spinner div as-is
- **Note:** After Story 1 lands, line numbers will shift. Find the `{isFetching && (` block and replace text within it.

**AddVideoPage.tsx:**
- Import `useRotatingMessages` from `@/hooks/useRotatingMessages`
- Define at module level:
  ```ts
  const METADATA_FETCH_MESSAGES = [
    'Looking up this video...',
    'Fetching details from YouTube...',
    'Getting everything ready...',
  ]
  ```
- Call hook at component level (unconditionally, per React rules):
  ```ts
  const metadataMessage = useRotatingMessages(METADATA_FETCH_MESSAGES)
  ```
- Replace bare spinner (lines ~304-308) with spinner + text:
  ```tsx
  {loading && (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{metadataMessage}</p>
    </div>
  )}
  ```

**Test updates:**
- TranscriptSection.test.tsx: Change `/fetching transcript/i` to `/fetching transcript from youtube/i`
- AddVideoPage.test.tsx: Change `/fetching transcript/i` to `/fetching transcript from youtube/i`

**What Could Break:**
- Story 1 shifts TranscriptSection line numbers — implementer finds by pattern, not line number
- Hook called unconditionally even when not loading — negligible cost
- Message arrays at module level to avoid reference changes

**Done When:**
- [ ] TranscriptSection shows rotating messages during fetch
- [ ] AddVideoPage metadata spinner shows rotating messages
- [ ] Messages rotate every 3 seconds
- [ ] First message appears immediately
- [ ] All tests pass

---

### Chunk 3: Submit button text improvements

**Status:** pending

**Goal:** Replace "Saving..." in both submit buttons with a contextual message. Single message, not rotating — submit is too fast (1-3s) for rotation.

**Files:**
- `src/components/add-video/AddVideoPage.tsx` — modify (submit button text, line ~382)
- `src/components/add-transcript/AddTranscriptPage.tsx` — modify (submit button text, line ~172)
- `src/components/add-transcript/__tests__/AddTranscriptPage.test.tsx` — modify (text assertion)

**Implementation Details:**

**AddVideoPage.tsx (line ~382):**
- Change `Saving...` to `Adding to your Knowledge Bank...`
- No hook needed — single static message

**AddTranscriptPage.tsx (line ~172):**
- Change `Saving...` to `Adding to your Knowledge Bank...`
- Same message for consistency

**Test updates:**
- AddTranscriptPage.test.tsx: Change `/saving/i` to `/adding to your knowledge bank/i`
- Check AddVideoPage.test.tsx for any `/saving/i` assertions — update if found

**What Could Break:**
- Tests matching on "Saving" text — update all matchers
- Story 2 may have modified AddVideoPage.tsx — implementer reads current state

**Done When:**
- [ ] Submit buttons say "Adding to your Knowledge Bank..." instead of "Saving..."
- [ ] Both pages use same message (consistency)
- [ ] All tests pass
