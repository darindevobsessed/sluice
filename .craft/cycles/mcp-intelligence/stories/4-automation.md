---
name: automation
title: Automation
status: planning
priority: medium
created: 2026-02-05
updated: 2026-02-05
cycle: mcp-intelligence
story_number: 4
chunks_total: 0
chunks_complete: 0
---

# Story: Automation

## Spark

Turn Gold Miner from a manual tool into an automated content pipeline. Set up cron jobs to monitor RSS feeds for followed channels. When new videos appear, automatically fetch transcripts and trigger the summarization agent.

Use Next.js built-in cron support. Queue processing for reliability.

> *"what you're gonna do is set up a cron job once a day, twice a day, whatever, checks the RSS feed. Checks against what you already have in terms of the video list, find the delta."*
> *"Cron Job, RSS, new video, programmatic extract, database, queue trigger agent to summarize, summarized, done."*

## Dependencies

**Blocked by:** Cycle 1 Story 2 (Programmatic Transcripts) — needs auto-fetch capability
**Blocks:** None

## Acceptance

<!-- Detailed criteria added via plan-chunks -->

## Chunks

<!-- Detailed chunks added via plan-chunks -->

## Notes

- Next.js cron: https://vercel.com/docs/cron-jobs
- Run 1-2x daily initially
- Delta detection: compare RSS against existing youtubeIds
- Queue system for batch processing (consider Inngest or simple DB queue)
- Notification when new content processed
- Manual trigger option in UI
- Error handling and retry logic
