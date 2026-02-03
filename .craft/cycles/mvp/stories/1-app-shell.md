---
name: app-shell
title: App Shell
status: active
priority: high
created: 2026-02-03
updated: 2026-02-03
cycle: mvp
story_number: 1
chunks_total: 6
chunks_complete: 4
---

# Story: App Shell

## Spark

The foundational structure for Gold Miner. A Next.js 14 app with a persistent left sidebar navigation (Linear-style), four main pages (Knowledge Bank, Add Video, Discovery, Settings), and theme toggle in settings. Uses local Claude agent token via SDK — no user API key configuration needed. SQLite database initialized and ready. Design tokens from the Craft harness wired into Tailwind config. shadcn/ui components installed and themed with rich green primary.

## Dependencies

**Blocked by:** None (this is the foundation)
**Blocks:** All other stories

## Acceptance

- [ ] Next.js 14 app runs with `npm run dev`
- [ ] Sidebar navigation with 4 pages: Knowledge Bank, Add Video, Discovery, Settings
- [ ] Active nav item highlighted with rich green
- [ ] SQLite database initialized with schema for videos, channels, insights, settings
- [ ] Design tokens wired into Tailwind (colors, typography, spacing)
- [ ] shadcn/ui installed with Button and Card components themed
- [ ] Dark/light/system theme toggle in Settings
- [ ] Theme persists across page refresh
- [ ] All pages render with consistent layout

## Chunks

### Chunk 1: Project Setup

**Goal:** Initialize Next.js 14 with TypeScript, Tailwind CSS, and proper project structure.

**Files:**
- `package.json` — create (via create-next-app)
- `tsconfig.json` — create (via create-next-app)
- `tailwind.config.ts` — create (via create-next-app, will modify in Chunk 2)
- `next.config.ts` — create
- `src/app/layout.tsx` — create (basic, will enhance in Chunk 4)
- `src/app/page.tsx` — create (temporary home)
- `.env.local` — create (for future env vars)
- `.gitignore` — update

**Implementation Details:**
- Run `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- Use App Router (not Pages Router)
- Enable strict TypeScript
- Add path aliases: `@/components`, `@/lib`, `@/hooks`
- Install Inter font via `next/font`

**What Could Break:**
- create-next-app prompts — may need to handle interactively
- Existing files in directory — should be empty except .craft

**Done When:**
- [x] `npm run dev` starts without errors
- [x] http://localhost:3000 shows Next.js welcome page
- [x] TypeScript strict mode enabled
- [x] Tailwind classes work (test with a colored div)

---

### Chunk 2: Design System + shadcn/ui

**Goal:** Install shadcn/ui, wire design tokens from `.craft/design/tokens.yaml` into Tailwind config.

**Files:**
- `tailwind.config.ts` — modify (add custom colors, fonts, spacing)
- `src/app/globals.css` — modify (add CSS variables for theming)
- `components.json` — create (shadcn/ui config)
- `src/components/ui/button.tsx` — create (via shadcn/ui)
- `src/components/ui/card.tsx` — create (via shadcn/ui)
- `src/lib/utils.ts` — create (cn utility for class merging)

**Implementation Details:**
- Run `npx shadcn@latest init` with these options:
  - Style: Default
  - Base color: Neutral (we'll override with our tokens)
  - CSS variables: Yes
- Map tokens.yaml colors to CSS variables:
  ```css
  :root {
    --primary: 156 72% 30%;  /* #059669 in HSL */
    --primary-foreground: 0 0% 100%;
    /* ... etc */
  }
  ```
- Update tailwind.config.ts to use CSS variables
- Install initial components: button, card (we'll add more as needed)
- Test with a Button component using primary color

**What Could Break:**
- HSL conversion from hex — need to convert tokens correctly
- shadcn/ui prompts — handle interactively

**Done When:**
- [x] Button renders with rich green (#059669) background
- [x] Dark mode CSS variables defined (for Chunk 6)
- [x] `cn()` utility works for class merging
- [x] Inter font applied globally

---

### Chunk 3: SQLite Database

**Goal:** Set up SQLite database with Drizzle ORM and initial schema.

**Files:**
- `src/lib/db/index.ts` — create (database connection)
- `src/lib/db/schema.ts` — create (table definitions)
- `drizzle.config.ts` — create (Drizzle configuration)
- `package.json` — modify (add drizzle-orm, better-sqlite3)

**Implementation Details:**
- Install: `drizzle-orm`, `better-sqlite3`, `@types/better-sqlite3`, `drizzle-kit`
- Create database at `data/gold-miner.db` (gitignored)
- Initial schema tables:
  ```typescript
  // videos table
  id, youtubeId, title, channel, thumbnail, duration, transcript, createdAt, updatedAt

  // channels table (for discovery)
  id, channelId, name, thumbnailUrl, createdAt

  // insights table (for Claude outputs)
  id, videoId, type, content, createdAt

  // settings table (key-value for preferences)
  key, value
  ```
- Add `data/` to .gitignore
- Create db initialization script

**What Could Break:**
- better-sqlite3 native bindings — may need rebuild
- Server-only — cannot import in client components

**Done When:**
- [x] `npm run db:push` creates tables
- [x] Database file created at `data/gold-miner.db`
- [x] Can import db in API routes/server components
- [x] Schema matches planned data model

---

### Chunk 4: Layout with Sidebar

**Goal:** Create the main app layout with persistent sidebar navigation.

**Files:**
- `src/app/layout.tsx` — modify (add sidebar wrapper)
- `src/components/layout/Sidebar.tsx` — create
- `src/components/layout/SidebarNav.tsx` — create (nav items)
- `src/components/layout/SidebarLogo.tsx` — create
- `src/components/layout/MainContent.tsx` — create (content wrapper)

**Implementation Details:**
- Sidebar: 240px wide, fixed left, full height
- Logo at top with "Gold Miner" text
- Nav items with icons:
  - Knowledge Bank (home icon) — `/`
  - Add Video (plus icon) — `/add`
  - Discovery (compass icon) — `/discovery`
  - Settings (gear icon) — `/settings`
- Active state: rich green background with white text
- Hover state: subtle gray background
- Main content: margin-left to account for sidebar
- Mobile: sidebar hidden, hamburger menu (can be basic for now)
- Use Lucide icons (comes with shadcn/ui)

**What Could Break:**
- Layout shift on navigation — use proper active detection
- Mobile responsive — keep simple for MVP

**Done When:**
- [x] Sidebar renders on all pages
- [x] Nav items link to correct routes
- [x] Active item highlighted with green
- [x] Logo displayed at top
- [x] Content area scrolls independently

---

### Chunk 5: Page Stubs

**Goal:** Create all four page routes with placeholder content.

**Files:**
- `src/app/page.tsx` — modify (Knowledge Bank placeholder)
- `src/app/add/page.tsx` — create (Add Video placeholder)
- `src/app/discovery/page.tsx` — create (Discovery placeholder)
- `src/app/settings/page.tsx` — create (Settings placeholder, will enhance in Chunk 6)

**Implementation Details:**
- Each page gets:
  - Page title (h1)
  - Brief description of what will go here
  - Empty state illustration or message
- Use consistent layout:
  ```tsx
  <div className="p-6">
    <h1 className="text-2xl font-semibold mb-2">Page Title</h1>
    <p className="text-muted-foreground mb-8">Description</p>
    {/* Content area */}
  </div>
  ```
- Knowledge Bank: "Your knowledge bank is empty. Add your first video."
- Add Video: "Add a new video to your knowledge bank."
- Discovery: "Follow channels to discover new content."
- Settings: Will be completed in Chunk 6

**What Could Break:**
- Nothing significant — simple placeholder pages

**Done When:**
- [ ] All four routes accessible
- [ ] Navigation between pages works
- [ ] Consistent styling across pages
- [ ] Page titles show in browser tab

---

### Chunk 6: Theme Toggle

**Goal:** Implement dark/light mode with next-themes and a toggle in Settings.

**Files:**
- `src/app/layout.tsx` — modify (add ThemeProvider)
- `src/components/providers/ThemeProvider.tsx` — create
- `src/app/globals.css` — modify (add dark mode CSS variables)
- `src/app/settings/page.tsx` — modify (add theme toggle)
- `src/components/ui/theme-toggle.tsx` — create

**Implementation Details:**
- Install `next-themes`
- Wrap app in ThemeProvider with:
  - attribute="class" (for Tailwind dark mode)
  - defaultTheme="system"
  - enableSystem=true
- Add dark mode CSS variables in globals.css:
  ```css
  .dark {
    --background: 224 71% 4%;
    --foreground: 213 31% 91%;
    --primary: 156 72% 30%;
    /* ... map all tokens to dark variants */
  }
  ```
- Settings page shows:
  - Section: "Appearance"
  - Theme selector: System / Light / Dark (radio or select)
  - Preview of current theme
- Theme toggle component using shadcn/ui Select or RadioGroup

**What Could Break:**
- Hydration mismatch — suppressHydrationWarning on html tag
- Flash of wrong theme — next-themes handles this

**Done When:**
- [ ] Theme persists across page refresh
- [ ] System preference detected by default
- [ ] Settings page shows current theme
- [ ] Can switch between light/dark/system
- [ ] All UI elements respect theme

## Notes

- Sidebar nav inspired by Linear
- Rich green primary (#059669) from design tokens
- SQLite for localhost embedded storage
- Claude SDK with agent token (not user-provided API key)
- Settings trimmed to theme toggle only for shell; preferences/export come later
