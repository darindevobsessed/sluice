---
name: discovery-redesign
title: Discovery Redesign
status: planning
priority: high
created: 2026-02-05
updated: 2026-02-05
cycle: experience
story_number: 2
chunks_total: 0
chunks_complete: 0
---

# Story: Discovery Redesign

## Spark

Completely redesign the discovery page to be the command center for staying current. Merge catch-up functionality into discovery — show unread summaries since last visit, prioritized by importance. Add similar creator suggestions based on who you already follow.

> *"I wanna catch up. Give me a catch up page. Where I don't have to watch all the videos and just lets me read it like their news articles and, like, this is very important. You probably read this one, and it just gives me a catch up since the last time that I looked at the page."*
> *"For your discovery, you should find similar creators. To the ones that you've already selected. Then if you could do that, then you can, like, go do some manual watching and then from here, you could add as, like, creator that I'm adding to the cron job."*

**Discovery page sections:**
1. Catch-up: New content since last visit, ranked by importance
2. Following: Latest from subscribed creators
3. Discover: Similar creators to explore

## Dependencies

**Blocked by:** Cycle 2 Story 4 (Automation) — needs automated content ingestion
**Blocks:** None

## Acceptance

<!-- Detailed criteria added via plan-chunks -->

## Chunks

<!-- Detailed chunks added via plan-chunks -->

## Notes

- Track "last visited" timestamp per user
- Importance ranking: use insights to determine priority
- Similar creators: use channel metadata and content similarity
- "Add to cron" button directly from discovery results
- Read/unread state for catch-up items
- Pulled backlog story (discovery-feed.md) as reference
