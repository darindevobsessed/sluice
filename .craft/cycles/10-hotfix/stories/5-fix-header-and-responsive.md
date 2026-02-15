---
name: fix-header-and-responsive
title: Fix header styling and responsive layout across all pages
status: active
cycle: hotfix
story_number: 5
created: 2026-02-15
updated: 2026-02-15
priority: high
chunks_total: 3
chunks_complete: 1
current_chunk: 2
---

# Story: Fix header styling and responsive layout across all pages

## Spark
The top header bar has no padding and text is too large. Beyond the header, there are responsive styling issues across multiple pages that don't work well on mobile viewports. Fix the header spacing/sizing and audit all pages for mobile-friendly layouts — proper padding, text scaling, overflow handling, and responsive breakpoints.

## Delivery
Chunk 1 fixes the TopBar padding/text and implements the mobile sidebar pattern (hidden by default, hamburger toggle, slide-in overlay with backdrop). Chunk 2 applies responsive padding and text scaling across all page routes. Chunk 3 fixes component-level grids, tabs, and stat displays for mobile. Together, every page and layout component gets proper mobile treatment.

## Scope
**Included:**
- Fix top header bar padding and text size
- Implement mobile sidebar (hamburger toggle, slide-in overlay, backdrop)
- Responsive padding on all pages (Knowledge Bank, video detail, add video, add transcript, settings)
- Responsive grids and component layouts
- Discovery page already responsive — no changes needed

**Excluded:**
- Feature changes or new functionality
- Desktop layout restructuring (focus is mobile/responsive)
- Component API changes

## Hardest Constraint
The sidebar uses inline `style={{ width: collapsed ? '64px' : '240px' }}` and MainContent uses template literal `ml-16`/`ml-60`. These are fundamentally desktop patterns. Mobile treatment requires coordinating SidebarProvider state, Sidebar visibility, MainContent margins, and TopBar hamburger button — all must work together.

## Decisions
### Mobile sidebar approach
**Type:** component
**Choice:** inline
Sidebar hidden below `md` breakpoint. Hamburger button in TopBar triggers slide-in overlay at full width (240px). Backdrop click closes. Separate `mobileOpen` state in SidebarProvider (not persisted to localStorage). Desktop collapse behavior unchanged.

## Chunk 1: Fix TopBar and implement mobile sidebar

**Goal:** Fix the header padding/text issues and implement the mobile sidebar pattern (hidden by default on mobile, hamburger button in TopBar, slide-in overlay with backdrop).

**Files:**
- Modify: `src/components/providers/SidebarProvider.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/MainContent.tsx`
- Modify: `src/components/layout/TopBar.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/layout/__tests__/TopBar.test.tsx`
- Modify: `src/components/layout/__tests__/Sidebar.test.tsx`
- Modify: `src/components/layout/__tests__/MainContent.test.tsx`

**Implementation Details:**

1. **SidebarProvider** (`src/components/providers/SidebarProvider.tsx`) — Add `mobileOpen: boolean` state (default false), `toggleMobile()` and `closeMobile()` callbacks to context. Keep existing `collapsed`/`toggleSidebar` for desktop. No localStorage for mobile state. Interface becomes `{ collapsed, toggleSidebar, mobileOpen, toggleMobile, closeMobile }`.

2. **TopBar** (`src/components/layout/TopBar.tsx:20`) — Change `px-6` to `px-3 sm:px-6`. Change title `text-lg` to `text-base sm:text-lg` (line 37). Add `truncate` class to the `h1`. Add a hamburger button using `Menu` icon from `lucide-react`, visible only on mobile (`md:hidden`), placed at the start of the left-side flex div. Wire to `toggleMobile()` from `useSidebar()`. TopBar needs to accept sidebar context — it's already `'use client'`.

3. **Sidebar** (`src/components/layout/Sidebar.tsx`) — Wrap current `<aside>` with responsive logic. On `md:` and up: current behavior (fixed, `z-40`, width from collapsed state). On mobile (`< md`): render as `fixed inset-y-0 left-0 z-50 w-60` with `transform transition-transform duration-300`. When `mobileOpen`: `translate-x-0`. When closed: `-translate-x-full`. Add a backdrop `<div>` sibling: `fixed inset-0 z-40 bg-black/50` visible only when `mobileOpen`, with `onClick={closeMobile}`. Always render sidebar at full 240px on mobile (no collapsed state on mobile).

4. **MainContent** (`src/components/layout/MainContent.tsx:14`) — Change template literal class from `${collapsed ? 'ml-16' : 'ml-60'}` to `${collapsed ? 'md:ml-16' : 'md:ml-60'}` (mobile gets `ml-0` by default since no `ml-*` utility without prefix).

5. **globals.css** — Add responsive media query to disable sidebar width transition on mobile. On mobile, sidebar uses transform (slide in/out), not width change. Add:
   ```css
   @media (max-width: 767px) {
     .sidebar-container {
       transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
     }
     .main-content-container {
       transition: none;
     }
   }
   ```

6. **Tests** — Update TopBar test for `px-3` (was `px-6`), `text-base` (was `text-lg`), hamburger button presence. Update Sidebar tests for mobile overlay behavior. Update MainContent tests for `md:ml-16`/`md:ml-60`.

**What Could Break:**
- Sidebar transition CSS needs coordination between desktop (width) and mobile (transform)
- `useSidebar` consumers need to handle new context values gracefully
- TopBar layout shift if hamburger button width isn't accounted for

**Done When:**
- [ ] TopBar has proper padding (`px-3 sm:px-6`) and text size (`text-base sm:text-lg`)
- [ ] Title truncates on overflow
- [ ] Hamburger button visible on mobile, hidden on desktop
- [ ] Sidebar hidden on mobile by default, slides in on hamburger click
- [ ] Backdrop closes sidebar on click
- [ ] MainContent has no left margin on mobile
- [ ] Desktop sidebar collapse still works unchanged
- [ ] All tests pass

## Chunk 2: Page-level responsive padding and text

**Goal:** Apply responsive padding and heading sizes across all page routes. Follow the pattern already established in DiscoveryContent (`p-4 sm:p-6`).

**Files:**
- Modify: `src/components/knowledge-bank/KnowledgeBankContent.tsx`
- Modify: `src/app/videos/[id]/page.tsx`
- Modify: `src/components/add-video/AddVideoPage.tsx`
- Modify: `src/components/add-transcript/AddTranscriptPage.tsx`
- Modify: `src/app/settings/page.tsx`

**Implementation Details:**

1. **KnowledgeBankContent** (line 220) — `p-6` → `p-4 sm:p-6`.

2. **Video detail page** (lines 103, 117, 134) — All three `p-6` containers → `p-4 sm:p-6`. Loading skeleton `w-96` (line 104) → `w-full max-w-96` to prevent horizontal overflow on narrow screens.

3. **AddVideoPage** (lines 277, 295) — `p-6` → `p-4 sm:p-6`. Page heading `text-2xl` → `text-xl sm:text-2xl`.

4. **AddTranscriptPage** — Same changes as AddVideoPage: `p-6` → `p-4 sm:p-6`, heading `text-2xl` → `text-xl sm:text-2xl`.

5. **Settings page** (line 11) — `p-6` → `p-4 sm:p-6`. Heading `text-2xl` → `text-xl sm:text-2xl`.

**What Could Break:**
- Minor visual density change on small screens — intentional
- Minimal risk — simple Tailwind class changes

**Done When:**
- [ ] All pages use `p-4 sm:p-6` instead of fixed `p-6`
- [ ] Page headings scale down on mobile (`text-xl sm:text-2xl`)
- [ ] No horizontal scroll on any page at 320px width
- [ ] Loading skeletons don't overflow
- [ ] All tests pass

## Chunk 3: Component-level responsive fixes

**Goal:** Fix responsive grids, tab overflow, and stat text in shared components.

**Files:**
- Modify: `src/components/videos/VideoGrid.tsx`
- Modify: `src/components/videos/__tests__/VideoGrid.test.tsx`
- Modify: `src/components/insights/InsightsTabs.tsx`
- Modify: `src/components/videos/StatsHeader.tsx`

**Implementation Details:**

1. **VideoGrid** (`src/components/videos/VideoGrid.tsx`) — Current: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. Add missing `sm:grid-cols-2` breakpoint for consistency with DiscoveryVideoGrid pattern (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`).

2. **InsightsTabs** (`src/components/insights/InsightsTabs.tsx`) — Check if tab labels overflow on mobile. If the tab list container doesn't scroll, add `overflow-x-auto` to the `TabsList` wrapper.

3. **StatsHeader** (`src/components/videos/StatsHeader.tsx`) — Already has `grid-cols-1 sm:grid-cols-3`. Verify the `text-3xl font-bold` stat values. If they overflow on very small screens, change to `text-2xl sm:text-3xl`.

4. **Tests** — Update VideoGrid test assertions for the new `sm:grid-cols-2` class.

**What Could Break:**
- Grid layout shift with new breakpoint — minor, intentional visual change
- Tab overflow handling if scroll indicators needed (defer if complex)

**Done When:**
- [ ] VideoGrid has `sm:grid-cols-2` breakpoint
- [ ] No tab overflow on mobile
- [ ] Stats display cleanly on small screens
- [ ] All tests pass
