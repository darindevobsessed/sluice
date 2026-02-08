---
name: similar-creators
title: Similar Creators
status: complete
priority: medium
created: 2026-02-07
updated: 2026-02-08
cycle: experience
story_number: 3
chunks_total: 4
chunks_complete: 4
current_chunk: 5
---

# Story: Similar Creators

## Spark

Add a "Discover" section to the discovery page that suggests similar creators based on content similarity. Use existing RAG embeddings to compare channel content and find topic overlap. Users can explore suggested creators and add them to their follow list or cron automation directly.

> *"For your discovery, you should find similar creators. To the ones that you've already selected. Then if you could do that, then you can, like, go do some manual watching and then from here, you could add as, like, creator that I'm adding to the cron job."*

**Key decisions:**
- Content-based similarity using existing RAG embeddings
- Average all chunk embeddings per channel into a centroid vector, then cosine similarity between centroids
- Compare followed channels against all known channels in videos table
- "Add to cron" button directly from discovery results
- Suggestions update when user follows more creators or adds more videos

## Dependencies

**Blocked by:** Story 2 (Discovery & Following) — needs channel following infrastructure and discovery page
**Blocks:** None

## Acceptance

- [ ] "Discover Similar Creators" section appears on discovery page
- [ ] Similar channels shown as recommendation cards with channel name, similarity score, video count, and sample titles
- [ ] "Follow" button creates channel entry and adds to following list
- [ ] "Add to Cron" enables auto-fetch for recommended channel
- [ ] Already-followed channels excluded from suggestions
- [ ] Channels with fewer than 3 embedded videos excluded (unreliable)
- [ ] Empty state when no suggestions available (guides user to follow more channels)
- [ ] Skeleton loading while computing similarity
- [ ] Responsive layout on mobile
- [ ] Suggestions refresh after following a channel or adding new videos

## Chunks

### Chunk 1: Channel Embedding Aggregation & Similarity Engine

**Goal:** Create backend logic to compute channel centroid vectors (average of all chunk embeddings) and find similar channels via cosine similarity.

**Files:**
- `src/lib/channels/similarity.ts` — create (centroid computation + channel-to-channel similarity)
- `src/lib/channels/__tests__/similarity.test.ts` — create
- `src/lib/graph/compute-relationships.ts` — modify (export `cosineSimilarity` function for reuse)

**Implementation Details:**
- `computeChannelCentroid(channelName: string)`: query all chunks for videos by that channel, average their embedding vectors -> returns 384-dim centroid vector
- `findSimilarChannels(followedChannels: string[], options?: { threshold?: number, limit?: number })`: compute centroids for all followed channels, compare against centroids of all OTHER known channels in DB (by channel name from videos table), return ranked list above threshold
- Extract `cosineSimilarity` from `compute-relationships.ts` into exported function for reuse
- Threshold default: 0.6 (lower than chunk-to-chunk 0.75 since channel centroids are more averaged)
- Limit default: 10 similar channels
- Channel names come from `videos.channel` field (already populated for all banked videos)
- Filter out channels already being followed (compare against channels table)

**What Could Break:**
- Channels with few videos (< 3) may produce unreliable centroids — add minimum threshold
- Computing centroids on-the-fly could be slow for large banks — acceptable for MVP

**Done When:**
- [ ] `computeChannelCentroid` returns averaged embedding vector for a channel
- [ ] `findSimilarChannels` returns ranked similar channels above threshold
- [ ] Already-followed channels filtered out
- [ ] Channels with < 3 embedded videos excluded
- [ ] cosineSimilarity function reusable across modules
- [ ] Tests cover edge cases (no embeddings, single channel, identical channels)

---

### Chunk 2: Similar Channels API Route

**Goal:** Create GET endpoint that returns similar channel recommendations based on followed channels.

**Files:**
- `src/app/api/channels/similar/route.ts` — create (GET endpoint)

**Implementation Details:**
- GET `/api/channels/similar`: fetch all followed channels from channels table, call `findSimilarChannels()`, return results with metadata
- Response shape: `{ suggestions: Array<{ channelName: string, similarity: number, videoCount: number, sampleTitles: string[] }> }`
- Include `videoCount` (how many videos by this channel are in the bank) and `sampleTitles` (top 3 video titles) for context
- Optional query param `?limit=N` for controlling result count
- Zod validation on query params
- Handle edge cases: no followed channels -> return empty array with message, no similar found -> return empty array

**What Could Break:**
- Performance with many followed channels — each needs centroid computation
- No followed channels scenario (user hasn't completed Story 2 setup)

**Done When:**
- [ ] GET returns similar channels with similarity scores
- [ ] Response includes videoCount and sampleTitles for each suggestion
- [ ] Empty states handled gracefully
- [ ] Zod validation on params

---

### Chunk 3: Discover Section UI

**Goal:** Build "Discover Similar Creators" section for the discovery page with channel recommendation cards.

**Files:**
- `src/components/discovery/SimilarCreatorsSection.tsx` — create (section with header + card row)
- `src/components/discovery/ChannelRecommendationCard.tsx` — create (card with channel info + follow/cron actions)
- `src/app/discovery/page.tsx` — modify (add Discover section below catch-up and following sections)

**Implementation Details:**
- SimilarCreatorsSection: header "Discover Similar Creators", horizontal scroll row of ChannelRecommendationCard
- ChannelRecommendationCard: Card component with channel name (bold), similarity percentage (Badge), video count, 2-3 sample video titles, "Follow" button + "Add to Cron" button
- "Follow" button: calls POST `/api/channels` (from Story 2) — needs channel ID resolution, may need to create channel entry first
- "Add to Cron": calls PATCH `/api/channels/[id]/automation` with `autoFetch: true` (existing endpoint)
- After following, card transitions to "Following" state and removes from suggestions on next refresh
- Empty state: "Follow more channels and add videos to get personalized suggestions"
- Skeleton loading while computing similarity
- Section only shows if user has followed channels AND has banked videos with embeddings

**What Could Break:**
- "Follow" action needs a channel ID — similar channels come from video data (channel name), not channels table. May need to create channel entry + resolve RSS feed URL.
- Story 2 discovery page layout must be complete to integrate

**Done When:**
- [ ] Discover section shows on discovery page
- [ ] Cards display channel name, similarity, video count, sample titles
- [ ] "Follow" creates channel entry and adds to following
- [ ] "Add to Cron" enables auto-fetch
- [ ] Card updates state after actions
- [ ] Empty state when no suggestions available
- [ ] Skeleton loading

---

### Chunk 4: Polish & Edge Cases

**Goal:** Handle edge cases, add animations, optimize performance, and ensure clean integration with Story 2's discovery page.

**Files:**
- `src/components/discovery/SimilarCreatorsSection.tsx` — modify (add hover animations, scroll-snap)
- `src/components/discovery/ChannelRecommendationCard.tsx` — modify (hover lift, action button states)
- `src/lib/channels/similarity.ts` — modify (performance guard: abort if computation exceeds 5 seconds)
- `src/app/discovery/page.tsx` — modify (responsive layout, loading coordination)

**Implementation Details:**
- Hover lift on recommendation cards: `transition-all duration-200 hover:scale-[1.02] hover:shadow-lg` (match existing pattern)
- Scroll-snap: same horizontal scroll pattern as Story 2's channel sections
- Performance guard: if centroid computation takes > 5s, return partial results with warning
- Refresh: "Refresh suggestions" button to re-compute similarity (useful after following new channels or adding videos)
- Responsive: on mobile, cards stack in 2-column grid instead of horizontal scroll
- Final sweep: verify all loading/error/empty states, no console errors

**What Could Break:**
- Similarity scores may be low for diverse content libraries — adjust threshold if needed
- Mobile layout needs testing

**Done When:**
- [ ] Hover animations match existing patterns
- [ ] Responsive layout works on mobile
- [ ] Performance guard prevents slow computations
- [ ] Refresh button re-computes suggestions
- [ ] All states (loading, empty, error) render correctly
- [ ] No console errors

## Notes

- Aggregate channel embeddings to create a "channel profile vector" (average centroid)
- Compare followed channels against all known channels in videos table
- Start simple: content-based similarity from banked video embeddings
- "Add to cron" reuses existing automation PATCH endpoint
- Similarity threshold: 0.6 default (tunable)
- Minimum 3 embedded videos per channel for reliable centroid
- cosineSimilarity function extracted from compute-relationships.ts for reuse
- Performance: on-the-fly computation for MVP, consider caching if slow
