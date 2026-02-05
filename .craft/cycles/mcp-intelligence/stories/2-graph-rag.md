---
name: graph-rag
title: Graph RAG
status: planning
priority: medium
created: 2026-02-05
updated: 2026-02-05
cycle: mcp-intelligence
story_number: 2
chunks_total: 0
chunks_complete: 0
---

# Story: Graph RAG

## Spark

Enhance RAG with relationship awareness. Compare chunks with each other to discover connections — when multiple creators talk about the same concept, when ideas build on each other, when there's disagreement or consensus.

Store relationships as edges between chunk nodes. Query traversal finds related content that pure vector similarity might miss.

> *"You can you can do graph rag. All you're doing is comparing the chunks with each other. That's your graph rag."*

## Dependencies

**Blocked by:** Cycle 1 Story 4 (RAG Search) — needs chunks and embeddings
**Blocks:** Story 3 (Temporal Graph RAG)

## Acceptance

<!-- Detailed criteria added via plan-chunks -->

## Chunks

<!-- Detailed chunks added via plan-chunks -->

## Notes

- Consider using Graffiti (graph-e-d) library Brad mentioned
- Relationship types: similar_topic, builds_on, contradicts, references
- Store in Postgres (not separate graph DB) for simplicity
- Batch job to compute relationships after new content added
- UI: Show related content on video detail page
