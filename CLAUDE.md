# Gold Miner

A knowledge extraction platform that transforms YouTube content into a searchable knowledge bank with hybrid RAG search, AI-generated insights, creator personas, and Model Context Protocol (MCP) integration for Claude Code workflows.

## Tech Stack

### Framework & Runtime
- **Next.js 16** (App Router) with **React 19**
- **TypeScript** (strict mode enabled)
- **Node.js** runtime

### Database & ORM
- **PostgreSQL 16** with **pgvector** extension for vector search
- **Drizzle ORM** for schema management and queries
- **Docker Compose** for local PostgreSQL + pgvector setup

### AI & Embeddings
- **FastEmbed** (local embeddings) using all-MiniLM-L6-v2 model (384 dimensions)
- **Anthropic Claude API** (Sonnet 4) for insights generation and persona queries
- **@anthropic-ai/claude-agent-sdk** for WebSocket agent server

### Styling & UI
- **Tailwind CSS v4** with CSS-first configuration
- **shadcn/ui** components (New York style)
- **class-variance-authority** (CVA) for component variants
- **tailwind-merge** (`cn()` utility) for conditional classes
- **next-themes** for dark mode support
- **Lucide React** icons

### YouTube Integration
- **@danielxceron/youtube-transcript** for transcript fetching
- YouTube oEmbed API for video metadata
- RSS feeds via **fast-xml-parser** for channel monitoring

### MCP & Tools
- **@modelcontextprotocol/sdk** for MCP protocol implementation
- **mcp-handler** for tool registration and execution
- Custom tools: `search_rag`, `get_list_of_creators`, `chat_with_persona`, `ensemble_query`

### Testing
- **Vitest** test runner
- **React Testing Library** for component testing
- **better-sqlite3** for in-memory database tests
- **jsdom** for DOM simulation

### Other Libraries
- **Zod 4** for validation and type safety at API boundaries
- **ws** for WebSocket server (agent communication)
- **nanoid** for unique ID generation
- **concurrently** for running dev servers in parallel

## Project Structure

```
gold-miner/
├── src/
│   ├── app/                      # Next.js App Router pages and API routes
│   │   ├── page.tsx              # Knowledge Bank (main page)
│   │   ├── add/                  # Add YouTube video page
│   │   ├── add-transcript/       # Upload raw transcript page
│   │   ├── discovery/            # Discovery page (tiles, similar creators)
│   │   ├── videos/[id]/          # Video detail page
│   │   ├── settings/             # User settings page
│   │   └── api/                  # API routes (27 endpoints)
│   │       ├── videos/           # Video CRUD, insights, embeddings
│   │       ├── search/           # Hybrid RAG search (vector + keyword)
│   │       ├── channels/         # Channel metadata, similar creators
│   │       ├── personas/         # Persona CRUD, ensemble queries
│   │       ├── focus-areas/      # Focus area CRUD
│   │       ├── mcp/              # MCP tool handlers
│   │       ├── cron/             # Automation endpoints (RSS, jobs)
│   │       ├── graph/            # Graph RAG queries
│   │       ├── youtube/          # YouTube metadata, RSS feeds
│   │       └── agent/            # Agent job submission
│   ├── components/               # React components (organized by feature)
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── layout/               # TopBar, navigation
│   │   ├── providers/            # Theme, query providers
│   │   ├── search/               # SearchBar, SearchResults
│   │   ├── video/                # VideoPlayer, TranscriptView
│   │   ├── videos/               # VideoCard, VideoGrid, VideoSearch
│   │   ├── insights/             # InsightView, InsightCard
│   │   ├── personas/             # PersonaChat, PersonaList
│   │   ├── discovery/            # DiscoveryTiles, SimilarCreators
│   │   ├── knowledge-bank/       # KnowledgeBankPage, filters
│   │   ├── filters/              # FocusAreaFilter
│   │   ├── add-video/            # AddVideoForm
│   │   ├── add-transcript/       # AddTranscriptForm
│   │   ├── settings/             # SettingsForm
│   │   └── icons/                # Custom icon components
│   ├── lib/                      # Core application logic
│   │   ├── db/                   # Database schema, migrations
│   │   ├── search/               # Hybrid search (vector + keyword + RRF)
│   │   ├── embeddings/           # FastEmbed wrapper, chunk generation
│   │   ├── graph/                # Graph RAG (relationships, traversal)
│   │   ├── personas/             # Persona generation, ensemble logic
│   │   ├── claude/               # Claude API client, prompts
│   │   ├── youtube/              # YouTube metadata, RSS, transcript
│   │   ├── automation/           # Job queue, cron tasks
│   │   ├── channels/             # Channel management, similarity
│   │   ├── mcp/                  # MCP tool registration
│   │   ├── temporal/             # Temporal decay for search ranking
│   │   ├── transcript/           # Transcript parsing utilities
│   │   └── utils.ts              # Shared utilities (cn, formatters)
│   ├── agent/                    # WebSocket agent server
│   │   ├── index.ts              # Agent server entry point
│   │   └── __tests__/            # Agent tests
│   └── hooks/                    # Custom React hooks
│       └── __tests__/            # Hook tests
├── .craft/                       # Craft story development files
├── docker-compose.yml            # PostgreSQL + pgvector container
├── scripts/
│   └── init-db.sql               # Database initialization script
├── drizzle.config.ts             # Drizzle ORM configuration
├── next.config.ts                # Next.js configuration
├── vitest.config.ts              # Vitest test configuration
├── .env.example                  # Environment variable template
└── CLAUDE.md                     # This file - project documentation
```

## Commands

All commands use **npm** as the package manager:

- `npm run dev` - Start development servers (Next.js on port 3001 + Agent WebSocket on port 9334)
- `npm run next:dev` - Start Next.js dev server only
- `npm run agent` - Start Agent WebSocket server only
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run all tests once (Vitest)
- `npm run test:watch` - Run tests in watch mode
- `npm run db:push` - Push Drizzle schema changes to database
- `npm run db:studio` - Open Drizzle Studio GUI for database inspection
- `npm run dev:cleanup` - Kill stale dev processes and remove .next/dev/lock

## Dev Server Rules

**IMPORTANT**: When the Next.js dev server fails to start:

1. **DO NOT** try multiple ports in succession leaving hanging processes
2. **FIRST** check if `.next/dev/lock` exists - if so, remove it: `rm -f .next/dev/lock`
3. **THEN** start the server on a single chosen port
4. **NEVER** kill a running dev server without explicit user permission
5. If startup fails, diagnose the root cause before retrying

**Port Configuration:**
- Next.js dev server: **3001** (configurable via `PORT` env var)
- Agent WebSocket server: **9334** (configurable via `AGENT_PORT` env var)
- **DO NOT** kill processes on ports **3000** or **9333** (reserved for other projects)

## Code Style

### Formatting Conventions
- **No semicolons** - Consistent with modern JS/TS style
- **Single quotes** for strings
- **Trailing commas** in objects and arrays
- **Named exports only** - No default exports

### Import Patterns
- Use `@/*` path alias for all imports (e.g., `import { db } from '@/lib/db'`)
- Group imports: external packages, then internal modules
- Sort imports alphabetically within groups

### Component Architecture
- Colocate tests in `__tests__/` directories next to source files
- Use **shadcn/ui** as base for UI components
- Use **CVA** (class-variance-authority) for component variants
- Use `cn()` utility (tailwind-merge) for conditional class merging
- Server components by default, `'use client'` only when needed

### API Conventions
- Use **Zod** `safeParse()` at API boundaries for validation
- Return first error message in 400 response on validation failure
- Consistent response shape: `{ data?, error?, meta? }`
- Proper HTTP status codes (200, 201, 400, 401, 404, 500)

### Type Safety
- TypeScript strict mode enabled
- Infer types from Drizzle schema (`typeof table.$inferSelect`)
- No `any` types without explicit justification

## Environment Variables

Required environment variables (see `.env.example` for template):

**App validates these at startup** — missing `DATABASE_URL` throws, missing `ANTHROPIC_API_KEY` or `CRON_SECRET` warns.

### Required
- `DATABASE_URL` - PostgreSQL connection string (default: `postgresql://goldminer:goldminer@localhost:5432/goldminer`). DB pool auto-sizes: 3 connections for Neon (serverless), 10 for local PostgreSQL.
- `NEXT_PUBLIC_AGENT_PORT` - Agent WebSocket port (default: `9334`, must match `AGENT_PORT`)
- `ANTHROPIC_API_KEY` - Claude API key for insights and personas (get at https://console.anthropic.com/)
- `AGENT_AUTH_TOKEN` - Token for SSE agent transport in production (local dev uses .agent-token file)
- `CRON_SECRET` - Secret for authenticating `/api/cron/*` endpoints

### Optional
- `PORT` - Next.js dev server port (default: `3001`)
- `AGENT_PORT` - Agent WebSocket server port (default: `9334`)

## Database Schema

Gold Miner uses **11 tables** in PostgreSQL with pgvector extension:

### Core Tables
- **videos** - YouTube video metadata and transcripts (source_type, youtube_id, title, channel, thumbnail, duration, description, transcript, published_at)
- **chunks** - RAG embeddings for transcript chunks (~300 words, ~50 word overlap, 384-dim vectors)
- **insights** - AI-generated extraction results (content_type, extraction JSONB: summary, key_insights, action_items, knowledge_prompts, plugin_suggestions)

### Knowledge Graph
- **relationships** - Chunk-to-chunk similarity edges for Graph RAG (source_chunk_id, target_chunk_id, similarity score)
- **temporal_metadata** - Version mentions and release dates extracted from chunks (for temporal decay ranking)

### Organization
- **channels** - YouTube channel metadata (channel_id, name, thumbnail, RSS feed_url, auto_fetch settings)
- **focus_areas** - User-defined categories for organizing videos (name, color)
- **video_focus_areas** - Many-to-many junction table (video_id, focus_area_id)

### AI Features
- **personas** - AI-generated creator personas (channel_name, name, system_prompt, expertise_topics, expertise_embedding centroid, transcript_count)

### Automation
- **jobs** - Database-backed job queue (type, payload JSONB, status, attempts, error)
- **settings** - Key-value store for user preferences

All tables use auto-incrementing `serial` primary keys except `insights` (text ID) and junction tables (composite keys). Foreign keys have `onDelete: 'cascade'` for cleanup. Indexes on commonly queried fields.

## Core Architecture

### Hybrid RAG Search
Gold Miner uses a **hybrid search** approach combining vector similarity and keyword search:
- **Vector search**: cosine similarity on 384-dim embeddings (pgvector)
- **Keyword search**: PostgreSQL case-insensitive `ILIKE` matching
- **Reciprocal Rank Fusion (RRF)**: combines both result sets (k=60)
- **Temporal decay**: optional ranking boost for recent content
- **Aggregation**: results grouped by video, top chunk per video shown
- **Graph RAG**: traverses similarity edges for related content discovery

### Embeddings Pipeline
- **Model**: FastEmbed local (all-MiniLM-L6-v2, 384 dimensions)
- **Chunking**: ~300-word chunks with ~50-word overlap
- **Auto-generation**: triggered by `after()` hook on video insert or via job queue
- **Storage**: vectors stored in `chunks` table with pgvector extension

### AI Insights
AI-powered content extraction generates structured insights for each video:
- **Content type classification**: dev/meeting/educational/thought-leadership/general
- **Extraction fields**: summary, key_insights, action_items, knowledge_prompts, plugin_suggestions
- **Storage**: JSONB in `insights` table (one per video)
- **Generation**: on-demand via `/api/videos/[id]/insights` or async job queue

### Personas & Ensemble Queries
**Auto-suggest personas** at 30+ videos per creator:
- **Persona generation**: Claude API analyzes channel content to create system prompt
- **Expertise embedding**: centroid of all chunk embeddings for the channel
- **Routing**: "Who's best?" cosine similarity between query embedding and persona expertise centroids
- **Ensemble**: "Ask the Panel" streams responses from top 3 personas via SSE
- **UI**: Appears above search results when personas exist

### MCP Tools (Model Context Protocol)
Gold Miner exposes 4 MCP tools for Claude Code workflows:
1. `search_rag` - Hybrid search with vector + keyword + RRF
2. `get_list_of_creators` - List all YouTube channels in knowledge bank
3. `chat_with_persona` - Query a specific creator persona
4. `ensemble_query` - Ask multiple personas simultaneously

Tools registered in `src/lib/mcp/tools.ts` with Zod schema validation. Authentication via Better Auth OAuth in production. Open in development.

### Automation & Job Queue
**Database-backed job queue** for reliable async processing:
- **Job types**: `fetch_transcript`, `generate_embeddings`, `generate_insights`
- **Retry logic**: max 3 attempts with exponential backoff
- **Status tracking**: pending → processing → completed/failed
- **Cron endpoints**: `/api/cron/fetch-new-videos` (RSS delta detection), `/api/cron/process-jobs`
- **Auth**: secured with `CRON_SECRET` env var

### Dual Transport Agent
Gold Miner supports two transport mechanisms for AI agent operations:
- **WebSocket (local dev)**: Standalone agent server via `npm run agent` on port 9334
- **SSE (production)**: Server-Sent Events via `/api/agent/stream` for serverless deployment (Vercel)
- **Auto-detection**: Token endpoint `/api/agent/token` returns `transport: 'websocket'` (local) or `transport: 'sse'` (production)
- **Unified interface**: `AgentConnection` class abstracts both transports with same public API
- **Zero consumer changes**: Components (`ExtractionProvider`, `InsightsTabs`, `InsightsPanel`) work identically across environments

### SSE Streaming
Server-Sent Events (SSE) for real-time AI responses:
- Used for ensemble queries and persona chat
- Always returns `all_done` event at end of stream (even for empty results)
- Client handles gracefully (no 404 for empty states)

## Testing

- **Test runner**: Vitest with React Testing Library
- **DB tests**: better-sqlite3 in-memory database for isolated tests
- **Test location**: colocated in `__tests__/` directories next to source files
- **Coverage**: aim for 80%+ coverage on logic layer (lib/, hooks/)
- **Component tests**: focus on behavior, not rendering existence

**Run tests**: `npm test` (once) or `npm run test:watch` (watch mode)

## Key Design Decisions

### Product Philosophy
**"Keep it the base"** (Brad's principle): Gold Miner is a knowledge tool, not a chatbot. Personas augment search, don't replace it.

### UI Design
- **Global top bar**: 56px height (`h-14 bg-card border-b`), page title left, focus area dropdown right
- **Focus areas**: user-defined categories, localStorage persistence, "All" = null (not DB entry)
- **Discovery**: Dashboard Tiles pattern, horizontal scroll with CSS scroll-snap, green dot for "new"
- **Design vibe**: "Prospector's Clarity" - practical, no-nonsense, information-dense

### Technical Choices
- **Similar creators**: average centroid approach (all chunk embeddings averaged), 0.6 similarity threshold
- **Persona routing**: simple cosine similarity of query embedding vs persona expertise centroid
- **RRF k-value**: 60 (balances vector and keyword importance)
- **Chunk size**: ~300 words (balances context window and granularity)
- **Auto-fetch interval**: 12 hours default for RSS feeds

## Notes

- **YouTube ToS**: Respect YouTube's Terms of Service and copyright considerations
- **Rate limiting**: Consider rate limits for YouTube API and Claude API calls
- **Caching**: Transcripts are cached in database to avoid re-processing
- **Docker**: Use `docker-compose up -d` to start PostgreSQL + pgvector locally
- **Migrations**: Use `npm run db:push` to apply Drizzle schema changes
- **Database GUI**: Use `npm run db:studio` to inspect database with Drizzle Studio

## Deployment

Gold Miner deploys to **Vercel** with a **Neon PostgreSQL** database. See [`DEPLOY.md`](./DEPLOY.md) for the full step-by-step deployment checklist.

**Key production details:**
- Vercel Pro plan required (60s function timeout for 9 heavy API routes)
- Neon PostgreSQL with pgvector extension for vector embeddings
- SSE agent transport (auto-detected via `AGENT_AUTH_TOKEN` env var)
- Vercel Cron Jobs: check-feeds (12h), process-jobs (5min)
- Embedding model downloads to `/tmp/.cache` on cold start (~23MB, 10-15s)
