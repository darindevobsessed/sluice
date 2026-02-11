---
name: collapsible-sidebar
title: Collapsible Left Navigation Sidebar
status: active
cycle: ui-refinement
story_number: 1
created: 2026-02-11
updated: 2026-02-11
priority: high
chunks_total: 5
chunks_complete: 4
---

# Story: Collapsible Left Navigation Sidebar

## Spark

Add expand/collapse functionality to the left navigation sidebar. When collapsed, the sidebar shrinks to a ~64px icon-only rail. A chevron toggle button on the sidebar controls the state, which persists across sessions via localStorage. The MainContent area reflows smoothly to fill available space.

## Scope

**Included:**
- Sidebar collapse/expand with CSS transition
- Chevron toggle button on the sidebar edge
- Icons-only rail (~64px) in collapsed state
- Logo reduces to just the pickaxe icon when collapsed
- localStorage persistence via a small hook or context
- MainContent margin adjusts with the sidebar width

**Excluded:**
- No hamburger menu or mobile responsive behavior (separate story)
- No keyboard shortcut (can add later)
- No drag-to-resize

## Preserve

- All 5 nav routes and their functionality
- TopBar layout and FocusAreaDropdown
- Active route highlighting behavior
- Theme/provider structure in RootLayout

## Hardest Constraint

The MainContent uses a hard-coded `ml-60` offset. The transition needs to coordinate sidebar width and main content margin simultaneously for a smooth animation — if they go out of sync it'll look janky.

## Decisions

### Collapsed State
**Type:** component
**Choice:** icons-only rail (~64px width)

### Toggle Mechanism
**Type:** component
**Choice:** chevron button on sidebar edge

### State Persistence
**Type:** component
**Choice:** localStorage

## Acceptance

- Given the sidebar is expanded, when the user clicks the chevron, then it collapses to a ~64px icon-only rail with a smooth transition
- Given the sidebar is collapsed, when the user clicks the chevron, then it expands back to full 240px with labels visible
- Given the user collapses/expands the sidebar, when they reload or navigate, then the state is preserved via localStorage
- Given the sidebar is collapsed, when the user hovers a nav icon, then a tooltip shows the label
- Given the sidebar transitions, then the MainContent left margin adjusts accordingly so content reflows smoothly

## Chunks

### Chunk 1: SidebarProvider Context + Tooltip Component

**Goal:** Create the foundational sidebar state context with localStorage persistence and a shadcn/ui Tooltip component.

**Files:**
- `src/components/providers/SidebarProvider.tsx` — create
- `src/components/providers/__tests__/SidebarProvider.test.tsx` — create
- `src/components/ui/tooltip.tsx` — create
- `src/app/layout.tsx` — modify (add SidebarProvider to provider chain)

**Implementation Details:**
- Follow `FocusAreaProvider` pattern: React context + `'use client'`
- Storage key: `gold-miner-sidebar-collapsed` (boolean as `'true'`/`'false'`)
- Use lazy `useState(() => { try { return localStorage.getItem(key) === 'true' } catch { return false } })` to avoid hydration flash
- Expose `collapsed: boolean` and `toggleSidebar: () => void` from context
- Tooltip component: wrap `@radix-ui/react-tooltip` following the `collapsible.tsx` pattern with `data-slot` attributes
- Add `TooltipProvider` with `delayDuration={200}` inside `SidebarProvider` or at app level in layout.tsx
- Place `SidebarProvider` in layout.tsx wrapping both `Sidebar` and `MainContent`

**What Could Break:**
- Provider nesting order — must wrap both Sidebar and MainContent
- Radix Tooltip needs `TooltipProvider` ancestor

**Done When:**
- [ ] `useSidebar()` hook returns `collapsed` and `toggleSidebar`
- [ ] State persists to localStorage on toggle
- [ ] State loads from localStorage on mount without flash
- [ ] Tooltip component renders with `side="right"` positioning
- [ ] Tests cover: default state, toggle, localStorage read/write, missing localStorage

### Chunk 2: Sidebar Collapse/Expand with Chevron Toggle

**Goal:** Make the sidebar consume context and toggle between 240px (expanded) and 64px (collapsed) with smooth CSS transition and a chevron button.

**Files:**
- `src/components/layout/Sidebar.tsx` — modify (dynamic width, toggle button, transition)
- `src/components/layout/SidebarLogo.tsx` — modify (hide text when collapsed)
- `src/components/layout/__tests__/Sidebar.test.tsx` — create

**Implementation Details:**
- Sidebar: replace `w-60` with conditional `w-60`/`w-16` plus `transition-all duration-300 ease-in-out`
- If Tailwind class transitions don't animate smoothly, use inline `style={{ width: collapsed ? '64px' : '240px', transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}`
- Add `overflow-hidden` to the sidebar so content clips during transition
- Chevron toggle: `Button` with `variant="ghost"` `size="icon-sm"` positioned at the bottom of the sidebar
- Icon: `ChevronLeft` when expanded, `ChevronRight` when collapsed
- When collapsed, center the chevron button horizontally
- SidebarLogo: wrap "Gold Miner" text in a span with `overflow-hidden whitespace-nowrap`, hide via conditional render or opacity when collapsed
- Add `prefers-reduced-motion` media query to disable transition

**What Could Break:**
- `overflow-hidden` on sidebar could clip the chevron if it's on the edge
- Logo text disappearing abruptly vs. smoothly — test both approaches

**Done When:**
- [ ] Sidebar toggles between 240px and 64px on chevron click
- [ ] Transition is smooth (300ms ease-in-out)
- [ ] Chevron icon flips direction based on state
- [ ] Logo shows only pickaxe icon when collapsed
- [ ] `prefers-reduced-motion` respects instant toggle

### Chunk 3: SidebarNav Collapsed State + Tooltips

**Goal:** Update nav items to icon-only centered layout when collapsed. Add right-side tooltips on hover showing the label.

**Files:**
- `src/components/layout/SidebarNav.tsx` — modify (conditional layout, tooltip wrapping)
- `src/components/layout/__tests__/SidebarNav.test.tsx` — modify (add collapsed state tests)

**Implementation Details:**
- Consume `useSidebar()` context for `collapsed` state
- When expanded: current layout (`flex items-center gap-3 px-3 py-2`)
- When collapsed: `flex justify-center px-0 py-2` with labels hidden
- Labels: conditionally render with `{!collapsed && <span>...</span>}`
- Wrap each nav item in `<Tooltip>` with `<TooltipTrigger asChild>` around the `Link` and `<TooltipContent side="right">` showing the label
- Only show tooltip when collapsed — when expanded, skip tooltip or set `open={false}`
- Active route styling must work in both states

**What Could Break:**
- Tooltip on an `asChild` Link — verify Radix tooltip + Next.js Link compatibility
- Active state styling may need adjustments for the narrower collapsed width

**Done When:**
- [ ] Collapsed nav shows centered icons only (no labels)
- [ ] Tooltips appear on hover when collapsed, showing the route label
- [ ] Tooltips do NOT appear when sidebar is expanded
- [ ] Active route highlighting works in both states
- [ ] Existing SidebarNav tests still pass, new tests cover collapsed state

### Chunk 4: MainContent Margin Coordination

**Goal:** Make MainContent's left margin respond to sidebar width with a perfectly synchronized transition.

**Files:**
- `src/components/layout/MainContent.tsx` — modify (dynamic margin, transition)

**Implementation Details:**
- Consume `useSidebar()` context for `collapsed` state
- Replace hard-coded `ml-60` with conditional: `collapsed ? 'ml-16' : 'ml-60'`
- Add matching `transition-all duration-300 ease-in-out` (identical to Sidebar)
- If Tailwind transitions cause desync, use inline `style={{ marginLeft: collapsed ? '64px' : '240px', transition: 'margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}`
- Verify TopBar stretches correctly (it's inside MainContent so should inherit)

**What Could Break:**
- Transition desync between sidebar width and content margin — must use identical timing
- Content inside main area may reflow during transition (text wrapping, grids resizing)

**Done When:**
- [ ] MainContent margin transitions in perfect sync with sidebar
- [ ] No gap or overlap between sidebar and content during transition
- [ ] Rapid toggling produces no jank or desync
- [ ] TopBar and page content reflow correctly in both states

### Chunk 5: Ensemble Query Trigger on Question Mark

**Goal:** Change persona ensemble queries to only fire when the query ends with a `?`, instead of on every debounced keystroke that looks like a question. Add a subtle UI hint explaining the behavior.

**Files:**
- `src/app/page.tsx` — modify (lines 56-63: tighten ensemble trigger condition, line 194-198: update hint text)
- `src/app/page.tsx` — modify `isQuestion()` helper (line 20-24) or replace inline

**Implementation Details:**
- **Current flow (problem):** `VideoSearch` debounces at 300ms (src/components/videos/VideoSearch.tsx:33) → calls `onSearch` which sets `query` in `useSearch` → page.tsx line 58 checks `isQuestion(query) && wordCount >= 3` → passes to `useEnsemble(isQueryQuestion ? query : null)` → `useEnsemble` fires a POST to `/api/personas/ensemble` with full SSE stream on every debounced query change that matches
- **Current `isQuestion()` (line 20-24):** Returns true if query ends with `?` OR starts with question words (how/what/why/etc). The question-word heuristic is what causes premature firing — "How do" matches before user finishes typing
- **Fix:** Change the trigger condition on line 58 from:
  ```
  const isQueryQuestion = isQuestion(query) && wordCount >= 3
  ```
  to:
  ```
  const isQueryQuestion = query.trim().endsWith('?') && wordCount >= 3
  ```
  This is a one-line change. The `?` is a natural end-of-question signal typed last, so the 300ms debounce is sufficient — no additional debounce needed
- **`isQuestion()` helper:** Leave it in place (it may be useful elsewhere or in future). Just stop using it for the ensemble trigger
- **`showPanel` (line 163):** Already derived from `isQueryQuestion`, so it automatically updates — panel only shows when `?` is present
- **Hint text (lines 194-198):** Update the existing hint from `"Type keywords to search · Ask a question (3+ words) to hear from your personas"` to `"Type keywords to search · End with ? to ask your personas"` — shorter, more actionable
- **`useEnsemble` abort behavior (src/hooks/useEnsemble.ts:57-61):** Already aborts previous request when `question` changes, so removing `?` (backspace) sets `question` to `null` which triggers `reset()` on line 64-67. No changes needed in useEnsemble.

**What Could Break:**
- Users who relied on the old auto-detect behavior without typing `?` — the hint text teaches the new pattern
- The `isQuestion()` helper is only used in page.tsx (verified via grep) — safe to bypass

**Done When:**
- [ ] Typing "What is the best approach" does NOT trigger ensemble
- [ ] Typing "What is the best approach?" DOES trigger ensemble (after 300ms debounce)
- [ ] Backspacing the `?` clears the ensemble panel (useEnsemble receives null, calls reset)
- [ ] Hint text updated to mention `?` trigger
- [ ] Search results still appear with debounced typing (unchanged)
- [ ] Existing ensemble/persona tests updated for new trigger condition
