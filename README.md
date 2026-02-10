<div align="center">
  <h1>Gold Miner</h1>
  <p>A knowledge extraction platform that transforms YouTube content into a searchable knowledge bank with AI-powered personas and ensemble queries.</p>

  <p>
    <img src="https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/PostgreSQL+pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black" alt="Drizzle" />
    <img src="https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  </p>
</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Setup](#environment-setup)
- [Database](#database)
- [Development](#development)
- [API Reference](#api-reference)
- [Search and Embeddings](#search-and-embeddings)
- [MCP Integration](#mcp-integration)
- [Personas and Ensemble AI](#personas-and-ensemble-ai)
- [Testing](#testing)
- [License](#license)

## Overview

Gold Miner ingests YouTube videos (and plain text transcripts), extracts transcripts, chunks them with vector embeddings, and builds a searchable knowledge bank using hybrid vector + keyword search with Reciprocal Rank Fusion. It auto-generates AI personas from creator content and supports "Ask the Panel" ensemble queries that stream responses from multiple expert perspectives simultaneously. The knowledge bank is also exposed as MCP tools for use inside Claude Code.

## Features

- **YouTube Ingestion** -- Add videos by URL with automatic transcript extraction, or paste plain text transcripts from meetings, podcasts, and documents
- **Hybrid Search** -- Vector similarity + keyword search combined via Reciprocal Rank Fusion (RRF), with optional temporal decay for recency boosting
- **Graph RAG** -- Chunk-to-chunk relationship edges enable knowledge graph traversal and related content discovery
- **AI Insights** -- Claude-powered extraction of summaries, key insights, action items, and Claude Code plugin suggestions from transcripts
- **AI Personas** -- Auto-generated expert personas from YouTube creators (30+ video threshold), each with a system prompt derived from their content
- **Ensemble Queries** -- "Ask the Panel" streams answers from the top 3 most relevant personas in parallel via SSE, with semantic "who's best" routing
- **Channel Discovery** -- Follow YouTube channels via RSS, discover similar creators through content centroid similarity, and auto-fetch new videos
- **Focus Areas** -- User-defined categories for organizing and filtering the knowledge bank
- **MCP Tools** -- Model Context Protocol integration exposing search, creator listing, persona chat, and ensemble queries to Claude Code

## Architecture

```mermaid
graph TB
    subgraph Client["Client (React 19)"]
        KB[Knowledge Bank]
        DIS[Discovery]
        VD[Video Detail]
        ADD[Add Video / Transcript]
    end

    subgraph API["API Routes (Next.js App Router)"]
        VID["/api/videos"]
        SEARCH["/api/search"]
        CHAN["/api/channels"]
        PERS["/api/personas"]
        ENS["/api/personas/ensemble"]
        MCP["/api/mcp/transport"]
        CRON["/api/cron/*"]
    end

    subgraph Services
        EMB["FastEmbed<br/>all-MiniLM-L6-v2<br/>(384 dim, local)"]
        CLAUDE["Claude API<br/>(insights, personas)"]
        YT["YouTube<br/>(oEmbed, transcripts, RSS)"]
        AGENT["Background Agent<br/>(job processing)"]
    end

    subgraph Storage
        PG[("PostgreSQL + pgvector")]
    end

    Client --> API
    SEARCH --> EMB
    SEARCH --> PG
    VID --> PG
    CHAN --> YT
    PERS --> CLAUDE
    ENS -->|"SSE stream"| Client
    MCP -->|"MCP protocol"| EXT["Claude Code"]
    CRON --> AGENT
    AGENT --> PG
    EMB --> PG
```

## Quick Start

**Prerequisites:** Node.js 20+, PostgreSQL 16+ with the [pgvector](https://github.com/pgvector/pgvector) extension, or Docker

```bash
# Clone and install
git clone <repo-url>
cd gold-miner
npm install

# Option A: Use Docker for the database
docker compose up -d

# Option B: Use an existing PostgreSQL instance
cp .env.example .env
# Edit .env with your DATABASE_URL

# Enable pgvector and push schema
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
npm run db:push

# Start dev server + background agent
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000). The background agent (for job processing) starts concurrently.

## Environment Setup

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/goldminer` |
| `ANTHROPIC_API_KEY` | For AI features | Claude API key -- required for insights extraction, persona generation, and ensemble queries |
| `CRON_SECRET` | For automation | Bearer token for authenticating cron endpoints (`/api/cron/*`) |

The pgvector extension must be enabled on your PostgreSQL instance. Run `CREATE EXTENSION IF NOT EXISTS vector;` before pushing the schema.

Embeddings are generated locally using [FastEmbed](https://huggingface.co/Xenova/all-MiniLM-L6-v2) (all-MiniLM-L6-v2, 384 dimensions) -- no external embedding API is needed.

## Database

Gold Miner uses [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL + pgvector. The schema is defined in [`src/lib/db/schema.ts`](src/lib/db/schema.ts).

### Commands

```bash
npm run db:push          # Push schema changes to database
npm run db:studio        # Open Drizzle Studio (visual DB browser)
npm run db:migrate-data  # Run data migrations
```

### Schema Overview

| Table | Purpose |
|-------|---------|
| `videos` | Video metadata, transcripts, source type (youtube / transcript) |
| `chunks` | Transcript chunks with 384-dim vector embeddings |
| `relationships` | Chunk-to-chunk similarity edges for Graph RAG |
| `temporal_metadata` | Version mentions and release dates extracted from chunks |
| `insights` | AI-generated extraction results (1:1 with videos) |
| `channels` | Followed YouTube channels with RSS feed URLs |
| `personas` | AI personas with system prompts and expertise embeddings |
| `focus_areas` | User-defined categories for organizing videos |
| `video_focus_areas` | Many-to-many junction (videos to focus areas) |
| `jobs` | Database-backed job queue for async processing |
| `settings` | Key-value store for app configuration |

### Key Relationships

- `videos` 1:N `chunks` (cascade delete)
- `videos` 1:1 `insights` (cascade delete)
- `chunks` N:N `chunks` via `relationships` (Graph RAG edges)
- `videos` N:N `focus_areas` via `video_focus_areas`
- `personas` have an `expertise_embedding` (vector centroid for semantic routing)

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js + background agent concurrently |
| `npm run next:dev` | Start Next.js only |
| `npm run agent` | Start background agent only |
| `npm run build` | Production build |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Drizzle schema to database |
| `npm run db:studio` | Open Drizzle Studio |

### Project Structure

```
gold-miner/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Knowledge Bank (home)
│   │   ├── add/                # Add YouTube video
│   │   ├── add-transcript/     # Add plain text transcript
│   │   ├── discovery/          # Channel discovery
│   │   ├── videos/[id]/        # Video detail page
│   │   ├── settings/           # Settings page
│   │   └── api/                # API routes (27 endpoints)
│   │       ├── videos/         # CRUD, embed, insights, related
│   │       ├── search/         # Hybrid search
│   │       ├── channels/       # Follow, similar, automation
│   │       ├── personas/       # CRUD, query, ensemble, suggest
│   │       ├── focus-areas/    # CRUD
│   │       ├── mcp/            # MCP protocol handler
│   │       ├── youtube/        # Transcript fetching
│   │       └── cron/           # Feed checking, job processing
│   ├── agent/                  # Background agent (WebSocket server)
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── layout/             # Sidebar, TopBar, MainContent
│   │   ├── videos/             # VideoCard, VideoGrid, VideoPlayer
│   │   ├── search/             # SearchResults, ChunkResult
│   │   ├── discovery/          # Channel tiles, similar creators
│   │   ├── personas/           # PersonaPanel, ensemble UI
│   │   ├── insights/           # InsightsPanel, extraction display
│   │   └── providers/          # FocusArea, Theme, Agent contexts
│   └── lib/                    # Core business logic
│       ├── db/                 # Drizzle schema, connection, queries
│       ├── search/             # Hybrid search, RRF, aggregation
│       ├── embeddings/         # FastEmbed pipeline, chunker
│       ├── graph/              # Graph RAG traversal
│       ├── personas/           # Persona service, ensemble, context
│       ├── claude/             # Prompts, extraction
│       ├── mcp/                # MCP tool definitions
│       ├── automation/         # RSS, delta detection, job queue
│       ├── channels/           # Similarity computation
│       └── youtube/            # oEmbed, transcript fetching
├── CLAUDE.md                   # AI assistant project guidance
├── drizzle.config.ts           # Drizzle ORM configuration
└── package.json
```

### Code Style

- TypeScript strict mode, no semicolons, single quotes, trailing commas
- Named exports only (no default exports)
- `@/*` path alias for all imports
- Zod validation at API boundaries (`safeParse()`, first error in 400 response)
- shadcn/ui components with CVA variants and `cn()` for class merging

## API Reference

### Videos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos` | List videos with optional `focusAreaId` filter |
| POST | `/api/videos` | Create video (YouTube or transcript source) |
| GET | `/api/videos/[id]` | Get single video by ID |
| POST | `/api/videos/[id]/embed` | Trigger embedding generation |
| GET | `/api/videos/[id]/embed/status` | Check embedding progress |
| GET/POST | `/api/videos/[id]/insights` | Get or save AI extraction results |
| GET | `/api/videos/[id]/related` | Find related chunks via Graph RAG |
| POST/DELETE | `/api/videos/[id]/focus-areas` | Assign or unassign a focus area |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=...` | Hybrid search. Params: `mode` (vector/keyword/hybrid), `limit`, `temporalDecay`, `halfLifeDays`, `focusAreaId` |

### Channels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/channels` | List or follow a channel |
| GET/PATCH/DELETE | `/api/channels/[id]` | Get, update, or unfollow |
| GET | `/api/channels/[id]/videos` | Fetch channel videos via RSS |
| PATCH | `/api/channels/[id]/automation` | Toggle auto-fetch |
| GET | `/api/channels/videos` | All discovery videos across channels |
| GET | `/api/channels/similar` | Find similar creators by content similarity |
| POST | `/api/channels/similar/follow` | Follow a recommended channel |

### Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/personas` | List or create a persona |
| GET/DELETE | `/api/personas/[id]` | Get or delete a persona |
| POST | `/api/personas/[id]/query` | Query single persona (SSE stream) |
| POST | `/api/personas/ensemble` | Ensemble query -- top 3 personas (SSE stream) |
| GET | `/api/personas/suggest` | Check if persona creation is suggested |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/mcp/[transport]` | MCP protocol handler (SSE or HTTP) |
| GET/POST | `/api/focus-areas` | List or create focus areas |
| PATCH/DELETE | `/api/focus-areas/[id]` | Update or delete a focus area |
| POST | `/api/youtube/transcript` | Fetch YouTube transcript by video ID |
| GET | `/api/cron/check-feeds` | Check RSS feeds for new videos (auth required) |
| GET | `/api/cron/process-jobs` | Process pending job queue (auth required) |
| GET | `/api/agent/token` | Get MCP authentication token |

## Search and Embeddings

Gold Miner implements a three-mode search system:

**Vector search** generates a query embedding via FastEmbed (all-MiniLM-L6-v2, 384 dimensions, runs locally in Node.js) and finds similar chunks using cosine similarity in pgvector.

**Keyword search** performs case-insensitive matching against chunk content in PostgreSQL.

**Hybrid search** (default) runs both in parallel and combines results using Reciprocal Rank Fusion:

```
RRF score = sum( 1 / (k + rank) )   where k = 60
```

Results are aggregated by video -- chunks are grouped under their parent video with the maximum similarity score bubbled up.

**Temporal decay** can be enabled to boost recent content:

```
adjusted_score = similarity * exp(-ln(2) * age_days / half_life_days)
```

**Graph RAG** computes chunk-to-chunk relationship edges during embedding generation. The `/api/videos/[id]/related` endpoint traverses these edges to find topically related content across videos.

### Embedding Pipeline

1. Transcript is split into ~300-word chunks with ~50-word overlap
2. Embeddings are generated locally via FastEmbed (no external API calls)
3. Chunks and embeddings are stored in PostgreSQL with pgvector
4. Cross-chunk similarity edges are computed for Graph RAG
5. Temporal metadata (version mentions, release dates) is extracted

## MCP Integration

Gold Miner exposes its knowledge bank as [Model Context Protocol](https://modelcontextprotocol.io/) tools, allowing Claude Code to search and query the knowledge base directly.

**Endpoint:** `/api/mcp/[transport]` (supports SSE and HTTP transports)

**Authentication:** Bearer token auto-generated by the background agent and stored in `.agent-token`.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_rag` | Search the knowledge base | `topic` (required), `creator` (optional), `limit` (optional) |
| `get_list_of_creators` | List all creators with video counts | none |
| `chat_with_persona` | Query a single persona by name | `personaName`, `question` |
| `ensemble_query` | Query all personas (returns top 3) | `question` |

Tools are defined in [`src/lib/mcp/tools.ts`](src/lib/mcp/tools.ts) with Zod schema validation.

### Claude Desktop Setup

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gold-miner": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp/mcp"]
    }
  }
}
```

## Personas and Ensemble AI

### Persona Creation

When a channel has 30+ videos with embeddings, the system suggests creating an AI persona. The creation process:

1. Samples transcripts from the channel
2. Uses Claude to analyze the creator's expertise, style, and tone
3. Generates a system prompt that embodies the creator's perspective
4. Computes an expertise embedding (centroid of all channel chunk embeddings)
5. Extracts expertise topics for display

### Ensemble Queries ("Ask the Panel")

When a user types a question in the search bar, the ensemble system:

1. Generates a query embedding from the question
2. Computes cosine similarity against each persona's expertise centroid
3. Selects the top 3 most relevant personas
4. Queries all 3 in parallel with channel-scoped context (vector search limited to each creator's content)
5. Streams responses via SSE with tagged events (`persona_X_content`, `persona_X_done`, `all_done`)

The UI renders responses in a three-column layout as they stream in.

## Testing

Tests use [Vitest](https://vitest.dev/) with React Testing Library. Database tests use better-sqlite3 in-memory to avoid requiring a running PostgreSQL server.

```bash
npm test           # Run all tests
npm run test:watch # Watch mode
```

Test files are colocated with source code in `__tests__/` directories.

### Coverage

- UI components (render, interaction, accessibility)
- Search algorithms (RRF fusion, aggregation)
- Transcript chunking and parsing
- API route validation (Zod schemas)
- MCP tool definitions
- Persona service logic

## License

Private -- not yet licensed for distribution.
