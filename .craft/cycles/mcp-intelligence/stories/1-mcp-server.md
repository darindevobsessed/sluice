---
name: mcp-server
title: MCP Server
status: planning
priority: high
created: 2026-02-05
updated: 2026-02-05
cycle: mcp-intelligence
story_number: 1
chunks_total: 0
chunks_complete: 0
---

# Story: MCP Server

## Spark

Add a Model Context Protocol (MCP) server to Gold Miner so external tools can query your knowledge base. Use Vercel's MCP adapter for the transport layer. Create an API route that exposes tools other AI systems can call.

This is what makes Gold Miner useful beyond just you — Brad's Slingshot project could query your knowledge base to update curriculum based on new content.

> *"Add an MCP to your rag... Once once you once you've added the rag, you can add an MCP API to your GoldMiner. And then now I can programmatically access that RAG information."*
> *"Once you've done that, then I could add the GoldMiner MCP to Slingshot and say, what new information has come out that would modify my curriculum in some way?"*

**Tools to expose:**
- `search_rag` — parameters: creator, persona, topic, tag
- `get_list_of_creators` — returns all creators in the knowledge base
- Future: `get_creator_context`, `get_recent_insights`, `compare_perspectives`

## Dependencies

**Blocked by:** Cycle 1 Story 4 (RAG Search) — needs working RAG to expose
**Blocks:** None

## Acceptance

<!-- Detailed criteria added via plan-chunks -->

## Chunks

<!-- Detailed chunks added via plan-chunks -->

## Notes

- Vercel MCP adapter: https://vercel.com/docs/ai/mcp
- Consider authentication for MCP endpoints
- Design tools to be composable (Legos, not monoliths)
- Test with Claude Desktop as MCP client
