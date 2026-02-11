---
name: sidebar-toggle-placement
title: Move sidebar toggle to header area (Linear-style)
status: active
cycle: ui-refinement
story_number: 3
created: 2026-02-11
updated: 2026-02-11
priority: high
chunks_total: 1
chunks_complete: 0
---

# Story: Move sidebar toggle to header area (Linear-style)

## Spark
The sidebar collapse toggle is currently at the bottom of the sidebar (`mt-auto`). This isn't industry standard — Linear places it in the header row, right-aligned next to the workspace name. Move the toggle from the bottom of `Sidebar.tsx` into the `SidebarLogo` header area.

## Chunks

### Chunk 1: Move toggle button to header

**Status:** pending

**Goal:** Move the chevron toggle from the bottom of Sidebar into the SidebarLogo header row, right-aligned.

**Files:**
- `src/components/layout/SidebarLogo.tsx` — modify (add toggle button to header row)
- `src/components/layout/Sidebar.tsx` — modify (remove toggle button from bottom)
- `src/components/layout/__tests__/Sidebar.test.tsx` — modify (update toggle button expectations)

**Implementation Details:**
- In `SidebarLogo.tsx`:
  - Import `ChevronLeft`, `ChevronRight` from lucide-react
  - Import `useSidebar` from `@/components/providers/SidebarProvider`
  - Import `Button` from `@/components/ui/button`
  - Call `const { toggleSidebar } = useSidebar()`
  - Add `flex-1` to the "Gold Miner" span so the button pushes right
  - Add the `Button` with chevron icon after the span, with `shrink-0` class
  - When collapsed, button sits next to the pickaxe icon (no text between them)
- In `Sidebar.tsx`:
  - Remove the entire `<div className="mt-auto ...">` block at lines 23-37
  - Remove `ChevronLeft`, `ChevronRight` imports
  - Remove `Button` import
  - Keep `useSidebar` import (still needed for `collapsed` state)
- In test file:
  - Update any assertions that look for the toggle button location

**Done When:**
- [ ] Toggle button appears in the header row, right-aligned next to logo/name
- [ ] Toggle button works correctly (collapse/expand)
- [ ] No toggle button at the bottom of the sidebar
- [ ] Works in both collapsed and expanded states
