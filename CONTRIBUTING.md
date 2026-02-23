# Contributing to Sluice

Thank you for your interest in contributing to Sluice! This project transforms YouTube content into a searchable knowledge bank with AI-powered personas and Claude Code integration. Whether you're fixing bugs, adding features, or improving documentation, your contributions are welcome.

For an overview of the project's purpose and features, see the [README](README.md).

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** — JavaScript runtime ([download](https://nodejs.org/))
- **Docker** — For running PostgreSQL 16 with pgvector ([download](https://www.docker.com/))
- **npm** — Package manager (comes with Node.js)
- **Git** — Version control ([download](https://git-scm.com/))

---

## Local Development Setup

Follow these steps to get Sluice running on your machine:

### 1. Fork and Clone

Fork the repository on GitHub, then clone your fork:

```bash
git clone https://github.com/your-username/gold-miner.git
cd gold-miner
```

### 2. Start PostgreSQL with pgvector

Start the PostgreSQL 16 container with the pgvector extension:

```bash
docker compose up -d
```

This command starts a PostgreSQL instance with the following defaults (matching `.env.example`):
- **Host:** `localhost:5432`
- **Database:** `goldminer`
- **User:** `goldminer`
- **Password:** `goldminer`

The pgvector extension is automatically enabled via `scripts/init-db.sql` on first startup.

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

- **`DATABASE_URL`** — PostgreSQL connection string
  - Default: `postgresql://goldminer:goldminer@localhost:5432/goldminer`
  - If using Docker with default settings, no changes needed

- **`NEXT_PUBLIC_AGENT_PORT`** — Agent WebSocket port
  - Default: `9334`
  - Must match `AGENT_PORT` in npm scripts (already configured in `package.json`)

- **`AI_GATEWAY_KEY`** — AI gateway key for AI features (insights, personas, ensemble queries)
  - Optional for development (you can ingest and search videos without it)
  - Required for AI features (insights generation, personas, ensemble queries)
  - Get your key at [https://console.anthropic.com/](https://console.anthropic.com/)

Optional variables:
- **`CRON_SECRET`** — Secret token for securing `/api/cron/*` endpoints (required for production)
- **`MCP_AUTH_ENABLED`** — Enable MCP authentication (default: `false`, set `true` for production)
- **`MCP_AUTH_TOKEN`** — MCP authentication token (required if `MCP_AUTH_ENABLED=true`)

### 4. Install Dependencies

```bash
npm install
```

This installs all project dependencies, including Next.js, Drizzle ORM, FastEmbed, and development tools.

### 5. Initialize the Database

Push the Drizzle schema to your PostgreSQL instance:

```bash
npm run db:push
```

This command creates all 11 tables with proper indexes, foreign keys, and cascade deletes. No manual SQL needed.

### 6. Start the Development Servers

```bash
npm run dev
```

This starts two servers in parallel:
- **Next.js dev server** on `http://localhost:3001`
- **Agent WebSocket server** on port `9334`

Open [http://localhost:3001](http://localhost:3001) in your browser. You're ready to develop!

---

## Code Style

Sluice follows strict conventions to maintain consistency across the codebase. Please adhere to these guidelines:

### TypeScript & Formatting
- **No semicolons** — Semicolons are omitted per project convention
- **Single quotes** — Use single quotes for strings (e.g., `'hello'` not `"hello"`)
- **Trailing commas** — Always include trailing commas in arrays, objects, and function parameters
- **Named exports only** — No default exports (use `export const MyComponent` not `export default MyComponent`)
- **Path aliases** — Use `@/*` for all imports (e.g., `import { db } from '@/lib/db'` not `'../../../lib/db'`)

### API Routes
- **Zod validation at boundaries** — Use `safeParse()` for all request validation
- **First error message in 400 response** — Return the first Zod error as a plain string in the response body
- **Consistent response shape** — Use `{ data, error, meta }` structure where applicable

### Components
- **shadcn/ui base components** — Build on top of shadcn/ui primitives
- **CVA for variants** — Use `class-variance-authority` for component variants
- **`cn()` utility for class merging** — Use `cn()` from `@/lib/utils` to merge Tailwind classes
- **Server components by default** — Use React Server Components unless client interactivity is needed
- **`'use client'` only when needed** — Mark components with `'use client'` directive only when required (e.g., hooks, event handlers)

### Database
- **Drizzle ORM** — All database queries use Drizzle
- **`drizzle-kit push`** — Use `npm run db:push` for schema migrations (no manual SQL)
- **Cascade deletes on foreign keys** — All foreign key relationships use cascade deletes

### Architecture Reference

For detailed architecture, API patterns, and conventions, see [CLAUDE.md](CLAUDE.md).

---

## Testing

Sluice uses [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/react) for testing.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Organization

- **Colocated tests** — Tests live in `__tests__/` directories next to the source files they test
- **Database tests use better-sqlite3** — Tests use in-memory SQLite, not PostgreSQL (no Docker needed)
- **Focus on behavior, not implementation** — Test what users experience, not internal implementation details

### Writing Tests

When adding new functionality, include tests that cover:
- **Success case** — The happy path works as expected
- **Error handling** — Invalid inputs and failure states are handled gracefully
- **Edge cases** — Boundary conditions (empty input, null values, etc.)

Example test structure:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders the success state', () => {
    render(<MyComponent data={mockData} />)
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('handles empty data gracefully', () => {
    render(<MyComponent data={[]} />)
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })
})
```

---

## Pull Request Process

### 1. Fork the Repository

Click the "Fork" button on the [Sluice GitHub page](https://github.com/yourusername/gold-miner) to create your own copy.

### 2. Create a Descriptive Branch

Use a clear, descriptive branch name:

```bash
# Feature branches
git checkout -b feature/add-channel-export

# Bug fix branches
git checkout -b fix/search-pagination

# Documentation branches
git checkout -b docs/update-setup-guide
```

### 3. Write Tests for New Functionality

All new features and bug fixes should include tests. See the [Testing](#testing) section for guidance.

### 4. Ensure Quality Checks Pass

Before submitting your PR, run:

```bash
npm run lint && npm test
```

Both commands must pass without errors.

### 5. Open a Pull Request

Push your branch to your fork and open a PR against the `main` branch of the original repository. Include:

- **Clear description** — Explain what changed and why
- **Related issues** — Reference any issues the PR addresses (e.g., "Fixes #123")
- **Screenshots** — For UI changes, include before/after screenshots

### 6. Address Review Feedback

Maintainers may request changes. Address feedback promptly and push updates to your branch.

---

## Commit Messages

Use clear, consistent commit messages:

- **Imperative mood** — "Add feature" not "Added feature" or "Adds feature"
- **Concise first line** — Keep under 72 characters
- **Reference issues** — Include issue numbers where applicable (e.g., "Fix search pagination (#123)")

Good examples:

```
Add channel export to CSV
Fix null pointer in search results
Update setup instructions for Docker
```

Bad examples:

```
fixed a bug
Added some stuff
WIP
```

---

## Issue Guidelines

### Creating Issues

Before creating a new issue:
1. **Search existing issues** — Check if the bug or feature request already exists
2. **Use issue templates** — Fill out the provided templates for bug reports and feature requests
3. **Provide context** — Include reproduction steps for bugs, and use cases for features

### Bug Reports

Include:
- **Steps to reproduce** — Clear, numbered steps
- **Expected behavior** — What should happen
- **Actual behavior** — What actually happens
- **Environment** — OS, Node version, browser (if UI-related)
- **Screenshots** — If applicable

### Feature Requests

Include:
- **Use case** — Why is this feature needed?
- **Proposed solution** — How should it work?
- **Alternatives considered** — Other approaches you thought about

---

## What Makes a Good PR

A high-quality pull request has these characteristics:

- **Focused scope** — One feature or fix per PR (not multiple unrelated changes)
- **Tests included** — New functionality is covered by tests
- **Follows code style** — Matches the conventions in this guide
- **Clear description** — Explains what changed, why, and how to test it
- **No extraneous changes** — Only changes relevant to the PR (no unrelated formatting, refactoring, etc.)

---

## Questions?

If you have questions about contributing, feel free to:
- Open a [GitHub Discussion](https://github.com/yourusername/gold-miner/discussions)
- Ask in an issue or PR
- Review [CLAUDE.md](CLAUDE.md) for technical architecture details

Thank you for contributing to Sluice!
