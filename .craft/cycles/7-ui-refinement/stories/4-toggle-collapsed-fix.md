---
name: toggle-collapsed-fix
title: Fix toggle button cutoff in collapsed sidebar
status: complete
cycle: ui-refinement
story_number: 4
created: 2026-02-11
updated: 2026-02-11
priority: urgent
chunks_total: 1
chunks_complete: 1
---

# Story: Fix toggle button cutoff in collapsed sidebar

## Spark
The toggle button in SidebarLogo gets cut off when the sidebar is collapsed to 64px. The row has px-4 (32px padding) + icon (24px) + gap + button — doesn't fit. When collapsed, switch to flex-col layout with reduced padding so both icon and button stack and center properly.

## Chunks

### Chunk 1: Fix collapsed layout

**Status:** pending

**Goal:** Fix the SidebarLogo layout so the toggle button isn't cut off in collapsed state.

**Files:**
- `src/components/layout/SidebarLogo.tsx` — modify

**Implementation Details:**
- Change the container div classes to be conditional on `collapsed`:
  - Expanded: `flex items-center gap-2 px-4 py-5` (current)
  - Collapsed: `flex flex-col items-center gap-1 px-2 py-5` (stack vertically, less padding)
- This gives the pickaxe and chevron button room to stack within 64px

**Done When:**
- [ ] Toggle button fully visible in collapsed state
- [ ] Expanded state unchanged
