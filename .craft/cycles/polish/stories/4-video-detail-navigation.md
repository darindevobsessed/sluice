---
name: video-detail-navigation
title: Navigate to Video Detail After Adding
status: in-progress
priority: low
created: 2026-02-09
updated: 2026-02-09
chunks_total: 1
chunks_complete: 1
---

# Story: Navigate to Video Detail After Adding

## Spark
When a video is first added to the Knowledge Bank, navigate directly to that video's detail page instead of the generic list view. This provides immediate access to insights and a more focused experience.

## Scope

**Included:**
- Update success state to navigate to video detail page using created video ID
- Modify SuccessState component to accept video ID and link appropriately
- Preserve "Add Another" button functionality

**Excluded:**
- Changes to video detail page layout or functionality
- Modifications to the Knowledge Bank list page
- Changes to the add video form or submission process

## Preserve
- Current success message and visual design
- "Add Another" button that resets the form
- Error handling and validation flow
- All existing add video functionality

## Hardest Constraint
The video ID must be captured from the API response and passed through the component tree correctly to enable proper navigation.

## Dependencies
**Blocked by:** None
**Blocks:** None

## Decisions

### Navigation Target
**Type:** navigation
**Choice:** Navigate to `/videos/{id}` instead of `/` (Knowledge Bank list) after successful video addition.

### Fallback Behavior
**Type:** defensive
**Choice:** If video ID is not available for any reason, fall back to current behavior (Knowledge Bank list).

## Visual Direction
**Vibe:** Focused, direct access to new content
**Feel:** Efficient workflow, immediate gratification
**Inspiration:** YouTube's "Video uploaded" → view video flow

## Acceptance
- [x] Given a video is successfully added, when viewing the success state, then the primary action navigates to the video detail page
- [x] Given navigation to video detail, when the page loads, then all video content and insights are accessible
- [x] Given the success state, when clicking "Add Another", then the form resets as before
- [x] Given a missing video ID (error case), when in success state, then navigation falls back to Knowledge Bank list

## Definition of Done
- [x] All chunks complete
- [x] All acceptance criteria verified
- [x] No regressions in add video flow
- [x] Success state button text updated to reflect new destination

## Chunks

### Chunk 1: Update Navigation in Success State

**Goal:** Modify AddVideoPage and SuccessState components to capture video ID from API response and navigate to video detail page.

**Files:**
- `src/components/add-video/AddVideoPage.tsx` — modify (capture video ID, pass to SuccessState)
- `src/components/add-video/SuccessState.tsx` — modify (accept video ID, update navigation)

**Implementation Details:**
- Add `createdVideoId` state to AddVideoPage to store the video ID from API response
- Extract video ID from successful POST `/api/videos` response: `data.video.id`
- Pass `videoId` prop to SuccessState component
- Update SuccessState to accept optional `videoId?: number | null` prop
- When `videoId` is present, link to `/videos/${videoId}` instead of `/`
- Update button text from "View in Knowledge Bank" to "View Video Details"
- Maintain fallback behavior: if no `videoId`, use original behavior (link to `/`)
- Reset `createdVideoId` in form reset handler

**What Could Break:**
- API response structure changes (video.id field missing or different type)
- Video detail page not handling newly created videos correctly

**Done When:**
- [x] Video ID captured from API response and stored in component state
- [x] SuccessState component accepts videoId prop
- [x] Primary button links to video detail page when video ID available
- [x] Button text updates to "View Video Details" for video ID navigation
- [x] Fallback navigation works when video ID is missing
- [x] Form reset clears video ID state
- [x] "Add Another" button continues to work as expected

## Notes
This story implements a simple but impactful UX improvement. The change is minimal and focuses purely on navigation after successful video addition. The video ID is already available in the API response, so no backend changes are needed.

Key files:
- `src/components/add-video/AddVideoPage.tsx` — capture video ID from API response
- `src/components/add-video/SuccessState.tsx` — accept video ID and update navigation

The implementation preserves all existing functionality while providing a more direct path to the newly added video's insights.