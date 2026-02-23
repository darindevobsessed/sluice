# Technology Stack

## Languages

- **TypeScript 5.x** - Primary language with strict mode enabled
- **SQL** - SQLite for database operations via Drizzle ORM

## Frameworks & Libraries

### Frontend
- **Next.js 16.1.6** - React meta-framework with App Router
- **React 19.2.3** - UI library (latest version)
- **Tailwind CSS 4.x** - Utility-first CSS with tw-animate-css
- **Radix UI** - Headless accessible UI primitives
- **class-variance-authority** - Component variant management
- **lucide-react** - Icon library
- **next-themes** - Dark/light mode theming

### Backend
- **Next.js API Routes** - REST API endpoints
- **Drizzle ORM 0.45.1** - Type-safe database access
- **better-sqlite3** - SQLite database driver
- **Zod 4.3.6** - Runtime type validation

### AI/Agent
- **@anthropic-ai/claude-agent-sdk 0.2.31** - Claude Agent integration
- **WebSockets (ws)** - Real-time agent communication
- **Streaming JSON parsing** - Progressive response handling

### Utilities
- **nanoid** - ID generation
- **clsx + tailwind-merge** - Class name utilities
- **chalk** - CLI output coloring

## Infrastructure

### Database
- **SQLite** - Local file-based database (`./data/sluice.db`)
- **Drizzle Kit** - Database migrations and schema management
- Full-text search (FTS5) for transcript search

### Development Server
- Concurrent processes via `concurrently`:
  - Next.js dev server (port 3000)
  - Agent WebSocket server

### CI/CD
- Local development only (no deployment configured yet)

## Development Tools

### Package Manager
- **npm** - Package management

### Testing
- **Vitest 4.x** - Test runner with React Testing Library
- **jsdom** - Browser environment simulation
- **@testing-library/react** - React component testing
- **@testing-library/user-event** - User interaction simulation

### Linting/Formatting
- **ESLint 9** with Next.js config
- **TypeScript strict mode** with `noUncheckedIndexedAccess`

### Build Tools
- **tsx** - TypeScript execution for agent scripts
- **PostCSS** - CSS processing

## Architecture Pattern

**Modular Monolith** - Single Next.js application with clear separation:

- `/src/app/` - Next.js App Router pages and API routes
- `/src/components/` - React UI components (feature-organized)
- `/src/lib/` - Shared utilities, database, Claude integration
- `/src/hooks/` - Custom React hooks
- `/src/agent/` - Background Claude agent server

### Key Design Decisions

1. **SQLite over PostgreSQL** - Simplicity for local-first development
2. **WebSocket agent** - Enables streaming responses for extraction
3. **Drizzle ORM** - Type-safe queries without heavyweight ORM
4. **App Router** - Modern Next.js patterns with Server Components
5. **Radix UI** - Accessible primitives without styling lock-in

## Database Schema

Four main tables:
- `videos` - YouTube video metadata and transcripts
- `channels` - YouTube channel information
- `insights` - AI-generated extraction results (1:1 with videos)
- `settings` - Key-value configuration store
