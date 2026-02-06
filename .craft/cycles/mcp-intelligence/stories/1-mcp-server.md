---
name: mcp-server
title: MCP Server
status: active
priority: high
created: 2026-02-05
updated: 2026-02-06
cycle: mcp-intelligence
story_number: 1
chunks_total: 4
chunks_complete: 3
current_chunk: 4
---

# Story: MCP Server

## Spark

Add a Model Context Protocol (MCP) server to Gold Miner so external tools can query your knowledge base. Use Vercel's mcp-handler for the transport layer. Create an API route that exposes tools other AI systems can call.

This is what makes Gold Miner useful beyond just you — Brad's Slingshot project could query your knowledge base to update curriculum based on new content.

> *"Add an MCP to your rag... Once once you once you've added the rag, you can add an MCP API to your GoldMiner. And then now I can programmatically access that RAG information."*
> *"Once you've done that, then I could add the GoldMiner MCP to Slingshot and say, what new information has come out that would modify my curriculum in some way?"*

**Tools to expose (MVP):**
- `search_rag` — parameters: creator (channel filter), topic (search query)
- `get_list_of_creators` — returns all distinct channels in the knowledge base

**Future tools (after Personas & Ensemble):**
- `search_rag` extended with: persona, tag parameters
- `get_creator_context`, `get_recent_insights`, `compare_perspectives`

## Dependencies

**Blocked by:** RAG Foundation cycle (complete ✓) — needs working RAG to expose
**Blocks:** None

## Acceptance

- [ ] MCP endpoint responds at `/api/mcp`
- [ ] `search_rag` tool returns relevant results for topic queries
- [ ] `search_rag` filters by creator (channel) when provided
- [ ] `get_list_of_creators` returns all distinct channels with video counts
- [ ] Auth enabled when `MCP_AUTH_ENABLED=true` (Bearer token)
- [ ] Auth disabled by default for local development
- [ ] Can connect and query from Claude Desktop
- [ ] Tests cover both tools and auth scenarios
- [ ] README documents MCP setup

## Chunks

### Chunk 1: Install Dependencies & Basic MCP Route

**Goal:** Set up MCP infrastructure with Vercel's mcp-handler, create the API route skeleton.

**Files:**
- `package.json` — modify (add dependencies)
- `src/app/api/mcp/[transport]/route.ts` — create
- `src/lib/mcp/types.ts` — create

**Implementation Details:**
- Install: `npm install mcp-handler @modelcontextprotocol/sdk@1.25.2 zod@^3`
- Create route at `app/api/mcp/[transport]/route.ts` (dynamic transport for SSE/HTTP)
- Use `createMcpHandler` from mcp-handler
- Configure with `basePath: "/api/mcp"`, `maxDuration: 60`
- Types file defines `SearchRagParams` and `CreatorListResponse` interfaces
- No tools registered yet — just verify the handler responds

**What Could Break:**
- mcp-handler may need specific zod version — pin to ^3 as docs suggest
- Transport path must match basePath config exactly

**Done When:**
- [ ] Dependencies installed
- [ ] Route responds to MCP protocol handshake
- [ ] No TypeScript errors
- [ ] Can connect from Claude Desktop (basic ping)

---

### Chunk 2: Implement `search_rag` Tool

**Goal:** Create MCP tool that wraps existing hybridSearch with creator (channel) filtering.

**Files:**
- `src/lib/mcp/tools.ts` — create
- `src/lib/db/search.ts` — modify (add `searchWithCreatorFilter` or extend existing)
- `src/app/api/mcp/[transport]/route.ts` — modify (register tool)

**Implementation Details:**
- Tool name: `search_rag`
- Parameters (Zod schema):
  - `topic: z.string().describe("Search query for the knowledge base")`
  - `creator: z.string().optional().describe("Filter by creator/channel name")`
  - `limit: z.number().int().min(1).max(50).default(10).optional()`
- Implementation wraps `hybridSearch()` from `@/lib/search/hybrid-search`
- If `creator` provided, add WHERE clause filtering by channel
- Use `aggregateByVideo()` to group results
- Return format: `{ content: [{ type: "text", text: JSON.stringify(results) }] }`
- Include video title, channel, relevant chunks with timestamps

**What Could Break:**
- hybridSearch doesn't currently accept channel filter — need to extend or filter results post-query
- Large result sets could exceed MCP response limits — enforce limit parameter

**Done When:**
- [ ] `search_rag` registered and callable via MCP
- [ ] Returns results for topic-only queries
- [ ] Returns filtered results when creator specified
- [ ] Results include video context (title, channel, chunks)
- [ ] Empty results return gracefully

---

### Chunk 3: Implement `get_list_of_creators` Tool

**Goal:** Create MCP tool that returns all distinct channels (creators) in the knowledge base.

**Files:**
- `src/lib/mcp/tools.ts` — modify
- `src/lib/db/queries.ts` — modify (add `getDistinctChannels` function)
- `src/app/api/mcp/[transport]/route.ts` — modify (register tool)

**Implementation Details:**
- Tool name: `get_list_of_creators`
- No parameters required
- Query: `SELECT DISTINCT channel, COUNT(*) as video_count FROM videos GROUP BY channel ORDER BY video_count DESC`
- Return format: `{ content: [{ type: "text", text: JSON.stringify(creators) }] }`
- Include channel name and video count for each creator
- Follow existing pattern in `getVideoStats()` which does `count(distinct channel)`

**What Could Break:**
- Empty database should return empty array, not error

**Done When:**
- [ ] `get_list_of_creators` registered and callable via MCP
- [ ] Returns all distinct channels with video counts
- [ ] Sorted by video count descending
- [ ] Empty database returns `[]`

---

### Chunk 4: Auth, Testing & Documentation

**Goal:** Add environment-based authentication, write tests, document Claude Desktop setup.

**Files:**
- `src/lib/mcp/auth.ts` — create
- `src/app/api/mcp/[transport]/route.ts` — modify (add auth middleware)
- `src/lib/mcp/__tests__/tools.test.ts` — create
- `src/app/api/mcp/__tests__/route.test.ts` — create
- `README.md` — modify (add MCP section)

**Implementation Details:**

**Auth (env-based):**
- Create `MCP_AUTH_ENABLED` and `MCP_AUTH_TOKEN` env vars
- When `MCP_AUTH_ENABLED=true`, require Bearer token matching `MCP_AUTH_TOKEN`
- Use `experimental_withMcpAuth` from mcp-handler to access token
- Default: auth disabled locally, enabled in production

**Tests:**
- Unit tests for tool functions (mock database)
- Integration test for route handler
- Test both authenticated and unauthenticated scenarios
- Follow existing pattern from `src/app/api/search/__tests__/route.test.ts`

**Documentation:**
- Add "MCP Integration" section to README
- Claude Desktop config example:
  ```json
  {
    "mcpServers": {
      "gold-miner": {
        "command": "npx",
        "args": ["mcp-remote", "http://localhost:3000/api/mcp"]
      }
    }
  }
  ```
- Document available tools and their parameters
- Note auth configuration for production

**What Could Break:**
- Auth token mismatch between env and client config
- mcp-remote may need specific version

**Done When:**
- [ ] Auth works when `MCP_AUTH_ENABLED=true`
- [ ] Auth bypassed when `MCP_AUTH_ENABLED=false` or unset
- [ ] Unit tests pass for both tools
- [ ] Integration test verifies MCP protocol
- [ ] README documents setup for Claude Desktop
- [ ] Can successfully query from Claude Desktop

## Notes

- Vercel MCP handler: https://github.com/vercel/mcp-handler
- Design tools to be composable (Legos, not monoliths)
- Test with Claude Desktop as MCP client
- Persona/tag parameters deferred to Experience cycle (Personas & Ensemble story)
- channel ≈ creator in this codebase

## Sources

- [Vercel MCP Handler GitHub](https://github.com/vercel/mcp-handler)
- [MCP Template](https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js)
