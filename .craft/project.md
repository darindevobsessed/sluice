# Gold Miner - Project DNA

## Vision
A knowledge extraction platform that transforms YouTube content into a searchable knowledge bank, with AI-powered suggestions for Claude Code plugins.

## Tech Stack

### Framework
- **Next.js 14** (App Router)
- TypeScript (strict mode)
- Server Components for data-heavy views
- API Routes for backend processing

### Styling
- **Tailwind CSS** for utility-first styling
- **shadcn/ui** for accessible, customizable components
- Design tokens mapped to Tailwind config
- CSS variables for theming

### Data
- Database: TBD (PostgreSQL recommended for relational + pgvector for embeddings)
- ORM: Prisma or Drizzle
- Vector storage: pgvector or Pinecone for semantic search

### AI/Processing
- Transcription: Whisper API or AssemblyAI
- Embeddings: OpenAI or Anthropic
- LLM: Claude API for plugin generation

### State Management
- React Query for server state
- Zustand for client state (if needed)

## Code Patterns

### File Organization
```
src/
├── app/              # Next.js App Router
│   ├── (auth)/       # Auth-protected routes
│   ├── api/          # API routes
│   └── layout.tsx
├── components/
│   ├── ui/           # shadcn/ui components
│   └── [feature]/    # Feature-specific components
├── lib/
│   ├── db/           # Database utilities
│   ├── ai/           # AI/LLM integrations
│   └── youtube/      # YouTube processing
├── hooks/            # Custom React hooks
└── types/            # TypeScript types
```

### Naming Conventions
- Components: PascalCase (`VideoCard.tsx`)
- Utilities: camelCase (`formatDuration.ts`)
- Constants: SCREAMING_SNAKE_CASE
- Files: kebab-case for routes, PascalCase for components

### Component Structure
```tsx
// Imports (external, then internal)
// Types
// Component
// Exports
```

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

## Inspiration

Reference: https://www.loopops.com/

Key patterns adopted:
- Rounded cards with generous padding
- Pill-shaped CTAs
- Clean typography hierarchy
- Generous whitespace
- Feature cards with accent backgrounds
