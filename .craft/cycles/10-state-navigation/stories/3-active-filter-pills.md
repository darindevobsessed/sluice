---
name: active-filter-pills
title: "Active Filter Pills"
status: planning
priority: medium
created: 2026-02-13
updated: 2026-02-13
cycle: state-navigation
story_number: 3
chunks_total: 0
chunks_complete: 0
current_chunk: 0
---

# Story: Active Filter Pills

## Spark
A shared filter pill bar component that renders active filters as dismissible pills (`[Label: Value ×]`). Used on both Discovery (channel, content type) and Knowledge Bank (content type, search query). Shows a "Clear all" option when 2+ filters are active. Sits between the page header/controls and the content grid. Dismissing a pill updates the URL params, which updates the filtered results. When no filters are active, the pill bar is hidden (zero height, no layout shift).

## Examples
- Discovery: `[Creator: Fireship ×]` `[Status: Not Saved ×]` `Clear all`
- KB: `[Type: YouTube ×]` `[Search: "react hooks" ×]`

## Implementation Notes
- Focus Area NOT shown as pill (already visible in top bar, global setting)
- Shared component, page-specific filter config passed as props
- Pills read from and write to URL searchParams (from Story 1)

## Dependencies
**Blocked by:** 1-url-filter-state
**Blocks:** none

## Acceptance
<!-- Detailed criteria added via plan-chunks -->

## Chunks
<!-- Detailed chunks added via plan-chunks -->
