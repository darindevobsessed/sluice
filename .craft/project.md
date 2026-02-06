# Gold Miner - Project DNA

---
name: gold-miner
type: hybrid (ui + agent server)
package_manager: npm
last_updated: 2026-02-06
---

## Vision
A knowledge extraction platform that transforms YouTube content into a searchable knowledge bank, with AI-powered suggestions for Claude Code plugins.

## Tech Stack

### Framework
- **Next.js 16** (App Router)
- **React 19**
- TypeScript (strict mode with `noUncheckedIndexedAccess`, `noImplicitReturns`)
- Server Components for data-heavy views
- API Routes for backend processing

### Styling
- **Tailwind CSS v4** for utility-first styling
- **shadcn/ui** for accessible, customizable components
- **class-variance-authority (CVA)** for component variants
- Design tokens mapped to CSS variables
- `cn()` utility (clsx + tailwind-merge)

### Data
- **PostgreSQL** with pgvector extension (via Docker)
- **Drizzle ORM** for type-safe database access
- Push-based migrations (`drizzle-kit push`)

### AI/Processing
- **Transcript extraction:** `youtube-transcript` library
- **Embeddings:** FastEmbed (local, `all-MiniLM-L6-v2`, 384 dimensions)
- **LLM:** Claude API for plugin generation
- **Agent Server:** `@anthropic-ai/claude-agent-sdk` (WebSocket)

### Search
- **Hybrid search:** Vector similarity + keyword matching
- **Reciprocal Rank Fusion (RRF)** for combining results
- Three modes: vector, keyword, hybrid

### Validation
- **Zod v4** for schema validation at API boundaries

### State Management
- Custom React hooks with debouncing
- AbortController for request cancellation
- No external state library (React state sufficient)

### Testing
- **Vitest** for unit and integration tests
- **React Testing Library** for component tests
- **better-sqlite3** for fast database tests
- Tests colocated in `__tests__/` directories
- 46 test files (~34% coverage)

## Code Patterns

### File Organization
```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (videos, search, youtube, agent)
│   ├── add/                # Add video page
│   ├── discovery/          # Channel discovery
│   ├── settings/           # Settings page
│   ├── videos/[id]/        # Video detail (dynamic route)
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home (Knowledge Bank)
├── agent/                  # Claude Agent server (WebSocket)
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Sidebar, MainContent
│   ├── videos/             # Video-related components
│   ├── insights/           # AI extraction UI
│   ├── search/             # Search results display
│   ├── add-video/          # Add video flow
│   ├── video/              # Single video actions
│   ├── settings/           # Settings UI
│   └── providers/          # ThemeProvider
├── hooks/                  # Custom React hooks (useSearch, useEmbedding, useExtraction)
└── lib/
    ├── agent/              # Agent connection logic
    ├── claude/prompts/     # LLM prompt engineering
    ├── db/                 # Database schema, queries, migrations
    ├── embeddings/         # FastEmbed pipeline, chunking, service
    ├── search/             # Vector, keyword, hybrid (RRF) search
    ├── transcript/         # Transcript parsing
    ├── youtube/            # YouTube data fetching, oEmbed
    └── utils.ts            # Utilities (cn helper)
```

### Naming Conventions
- Components: PascalCase (`VideoCard.tsx`)
- Utilities: kebab-case (`hybrid-search.ts`)
- Functions: camelCase
- Types/Interfaces: PascalCase
- Constants: SCREAMING_SNAKE_CASE
- Path alias: `@/*` for all imports (no relative paths)

### Component Structure
```tsx
// Imports (external, then internal with @/ alias)
// Props interface
// Named export function component
// No default exports
```

### Code Style
- No semicolons
- Single quotes for strings
- Trailing commas
- Named exports (no default exports for components)

## Voice & Copy

### Tone
- Clear and direct
- Technical but approachable
- Action-oriented ("Extract", "Discover", "Generate")

### Terminology
- "Knowledge Bank" (not "database" or "storage")
- "Extract" (not "scrape" or "download")
- "Insights" (not "data" or "information")

## Quality Standards

See `quality.yaml` for gates and thresholds.

- TypeScript strict mode, no `any`
- All components tested
- Accessible by default (WCAG 2.1 AA)
- Mobile-first responsive design

## Architecture Notes

### Dual Server Setup
The project runs two servers concurrently via `npm run dev`:
1. **Next.js dev server** — UI and API routes
2. **Agent server** — WebSocket server for Claude Agent SDK

### Database
- PostgreSQL with pgvector extension
- Docker for local development
- Drizzle ORM with push-based migrations

### Testing Strategy
- Unit tests for utilities and hooks
- Component tests with React Testing Library
- Integration tests for API routes
- Database tests use better-sqlite3 for speed

## Inspiration

Reference: https://www.loopops.com/

Key patterns adopted:
- Rounded cards with generous padding
- Pill-shaped CTAs
- Clean typography hierarchy
- Generous whitespace
- Feature cards with accent backgrounds
