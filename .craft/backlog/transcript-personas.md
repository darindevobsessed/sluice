---
name: transcript-personas
title: Enable personas for non-video transcripts
status: planning
created: 2026-02-11
updated: 2026-02-11
priority: medium
chunks_total: 0
chunks_complete: 0
---

# Story: Enable personas for non-video transcripts

## Spark
Non-video transcripts are currently invisible to the persona system because they have `channel: null`. Personas are built by grouping videos by channel name, so transcripts without a channel are excluded. Need a way to give non-video transcripts a source/author identifier so they can participate in persona creation and chat.
