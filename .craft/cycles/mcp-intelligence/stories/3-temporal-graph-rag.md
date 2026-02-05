---
name: temporal-graph-rag
title: Temporal Graph RAG
status: planning
priority: medium
created: 2026-02-05
updated: 2026-02-05
cycle: mcp-intelligence
story_number: 3
chunks_total: 0
chunks_complete: 0
---

# Story: Temporal Graph RAG

## Spark

Add time-awareness to prevent outdated information from dominating results. When someone asks about "Cursor", don't return year-old information when the tool has changed significantly.

Detect version mentions, release dates, and freshness signals. Use temporal graph relationships to identify which content supersedes what.

> *"So if you say, hey. Tell me about cursor. It'll say, oh, I found 20 cursor things. And the one that's most relevant to your query is one from a year ago. It's gonna give you outdated cursor information."*
> *"Once you add a temporal graph rag, it will say, oh, he talked about this version of cursor. A new one came out. This one is outdated. Based off of a temporal timeline."*

## Dependencies

**Blocked by:** Story 2 (Graph RAG) — needs relationship infrastructure
**Blocks:** None

## Acceptance

<!-- Detailed criteria added via plan-chunks -->

## Chunks

<!-- Detailed chunks added via plan-chunks -->

## Notes

- Use Graffiti/graph-e-d library for temporal awareness
- Extract version numbers, release dates from content
- Decay function for relevance based on age
- "Supersedes" relationship type for updated info
- UI: Show freshness indicator on search results
- Consider "as of" date context in queries
