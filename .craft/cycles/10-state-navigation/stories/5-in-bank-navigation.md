---
name: discovery-in-bank-navigation
title: "Navigate to Video Detail from Discovery (In-Bank Videos)"
status: complete
cycle: state-navigation
story_number: 5
created: 2026-02-14
updated: 2026-02-14
priority: high
chunks_total: 2
chunks_complete: 2
---

# Story: Navigate to Video Detail from Discovery (In-Bank Videos)

## Spark
On the Discovery page, videos already in the knowledge bank should be clickable to navigate to their video detail page (`/videos/[id]`). Currently they only show an "In Bank" badge with no navigation affordance. The card thumbnail and title should link to the detail page, with `returnTo` support so the user can navigate back to Discovery with their filters preserved.

## Delivery
Chunk 1 builds a `youtubeId → dbId` map from the existing bank videos API response and plumbs it through DiscoveryVideoGrid to DiscoveryVideoCard as a `bankVideoId` prop. Chunk 2 uses that prop to wrap the thumbnail and title in a Next.js Link for in-bank videos, with `returnTo` query param for back-navigation. Together they make every in-bank video on Discovery a one-tap path to its detail page.

## Acceptance
- [ ] Given a video in the bank on Discovery, when I click the thumbnail or title, then I navigate to `/videos/[id]`
- [ ] Given I navigated from Discovery with filters active, when I use the back button on the detail page, then I return to Discovery with my filters preserved
- [ ] Given a video NOT in the bank, when I view it on Discovery, then the card behavior is unchanged (Add to Bank button, batch select checkbox)

## Chunks

### Chunk 1: Data Map + Prop Plumbing

**Goal:** Build `bankIdMap` in DiscoveryContent and pass through to cards.

**Files:**
- `src/components/discovery/DiscoveryContent.tsx` — modify
- `src/components/discovery/DiscoveryVideoGrid.tsx` — modify
- `src/components/discovery/DiscoveryVideoCard.tsx` — modify (add prop only)
- `src/components/discovery/__tests__/DiscoveryVideoCard.test.tsx` — modify

**Implementation Details:**
- In `DiscoveryContent.tsx`, inside the `fetchVideos` callback (line 122-132), alongside the `youtubeIdMap` for focus areas, build a parallel map:
  ```ts
  const bankIdMap: Record<string, number> = {}
  for (const video of bankData.videos) {
    if (video.youtubeId) {
      bankIdMap[video.youtubeId] = video.id
    }
  }
  ```
- Add state: `const [bankIdMap, setBankIdMap] = useState<Record<string, number>>({})`
- Pass `bankIdMap` to `<DiscoveryVideoGrid>` (line 333-343)
- In `DiscoveryVideoGrid.tsx`, accept `bankIdMap?: Record<string, number>` prop, pass `bankVideoId={bankIdMap?.[video.youtubeId]}` to each `<DiscoveryVideoCard>`
- In `DiscoveryVideoCard.tsx`, add `bankVideoId?: number` to `DiscoveryVideoCardProps` interface (no UI change yet)
- Tests: verify `bankVideoId` prop is passed through when video is in bank

**What Could Break:** Nothing — additive prop, no UI change yet.

**Done When:**
- [ ] `bankIdMap` state built from bank videos response
- [ ] Map passed through Grid to Card via `bankVideoId` prop
- [ ] Tests verify prop plumbing

### Chunk 2: Clickable Card Navigation

**Goal:** Make in-bank video cards navigate to detail page.

**Files:**
- `src/components/discovery/DiscoveryVideoCard.tsx` — modify
- `src/components/discovery/__tests__/DiscoveryVideoCard.test.tsx` — modify

**Implementation Details:**
- In `DiscoveryVideoCard.tsx`, when `isInBankOrDone && bankVideoId`, wrap the thumbnail + title area in a `<Link>`:
  ```ts
  const detailUrl = bankVideoId
    ? `/videos/${bankVideoId}${returnTo ? `?returnTo=${returnTo}` : ''}`
    : undefined
  ```
- Wrap the thumbnail `<div>` (line 73) and title `<h3>` (line 129) in a link when `detailUrl` exists. Use Next.js `<Link>` with hover states.
- Keep the "In Bank" badge, focus area badges, and batch status overlays as-is — only thumbnail + title become clickable.
- Add `cursor-pointer` styling when clickable.
- Tests: verify Link renders with correct href when `bankVideoId` provided + `inBank=true`, verify no Link when `bankVideoId` absent

**What Could Break:** Click targets could conflict with checkbox overlay, but checkboxes only show on non-bank videos (`selectable && !video.inBank`), so no conflict.

**Done When:**
- [ ] In-bank video thumbnail + title link to `/videos/[id]`
- [ ] `returnTo` query param included in link
- [ ] Non-bank videos unchanged
- [ ] Tests verify link rendering and href

## Notes
- Discovery already fetches bank videos via `/api/videos` for focus area mapping — can build a `youtubeId → dbId` map from that response
- `returnTo` param is already wired in DiscoveryContent and passed to cards
- Non-bank videos keep current behavior (Add to Bank button, batch select checkbox)
