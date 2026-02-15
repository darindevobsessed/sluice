---
name: fix-mobile-sidebar-auto-close
title: Fix mobile sidebar not auto-closing on nav link click
status: active
cycle: hotfix
story_number: 6
created: 2026-02-15
updated: 2026-02-15
priority: high
chunks_total: 1
chunks_complete: 0
current_chunk: 1
---

# Story: Fix mobile sidebar not auto-closing on nav link click

## Spark
When the mobile sidebar is open and a user taps a navigation link, the sidebar stays open — requiring a manual backdrop tap to close. The sidebar should auto-close on navigation. One-line fix: add closeMobile() call to SidebarNav link onClick.

## Delivery
Chunk 1 adds closeMobile() from useSidebar() to both Link onClick handlers in SidebarNav, so tapping a nav link on mobile automatically closes the sidebar overlay. Desktop behavior is unaffected since closeMobile is a no-op when the mobile sidebar isn't open.

## Scope
**Included:**
- Add closeMobile() to SidebarNav link onClick handlers
- Test coverage for the new behavior

**Excluded:**
- Any other sidebar changes
- Desktop behavior changes

## Chunk 1: Add closeMobile to SidebarNav link clicks

**Goal:** Make the mobile sidebar auto-close when any navigation link is clicked.

**Files:**
- Modify: `src/components/layout/SidebarNav.tsx`
- Modify: `src/components/layout/__tests__/SidebarNav.test.tsx`

**Implementation Details:**

1. **SidebarNav.tsx** (line 20) — Change `const { collapsed } = useSidebar()` to `const { collapsed, closeMobile } = useSidebar()`. Add `onClick={closeMobile}` to both Link components (collapsed tooltip link at line 32 and expanded link at line 52). `closeMobile` sets `mobileOpen = false` in SidebarProvider — it's a no-op on desktop since mobileOpen is already false.

2. **SidebarNav.test.tsx** — Add test: "calls closeMobile when nav link is clicked". Mock `useSidebar` to return `closeMobile` as a `vi.fn()`, render nav, click a link, assert `closeMobile` was called.

**Done When:**
- [ ] Both Link components have `onClick={closeMobile}`
- [ ] closeMobile is destructured from useSidebar
- [ ] Test verifies closeMobile is called on link click
- [ ] All existing tests still pass
