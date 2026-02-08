---
name: ui-enhancements
title: UI Enhancements
status: complete
priority: high
created: 2026-02-05
updated: 2026-02-07
cycle: experience
story_number: 1
chunks_total: 6
chunks_complete: 6
current_chunk: 6
---

# Story: UI Enhancements

## Spark

Improve the video detail page layout based on Brad's feedback. Make Insights the default tab — users want the extracted value first, raw transcript second. Add a global top bar with a focus area dropdown for filtering the entire knowledge bank experience.

> *"Put. Put insights before the transcript. I I like that the transcript's there. It's the first thing I wanna see. I wanna see insights."*
> *"So maybe then what I need is, like, a profile. Not a profile, but kinda like a yeah, almost like a profile selector. Instead of having within the knowledge bank having different categories, we just have, like, a root level category tab. That we can go through."*
> *"Like, focus areas, something like that."*

**Key decisions:**
- Insights tab becomes the default on video detail page (simple prop change)
- Focus areas live in a **global top bar** as a dropdown on the right side
- Focus areas are **user-defined** categories (not auto-extracted)
- "All" selected by default — filters Knowledge Bank + Search
- Selection persisted in localStorage
- "Manage Focus Areas" option in dropdown for CRUD operations

## Visual Direction

**Vibe:** Command Center
**Feel:** Structured, dashboard-like, purposeful
**Inspiration:** Notion's top bar with page title + breadcrumbs, Linear's workspace bar

**Layout:**
```
┌──────────┬──────────────────────────────────────────┐
│          │  ┌─ top bar (h-14, bg-card) ───────────┐ │
│  SIDEBAR │  │  📊 Knowledge Bank    [All Areas ▾] │ │
│          │  └───────────────────────────────────────┘ │
│          │   Stats · Search · Video Grid             │
└──────────┴──────────────────────────────────────────┘
```

**Key Elements:**
- 56px top bar with `bg-card` background and bottom border
- Page title absorbed into bar (left-aligned, semibold)
- Focus area dropdown right-aligned with pill styling
- Video detail page: back button + title move into bar, insights tab default

**Motion:**
- Skeleton loading for filtered content (table-stakes)
- Dropdown fade+scale on open/close (table-stakes)
- Page title crossfade on navigation (old slides left, new slides in from right, 200ms ease)
- Focus area content morph: cards that persist stay in place, removed cards shrink out, new cards expand in (CSS transitions for MVP, upgrade to Framer Motion later if needed)

## Dependencies

**Blocked by:** None
**Blocks:** None

## Acceptance

- [ ] Insights tab is the default on video detail page (not transcript)
- [ ] 56px global top bar visible on all pages with page title left-aligned
- [ ] Video detail page shows back button + video title in top bar
- [ ] Focus area dropdown in top bar right side shows "All Areas" by default
- [ ] Users can create, rename, and delete focus areas via "Manage" modal
- [ ] Selecting a focus area filters Knowledge Bank video grid
- [ ] Search results respect the selected focus area filter
- [ ] Videos can be assigned to focus areas from the video detail page
- [ ] Focus area selection persists across page reloads (localStorage)
- [ ] Grid items animate smoothly when focus area filter changes
- [ ] Responsive layout works on mobile viewports

## Chunks

### Chunk 1: DB Schema, API Routes & Focus Area Context

**Goal:** Create the data layer — focus areas table, junction table, API routes for CRUD, and the React context that makes focus area state available app-wide.

**Files:**
- `src/lib/db/schema.ts` — modify (add `focusAreas` + `videoFocusAreas` tables, type exports)
- `src/app/api/focus-areas/route.ts` — create (GET all, POST create)
- `src/app/api/focus-areas/[id]/route.ts` — create (PATCH rename, DELETE)
- `src/app/api/videos/[id]/focus-areas/route.ts` — create (GET, POST assign, DELETE unassign)
- `src/components/providers/FocusAreaProvider.tsx` — create (React context + localStorage sync)

**Implementation Details:**
- `focusAreas` table: `id` (serial PK), `name` (text, not null, unique), `color` (text, nullable), `createdAt` (timestamp)
- `videoFocusAreas` junction: `videoId` (FK videos), `focusAreaId` (FK focusAreas), unique composite, cascade deletes
- Type exports: `FocusArea`, `NewFocusArea`, `VideoFocusArea`, `NewVideoFocusArea`
- API routes use Drizzle queries, validate with Zod
- FocusAreaProvider: `selectedFocusAreaId` state (number | null), synced to localStorage key `gold-miner-focus-area`, provides `{focusAreas, selectedFocusAreaId, setSelectedFocusAreaId, refetch}`
- `null` = "All" (not a DB entry — handled in UI/filtering logic)
- Follow existing pattern from `ThemeProvider` and `AgentProvider` for context shape

**What Could Break:**
- DB push needed after schema change (`npx drizzle-kit push`)
- Provider must be added to layout.tsx (Chunk 2)

**Done When:**
- [ ] Focus areas table and junction table exist in schema
- [ ] API routes handle CRUD with proper validation
- [ ] FocusAreaProvider loads focus areas and persists selection
- [ ] DB push succeeds without errors

---

### Chunk 2: Global Top Bar Shell & Layout Integration

**Goal:** Create the 56px top bar component, integrate it into MainContent, and wire up the FocusAreaProvider in the root layout. Page title moves from page content into the bar.

**Files:**
- `src/components/layout/TopBar.tsx` — create (bar shell with page title slot + right-side slot)
- `src/components/layout/MainContent.tsx` — modify (add TopBar above children, pass page title)
- `src/app/layout.tsx` — modify (wrap with FocusAreaProvider)
- `src/app/page.tsx` — modify (remove `<h1>`, pass title to top bar via prop/context)
- `src/app/videos/[id]/page.tsx` — modify (remove back button + title from body, pass to top bar)

**Implementation Details:**
- TopBar: `h-14 bg-card border-b` strip, flex layout with `justify-between items-center px-6`
- Left side: page title (semibold, text-lg) + optional back button
- Right side: slot for focus area dropdown (Chunk 3)
- Page title mechanism: React context (`PageTitleContext`) in MainContent so child pages can call `usePageTitle('Knowledge Bank')` to set title + optional back link
- Video detail page sets title to video name + back link to "/"
- MainContent adds `pt-14` to account for fixed top bar, or use flex column layout
- Page title crossfade animation: CSS transition on title text with `transition-opacity duration-200`

**What Could Break:**
- Pages currently have their own `<h1>` and padding — need to remove those
- Video detail page has loading/error states that also render titles — update all code paths

**Done When:**
- [ ] 56px top bar visible across all pages
- [ ] Page title shows correctly on Knowledge Bank and Video Detail
- [ ] Back button works on Video Detail page
- [ ] FocusAreaProvider wraps the app in layout.tsx
- [ ] No visual regression — existing pages look correct

---

### Chunk 3: Focus Area Dropdown (shadcn Install + UI)

**Goal:** Install missing shadcn components and build the focus area dropdown in the top bar's right slot.

**Files:**
- `src/components/ui/dropdown-menu.tsx` — create (via `npx shadcn add dropdown-menu`)
- `src/components/layout/FocusAreaDropdown.tsx` — create (pill-styled trigger + dropdown items)
- `src/components/layout/TopBar.tsx` — modify (add FocusAreaDropdown to right side)

**Implementation Details:**
- Install: `npx shadcn add dropdown-menu`
- Trigger: pill-shaped button (`rounded-full px-4 py-1.5 text-sm bg-muted hover:bg-muted/80`), shows selected area name or "All Areas"
- Dropdown items: list all focus areas from context, "All" at top, separator, "Manage Focus Areas..." at bottom
- Selecting an area calls `setSelectedFocusAreaId()` from context
- "Manage Focus Areas..." triggers Chunk 4's modal (wire up later, just set state for now)
- Dropdown animation: shadcn's built-in fade+scale via Radix

**What Could Break:**
- shadcn CLI may need configuration check (components.json exists)
- Dropdown-menu depends on `@radix-ui/react-dropdown-menu`

**Done When:**
- [ ] Dropdown renders in top bar right side
- [ ] Shows "All Areas" by default
- [ ] Lists all focus areas from context
- [ ] Selecting updates context + localStorage
- [ ] "Manage Focus Areas..." option present (non-functional until Chunk 4)

---

### Chunk 4: Manage Focus Areas Modal (CRUD UI)

**Goal:** Build the modal for creating, renaming, and deleting focus areas.

**Files:**
- `src/components/ui/dialog.tsx` — create (via `npx shadcn add dialog`)
- `src/components/layout/ManageFocusAreasModal.tsx` — create (dialog with focus area list + actions)
- `src/components/layout/FocusAreaDropdown.tsx` — modify (wire "Manage" to open modal)

**Implementation Details:**
- Install: `npx shadcn add dialog`
- Modal layout: title "Manage Focus Areas", list of existing areas with rename/delete buttons, "Add Focus Area" input at bottom
- Create: text input + button, calls POST `/api/focus-areas`, refetches list
- Rename: inline edit (click name -> input field), calls PATCH `/api/focus-areas/[id]`
- Delete: trash icon with confirm prompt (simple `window.confirm` for MVP), calls DELETE
- Delete cascade: if selected area is deleted, selection resets to "All"
- After any mutation, call `refetch()` from FocusAreaProvider context
- Form validation: name required, min 1 char, trim whitespace

**What Could Break:**
- Dialog depends on `@radix-ui/react-dialog`
- Delete of area with assigned videos — cascade removes junction rows but keeps videos

**Done When:**
- [ ] Modal opens from dropdown "Manage" option
- [ ] Can create new focus areas
- [ ] Can rename existing focus areas (inline)
- [ ] Can delete focus areas with confirmation
- [ ] List updates after mutations
- [ ] Deleting selected area resets to "All"

---

### Chunk 5: Knowledge Bank Filtering & Video Assignment

**Goal:** Wire focus area selection to actually filter the Knowledge Bank grid and search results. Add ability to assign videos to focus areas from the video detail page.

**Files:**
- `src/app/page.tsx` — modify (filter videos by selected focus area)
- `src/app/api/videos/route.ts` — modify (accept `focusAreaId` query param for filtering)
- `src/hooks/useSearch.ts` — modify (pass focusAreaId to search API)
- `src/app/api/search/route.ts` — modify (filter search results by focus area)
- `src/app/videos/[id]/page.tsx` — modify (add focus area assignment UI)
- `src/components/video/FocusAreaAssignment.tsx` — create (multi-select chips for assigning video to areas)

**Implementation Details:**
- Knowledge Bank page: when `selectedFocusAreaId` is set, pass to `/api/videos?focusAreaId=X`
- API: join videos with videoFocusAreas to filter when param present
- Search: add focusAreaId to search request, filter results in search API
- Video detail: show "Focus Areas" section with chip-style toggles for each area
- Assignment: clicking a chip calls POST/DELETE to assign/unassign
- When "All" selected (null), no filter applied — existing behavior

**What Could Break:**
- Video API currently returns all videos — adding filter param needs backward compat (param is optional)
- Search API joins may need adjustment for focus area filter

**Done When:**
- [ ] Selecting a focus area filters Knowledge Bank grid
- [ ] Search results respect selected focus area
- [ ] "All" shows everything (no regression)
- [ ] Can assign/unassign focus areas on video detail page
- [ ] Assigned areas show as active chips

---

### Chunk 6: Insights Tab Default & Polish

**Goal:** Make Insights the default tab, add content morph animation for grid filtering, and polish the overall experience.

**Files:**
- `src/components/insights/InsightsTabs.tsx` — modify (change defaultValue to "insights")
- `src/app/page.tsx` — modify (add CSS transitions for grid filtering)
- `src/components/videos/VideoGrid.tsx` — modify (add transition classes for card enter/exit)
- `src/components/layout/TopBar.tsx` — modify (add page title crossfade transition)

**Implementation Details:**
- InsightsTabs: change `defaultValue="transcript"` to `defaultValue="insights"` on line 38
- Grid filtering animation: CSS approach using `transition-all duration-300` on grid items, `opacity-0 scale-95` for exit, `opacity-100 scale-100` for enter
- Use CSS `key` prop on VideoGrid to trigger re-render animation when focus area changes
- Page title crossfade: `transition-opacity duration-200 ease-in-out` with key-based swap
- Skeleton shimmer for filtered content loading: reuse existing `animate-pulse` pattern
- Final check: all pages render correctly, no console errors, responsive on mobile

**What Could Break:**
- CSS-only content morph is less smooth than Framer Motion layoutId — acceptable for MVP
- Grid key change causes full re-render — acceptable, keeps cards fresh

**Done When:**
- [ ] Insights tab is default on video detail page
- [ ] Grid items animate smoothly when focus area changes
- [ ] Page title crossfades on navigation
- [ ] No console errors across all pages
- [ ] Responsive layout works on mobile viewport

## Notes

- Video detail: Change `InsightsTabs` defaultValue from "transcript" to "insights"
- Global top bar: thin header strip across main content area, focus area dropdown right-aligned
- Focus areas table in DB: id, name, color (optional), createdAt
- Video-to-focus-area assignment (many-to-many junction table)
- Focus area context persisted in React context + localStorage
- "Manage" modal: create, rename, delete focus areas
- Assign videos to focus areas from video detail page or bulk from Knowledge Bank
- Animation strategy: CSS transitions for MVP (no Framer Motion dependency)
- Missing shadcn components: dropdown-menu (Chunk 3), dialog (Chunk 4) — install via CLI
- DB push required after Chunk 1 schema changes
