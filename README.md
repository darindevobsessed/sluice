<div align="center">

# Sluice

Transform YouTube content into a searchable knowledge bank with AI-powered personas and Claude Code integration

<!-- TODO: Add hero banner image -->

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192?style=flat-square&logo=postgresql)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)

</div>

---

## What is Sluice?

Sluice transforms YouTube videos into a searchable, AI-augmented knowledge bank. Paste a YouTube URL, and it automatically fetches the transcript, generates vector embeddings, and makes the content discoverable through hybrid search. The result is a personal knowledge base where you can surface insights across hundreds of videos in seconds.

What makes Sluice unique is its combination of advanced RAG techniques with creator-focused AI features. Hybrid search fuses vector similarity (pgvector) with keyword matching using Reciprocal Rank Fusion. AI-generated personas capture each creator's expertise and communication style, letting you query channels as if chatting with the creator themselves. Ensemble queries ("Ask the Panel") stream parallel responses from multiple personas, grounded in their respective content via RAG. And the entire knowledge bank is exposed to Claude Code via Model Context Protocol (MCP), turning your video library into a queryable context source for AI workflows.

<!-- TODO: Add screenshot of dashboard (docs/assets/dashboard-screenshot.png) -->

---

## Features

### YouTube Ingestion
Paste any YouTube URL and Sluice automatically fetches the transcript using the YouTube Transcript API, pulling metadata via oEmbed. Alternatively, upload plain text transcripts for content without YouTube sources. All processing happens in a background job queue with automatic retry logic, so ingestion is reliable even for large batches.

### Hybrid RAG Search
Search combines vector similarity (pgvector cosine distance on 384-dimensional FastEmbed embeddings) with keyword matching (PostgreSQL case-insensitive ILIKE), then fuses results using Reciprocal Rank Fusion (k=60) to balance semantic and lexical relevance. Optional temporal decay boosts recent content in rankings. Results are aggregated by video, showing the top matching chunk per video for clean, scannable output.

### Graph RAG
Every chunk stores similarity edges to related chunks across the entire knowledge bank, enabling cross-video content discovery through graph traversal. When you find a relevant passage, Graph RAG surfaces conceptually similar content from other videos, even if they use different terminology. This turns isolated transcripts into a connected knowledge graph.

### AI Insights
Claude analyzes each video to extract structured insights: content type classification (dev/meeting/educational/thought-leadership), multi-level summary (tldr, overview, key points), timestamped key insights, action items, knowledge transfer prompts (questions to deepen understanding), and Claude Code plugin suggestions (skills, commands, agents, hooks, rules). Insights are stored as JSONB for fast querying and displayed alongside search results.

### Creator Personas
AI-generated personas capture each YouTube channel's expertise and communication style by analyzing their full transcript corpus. Personas are auto-suggested once a channel reaches 30 videos. Each persona has an expertise embedding (the centroid of all chunk embeddings for that channel) used for relevance routing. Query personas individually via chat interface or invoke multiple personas in ensemble mode.

### Ensemble Queries ("Ask the Panel")
Ask a question and get parallel streaming responses (Server-Sent Events) from the top 3 most relevant creator personas simultaneously. "Who's best?" routing uses cosine similarity between your query embedding and each persona's expertise centroid. Each persona's response is grounded in their own channel's content via RAG search, so answers cite specific videos. The result feels like consulting a panel of experts, each speaking from their domain.

### MCP Integration
Expose your entire knowledge bank to Claude Code via 4 MCP tools. Search the knowledge base, list all creators, chat with a specific persona, or run ensemble queries—all accessible from your terminal. MCP turns Sluice into a queryable context source for Claude workflows, letting you pull insights from your video library directly into coding sessions, research, or planning.

### Channel Discovery
Follow YouTube channels via RSS feeds with delta detection—Sluice automatically fetches new videos as they're published, no manual checking required. The Similar Creators feature uses average centroid similarity (cosine distance of 0.6 threshold) to recommend channels with related content. Discovery tiles show new channels and trending topics with horizontal scroll and CSS scroll-snap for quick scanning.

### Focus Areas
User-defined categories let you organize videos by topic (e.g., "TypeScript", "Design Systems", "DevOps"). Assign optional colors for visual differentiation. Filter the entire knowledge bank or search results by focus area. Focus areas persist in localStorage and sync across sessions, giving you a personalized taxonomy without backend complexity.

---

## Architecture

```mermaid
graph TD
    A[YouTube URL] --> B[Transcript Fetch]
    B --> C[Chunk & Embed]
    C --> D[(pgvector Storage)]
    D --> E[Hybrid Search]
    D --> F[Graph RAG]
    D --> G[AI Personas]
    E --> H[Knowledge Bank UI]
    F --> H
    G --> I[Ensemble Queries]
    D --> J[MCP Tools]
    J --> K[Claude Code]
```

The pipeline flows from YouTube URL ingestion through transcript fetching, then splits into ~300-word chunks with ~50-word overlap. FastEmbed generates 384-dimensional vectors stored in PostgreSQL with the pgvector extension. From there, content is accessible via four paths: hybrid search (vector + keyword fusion), graph RAG (similarity edges for related content), AI personas (channel-specific expertise models), and MCP tools (exposing the knowledge bank to Claude Code). The UI aggregates all access methods into a unified search and discovery experience.

---

## MCP Tools

Sluice's MCP integration is what makes it a true knowledge infrastructure tool for Claude Code workflows. Once connected, Claude can query your video library, consult creator personas, and pull context from your knowledge bank—all without leaving the terminal.

| Tool | Description |
|------|-------------|
| `search_rag` | Hybrid search with vector + keyword + RRF fusion, optional creator filtering |
| `get_list_of_creators` | List all YouTube channels in knowledge bank with video counts |
| `chat_with_persona` | Query a specific creator persona with RAG-grounded responses |
| `ensemble_query` | Ask multiple personas simultaneously, get top 3 parallel responses |

### Connecting to Claude Code

Add Sluice to your `mcp.json` configuration:

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

Once connected, Claude Code can search your knowledge bank, query creator personas, and get context from your video library. For example: "Search my knowledge bank for videos about React Server Components" or "Ask the panel: what are best practices for database indexing?"

---

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/gold-miner.git
cd gold-miner
```

### 2. Start PostgreSQL with pgvector
```bash
docker compose up -d
```
This starts PostgreSQL 16 with the pgvector extension enabled. The default configuration matches `.env.example` values, so no manual database setup is needed.

### 3. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and configure three key variables:
- `DATABASE_URL` — PostgreSQL connection string (default `postgresql://goldminer:goldminer@localhost:5432/goldminer` matches Docker)
- `NEXT_PUBLIC_AGENT_PORT` — Agent WebSocket port (default `9334`, must match `AGENT_PORT`)
- `AI_GATEWAY_KEY` — AI gateway key for insights and personas (required for AI features, get at https://console.anthropic.com/)

### 4. Install dependencies
```bash
npm install
```

### 5. Initialize the database
```bash
npm run db:push
```
This applies the Drizzle ORM schema to your PostgreSQL instance, creating all 11 tables with proper indexes and foreign keys.

### 6. Start the development servers
```bash
npm run dev
```
Starts two servers in parallel:
- Next.js dev server on `http://localhost:3001`
- Agent WebSocket server on port `9334`

Open `http://localhost:3001` and start adding YouTube videos to build your knowledge bank.

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `videos` | Video metadata, transcripts, duration, published_at |
| `chunks` | Transcript chunks with 384-dim vector embeddings |
| `insights` | AI extraction results (JSONB) with summaries, key insights, action items |
| `relationships` | Graph RAG chunk-to-chunk similarity edges |
| `temporal_metadata` | Version mentions and release dates for temporal decay |
| `channels` | Followed YouTube channels with RSS feeds |
| `personas` | AI-generated personas with expertise embeddings |
| `focus_areas` | User-defined categories |
| `video_focus_areas` | Many-to-many junction table |
| `jobs` | Database-backed job queue with retry logic |
| `settings` | Key-value app configuration |

All tables use auto-incrementing serial primary keys with cascade deletes on foreign keys. Indexes on commonly queried fields (e.g., `chunks.video_id`, `videos.channel`).

---

## Tech Stack

- [Next.js 16](https://nextjs.org/) — App Router with React Server Components
- [React 19](https://react.dev/) — UI framework
- [TypeScript](https://www.typescriptlang.org/) — Type safety with strict mode
- [PostgreSQL 16](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector) — Vector database
- [Drizzle ORM](https://orm.drizzle.team/) — Type-safe database queries
- [Tailwind CSS v4](https://tailwindcss.com/) — Utility-first styling
- [shadcn/ui](https://ui.shadcn.com/) — Component library
- [FastEmbed](https://github.com/qdrant/fastembed) — Local embeddings (all-MiniLM-L6-v2)
- [Claude API](https://www.anthropic.com/claude) — AI insights and personas
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Model Context Protocol integration
- [Vitest](https://vitest.dev/) — Testing framework

---

## Documentation

- [CLAUDE.md](CLAUDE.md) — Comprehensive developer reference (architecture, API routes, code conventions)
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines and setup instructions
- [.env.example](.env.example) — Environment variable template

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style guidelines, and PR process.

---

## License

[MIT](LICENSE) © 2026 DevObsessed

---

**Built with [Claude Code](https://claude.ai/claude-code) and inspired by the power of connecting knowledge across conversations.**
