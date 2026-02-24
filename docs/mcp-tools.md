# MCP Tools Reference

Sluice exposes 4 MCP tools for Claude Code integration via the [Model Context Protocol](https://modelcontextprotocol.io/). Once connected, Claude can search your video library, list creators, chat with personas, and run ensemble queries — all from your terminal.

Source: [`src/lib/mcp/tools.ts`](../src/lib/mcp/tools.ts)

---

## Connecting to Claude Code

Add Sluice to your MCP configuration. The config file location depends on your scope:

### Project-level (recommended)

Create a `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "sluice": {
      "type": "sse",
      "url": "http://localhost:3001/api/mcp/sse"
    }
  }
}
```

This makes Sluice available only in this project. The file can be committed to version control so team members get MCP access automatically.

### User-level (global)

Add Sluice to all projects:

```bash
claude mcp add -s user sluice --type sse --url http://localhost:3001/api/mcp/sse
```

### Verify connection

In Claude Code, ask:
```
"List my MCP tools"
```

You should see: `search_rag`, `get_list_of_creators`, `chat_with_persona`, `ensemble_query`.

> **Prerequisite:** Sluice's dev server must be running (`npm run dev`) for MCP tools to work. In production, replace `localhost:3001` with your deployment URL.

---

## search_rag

Search the knowledge bank using hybrid vector + keyword search with Reciprocal Rank Fusion.

**Source:** `registerSearchRag()` in [`src/lib/mcp/tools.ts:21-78`](../src/lib/mcp/tools.ts)

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` | `string` | Yes | — | Search query for the knowledge base |
| `creator` | `string` | No | — | Filter results by creator/channel name (case-insensitive partial match via `.includes()`) |
| `limit` | `integer` | No | `10` | Maximum number of results (1-50, validated by `z.number().int().min(1).max(50)`) |

### How It Works

1. Performs `hybridSearch(topic, { limit })` — vector + keyword search with RRF fusion
2. If `creator` is provided, filters results where `channel.toLowerCase().includes(creator.toLowerCase())`
3. Aggregates results by video via `aggregateByVideo()`
4. Enriches each video with `knowledgePrompt` from AI insights (if available)
5. Returns JSON array of enriched video results

### Example

**Input:**
```json
{
  "topic": "React Server Components best practices",
  "creator": "Theo",
  "limit": 5
}
```

**Output:**
```json
[
  {
    "videoId": 42,
    "youtubeId": "abc123",
    "title": "Why RSC Changes Everything",
    "channel": "Theo",
    "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    "score": 0.032,
    "matchedChunks": 3,
    "bestChunk": {
      "content": "The key insight about Server Components is that they're not about performance...",
      "startTime": 245,
      "similarity": 0.032
    },
    "knowledgePrompt": "How do React Server Components change the way you think about data fetching architecture?"
  }
]
```

The response is wrapped in MCP's `content` array format: `{ content: [{ type: "text", text: "<JSON above>" }] }`. Claude Code parses this automatically.

Videos with a `knowledgePrompt` field contain distilled learnings from AI extraction. When present, the response includes a header: "Videos with a `knowledgePrompt` field contain distilled learnings and actionable techniques from the content."

### Tips

- Use natural language queries for best results ("how to optimize database queries" not "db optimize")
- The `creator` filter does **partial matching** — "Theo" matches "Theo - t3.gg" and "Theo Browne"
- Higher `limit` values are useful when filtering by creator (search finds more candidates before filtering)
- Scores in hybrid mode are RRF scores (typically 0.01-0.03), not raw similarity values

---

## get_list_of_creators

List all YouTube channels in the knowledge bank with video counts.

**Source:** `registerGetListOfCreators()` in [`src/lib/mcp/tools.ts:88-103`](../src/lib/mcp/tools.ts)

### Parameters

None.

### Example

**Input:**
```json
{}
```

**Output:**
```json
[
  { "channel": "Theo", "videoCount": 45 },
  { "channel": "ThePrimeagen", "videoCount": 32 },
  { "channel": "Fireship", "videoCount": 28 },
  { "channel": "Jack Herrington", "videoCount": 15 }
]
```

Results are sorted by video count descending. Uses `getDistinctChannels()` from [`src/lib/db/search.ts`](../src/lib/db/search.ts).

### When to Use

- Before `chat_with_persona` — check what creators have personas available
- Before filtering `search_rag` by creator — see what channels exist
- To understand the scope of your knowledge bank

---

## chat_with_persona

Query a specific creator persona. The persona responds based on their YouTube content and communication style, grounded in relevant transcript chunks via RAG.

**Source:** `registerChatWithPersona()` in [`src/lib/mcp/tools.ts:177-212`](../src/lib/mcp/tools.ts)

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `personaName` | `string` | Yes | — | Name of the persona or channel name (case-insensitive match against both `persona.name` and `persona.channelName`) |
| `question` | `string` | Yes | — | Question to ask the persona |

### How It Works

1. Searches all personas for a match on `name` or `channelName` (case-insensitive)
2. `getPersonaContext()` retrieves relevant chunks from that creator's videos via RAG
3. `formatContextForPrompt()` injects matched chunks into the persona's system prompt
4. Sends enriched prompt to Claude (Sonnet 4) via Agent SDK non-streaming query
5. Returns the response with up to 5 source citations

### Example

**Input:**
```json
{
  "personaName": "ThePrimeagen",
  "question": "Should I use Rust for CLI tools?"
}
```

**Output:**
```json
{
  "persona": "ThePrimeagen",
  "answer": "Look, if you're building a CLI tool and you already know TypeScript, just use Bun. Seriously. Rust is amazing but the compile times will slow you down for something that doesn't need zero-cost abstractions...",
  "sources": [
    {
      "videoTitle": "Rust vs TypeScript for CLI Tools",
      "content": "When I built my first CLI in Rust I spent 3 hours fighting the borrow checker..."
    },
    {
      "videoTitle": "Why I Use TypeScript for Everything",
      "content": "The DX of TypeScript tooling is just unmatched right now..."
    }
  ]
}
```

### Prerequisites

Personas require **30+ videos** from a single channel. To check available personas, ask Claude Code:

```
"Which creator personas do I have in Sluice?"
```

Or use `get_list_of_creators` and look for channels with 30+ videos.

### Error Handling

If the persona doesn't exist, the tool returns an error in MCP format:

```json
{
  "content": [{ "type": "text", "text": "Error: Persona not found: NonexistentCreator" }],
  "isError": true
}
```

---

## ensemble_query

Ask a question to all available personas simultaneously. Returns parallel responses from the top 3 most relevant creators based on expertise embedding similarity.

**Source:** `registerEnsembleQuery()` in [`src/lib/mcp/tools.ts:220-290`](../src/lib/mcp/tools.ts)

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `question` | `string` | Yes | — | Question to ask all personas |

### How It Works

1. Retrieves all personas from the database
2. `findBestPersonas(question, allPersonas, 3)` embeds the question, computes cosine similarity against each persona's expertise centroid, and selects the top 3
3. Queries all 3 personas in parallel via `Promise.allSettled()` (failures don't block other responses)
4. Each persona query uses the same `queryPersona()` function as `chat_with_persona`
5. Returns the best match score and all successful responses

### Example

**Input:**
```json
{
  "question": "What's the best way to handle authentication in a Next.js app?"
}
```

**Output:**
```json
{
  "question": "What's the best way to handle authentication in a Next.js app?",
  "bestMatch": {
    "persona": "Theo",
    "score": 0.89
  },
  "responses": [
    {
      "persona": "Theo",
      "answer": "Use Auth.js (NextAuth) for most cases. The new v5 has...",
      "sources": [{ "videoTitle": "Auth in 2025", "content": "..." }]
    },
    {
      "persona": "ThePrimeagen",
      "answer": "JWT for the API layer, session cookies for the web app...",
      "sources": [{ "videoTitle": "Auth Patterns", "content": "..." }]
    },
    {
      "persona": "Jack Herrington",
      "answer": "The middleware approach in Next.js is underrated...",
      "sources": [{ "videoTitle": "Next.js Middleware", "content": "..." }]
    }
  ]
}
```

### How "Who's Best?" Routing Works

1. Your question is embedded into a 384-dim vector via `generateEmbedding()`
2. Each persona has an expertise centroid (average of all their channel's chunk embeddings)
3. `cosineSimilarity()` (from [`src/lib/graph/compute-relationships.ts`](../src/lib/graph/compute-relationships.ts)) computes the score between your question and each centroid
4. Top 3 personas by similarity are selected and queried in parallel
5. The `bestMatch` field tells you which persona is most relevant to your question

### Prerequisites

- Requires **2+ personas** for meaningful ensemble results
- With only 1 persona, it works but returns a single response
- With 0 personas, returns: "No personas available. Create personas first by ingesting 5+ transcripts from a creator."

> **Note:** The error message says "5+ transcripts" but the actual threshold for persona creation suggestion is 30+ videos. The MCP tool works with any existing persona regardless of how many videos the channel has.

---

## Authentication

### Local Development

MCP endpoints are **open** in development (no authentication required). Just start the dev server and connect.

### Production

In production, MCP endpoints are secured via Better Auth OAuth. The OIDC provider flow uses these environment variables:

| Variable | Purpose |
|----------|---------|
| `BETTER_AUTH_SECRET` | Session/token signing key |
| `BETTER_AUTH_URL` | Base URL for OAuth callbacks |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

Claude Code authenticates via the standard MCP OAuth flow — the first connection triggers a browser-based login.

See [DEPLOY.md](../DEPLOY.md) for full production setup including Google Cloud Console configuration.

---

## Common Patterns

### Search then ask a persona

A common workflow is to search first, identify relevant creators, then ask a specific persona for deeper insight:

```
1. search_rag("state management in large React apps")
   → Results show Theo and Jack Herrington have relevant content

2. chat_with_persona("Jack Herrington", "What state management approach do you recommend for a large Next.js app with complex forms?")
   → Jack's persona responds with specific recommendations grounded in his videos
```

### Explore a topic with the panel

For open-ended questions where multiple perspectives are valuable:

```
1. ensemble_query("What's the best testing strategy for a Next.js app?")
   → Get 3 different perspectives simultaneously

2. chat_with_persona("ThePrimeagen", "You mentioned unit tests are overrated — what do you test instead?")
   → Follow up with the most interesting perspective
```

---

## Further Reading

- **[Search Guide](search-guide.md)** — Tips for writing effective search queries
- **[Core Concepts](core-concepts.md)** — How hybrid search and personas work under the hood
- **[Getting Started](getting-started.md)** — Setup if you haven't installed Sluice yet
