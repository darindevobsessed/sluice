---
name: video-detail-layout
title: Video Detail Page Layout Redesign
status: active
cycle: mvp
story_number: 6
created: 2026-02-04
updated: 2026-02-04
priority: medium
chunks_total: 2
chunks_complete: 0
---

# Story: Video Detail Page Layout Redesign

## Spark

Rearrange video detail page to side-by-side layout with video on left, content (title, metadata, tabs) on right. Smart tab default shows Insights if they exist, otherwise Transcript. Staggered slide-up entrance animations for polish.

## Layout

```
┌────────────────────────────────────────────────────────────┐
│ ← Knowledge Bank                                           │
├──────────────────────────┬─────────────────────────────────┤
│                          │  Video Title                    │
│    ┌──────────────┐      │  Channel • Date • Duration      │
│    │              │      ├─────────────────────────────────┤
│    │   Video      │      │ [Transcript] [Insights]         │
│    │   Player     │      ├─────────────────────────────────┤
│    │              │      │                                 │
│    └──────────────┘      │  Scrollable content area        │
│                          │  (transcript or insights)       │
│                          │                                 │
└──────────────────────────┴─────────────────────────────────┘
```

## Scope

**Included:**
- Rearranging video detail page to side-by-side layout
- Smart tab defaulting (Insights if available, Transcript otherwise)
- Adding `hasInsights` to video API response
- Responsive collapse for mobile (<1024px)
- Staggered slide-up entrance animations

**Excluded:**
- Sticky/floating video behavior on scroll
- Resizable panels
- Mini-player functionality
- Changes to Insights or Transcript content

## Preserve

- Timestamp click → video seek functionality
- Video player controls and aspect ratio
- Tab switching behavior
- All existing insights/transcript functionality
- Back button navigation

## Hardest Constraint

Getting the responsive breakpoint right — the side-by-side layout needs enough width for both video and content to be usable, otherwise it should collapse to vertical stack.

## Dependencies

**Blocked by:** None
**Blocks:** None

## Decisions

### Page Layout
**Type:** layout
**Choice:** sidebar

### Tab Default Behavior
**Type:** component
**Choice:** smart-default (Insights if available, Transcript otherwise)

### Content Density
**Type:** density
**Choice:** comfortable

### Responsive Behavior
**Type:** layout
**Choice:** stack (collapses to vertical on mobile <1024px)

### Entrance Animation
**Type:** component
**Choice:** staggered-slide-up (100ms stagger between sections)

## Visual Direction

**Vibe:** Productive Workspace
**Feel:** Focused, clean, purposeful
**Inspiration:** Documentation sites, video learning platforms (Coursera, YouTube theater mode)
**Key tokens:** radius-lg, comfortable spacing, subtle shadows on video

## Acceptance

- [ ] Side-by-side layout on desktop (≥1024px)
- [ ] Collapses to vertical stack on mobile (<1024px)
- [ ] Video player positioned on left, fills column width
- [ ] Content area (title, metadata, tabs) on right
- [ ] API returns `hasInsights` boolean with video data
- [ ] Default tab is Insights if insights exist for video
- [ ] Default tab is Transcript if no insights generated yet
- [ ] Timestamp clicks in transcript still seek video correctly
- [ ] Staggered slide-up animation on page load (0ms → 100ms → 150ms → 200ms → 250ms)
- [ ] Animations feel smooth, no layout shift or jank
- [ ] All existing functionality preserved
- [ ] Back button still works

## Chunks

### Chunk 1: Side-by-Side Layout + Smart Tab Default

**Goal:** Restructure page to side-by-side layout with video left, content right. API returns `hasInsights` for instant tab defaulting.

**Files:**
- `src/app/api/videos/[id]/route.ts` — modify (add hasInsights check)
- `src/app/videos/[id]/page.tsx` — modify (restructure layout, pass defaultTab)
- `src/components/videos/VideoPlayer.tsx` — modify (remove max-width constraint)
- `src/components/insights/InsightsTabs.tsx` — modify (accept defaultTab prop)

**Implementation Details:**

**1. API change (`route.ts`):**
```typescript
import { getExtractionForVideo } from '@/lib/db/insights';

// After fetching video, check for insights
const hasInsights = !!(await getExtractionForVideo(videoId));

return NextResponse.json({
  video,
  hasInsights,
});
```

**2. Page layout (`page.tsx`):**
```tsx
// Replace vertical stack with:
<div className="flex flex-col lg:flex-row gap-8">
  {/* Left: Video player */}
  <div className="lg:w-1/2 xl:w-2/5 lg:sticky lg:top-6 lg:self-start">
    <VideoPlayer youtubeId={video.youtubeId} seekTime={seekTime} />
  </div>

  {/* Right: Title, metadata, tabs */}
  <div className="flex-1 min-w-0">
    <h1 className="mb-4 text-3xl font-semibold">{video.title}</h1>
    <VideoMetadata video={video} className="mb-6" />
    <InsightsTabs
      video={video}
      onSeek={handleSeek}
      defaultTab={hasInsights ? 'insights' : 'transcript'}
    />
  </div>
</div>
```

**3. VideoPlayer (`VideoPlayer.tsx`):**
- Remove `max-w-[800px]` and `mx-auto` — let container control width
- Keep aspect ratio and rounded corners

**4. InsightsTabs (`InsightsTabs.tsx`):**
```tsx
interface InsightsTabsProps {
  video: Video;
  onSeek: (seconds: number) => void;
  defaultTab?: 'transcript' | 'insights';  // NEW
  className?: string;
}

// Use in Tabs component:
<Tabs defaultValue={defaultTab ?? 'transcript'} className={className}>
```

**5. Update page state to track hasInsights:**
- Add `hasInsights` to state
- Update fetch response handling

**Responsive behavior:**
- `lg:` breakpoint (1024px) — side-by-side
- Below 1024px — vertical stack (current behavior)
- Video sticky on desktop so it stays visible while scrolling content

**What Could Break:**
- VideoPlayer sizing — verify aspect ratio maintained without max-width
- Sticky positioning — test scroll behavior

**Done When:**
- [ ] Side-by-side layout on desktop (≥1024px)
- [ ] Vertical stack on mobile (<1024px)
- [ ] Video player fills its column without overflow
- [ ] API returns `hasInsights` boolean
- [ ] Insights tab opens by default when insights exist
- [ ] Transcript tab opens by default when no insights
- [ ] Timestamp clicks still work
- [ ] Back button still works

---

### Chunk 2: Staggered Entrance Animations

**Goal:** Add smooth slide-up entrance animations with staggered timing.

**Files:**
- `src/app/videos/[id]/page.tsx` — modify (add animation classes)
- `src/app/globals.css` — modify (add animation delay utilities if needed)

**Implementation Details:**

**Animation classes using tw-animate-css:**
```tsx
{/* Left panel - video */}
<div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out
               lg:w-1/2 xl:w-2/5 ...">

{/* Right panel - content */}
<div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out
               [animation-delay:100ms] fill-mode-backwards flex-1 ...">

  {/* Title */}
  <h1 className="animate-in fade-in slide-in-from-bottom-2 duration-400 ease-out
                 [animation-delay:150ms] fill-mode-backwards ...">

  {/* Metadata */}
  <VideoMetadata className="animate-in fade-in slide-in-from-bottom-2 duration-400
                            [animation-delay:200ms] fill-mode-backwards ..." />

  {/* Tabs */}
  <InsightsTabs className="animate-in fade-in slide-in-from-bottom-2 duration-400
                           [animation-delay:250ms] fill-mode-backwards ..." />
</div>
```

**Timing sequence:**
| Element | Delay | Duration |
|---------|-------|----------|
| Video panel | 0ms | 500ms |
| Content panel | 100ms | 500ms |
| Title | 150ms | 400ms |
| Metadata | 200ms | 400ms |
| Tabs | 250ms | 400ms |

**Total animation time:** ~650ms (last element starts at 250ms + 400ms duration)

**CSS addition if needed (globals.css):**
```css
/* Animation fill mode for staggered animations */
.fill-mode-backwards {
  animation-fill-mode: backwards;
}
```

**What Could Break:**
- Animation timing feels off — adjust delays during testing
- Layout shift during animation — use fill-mode-backwards

**Done When:**
- [ ] Video panel slides up first (0ms)
- [ ] Content panel slides up second (100ms)
- [ ] Title, metadata, tabs cascade in sequence
- [ ] No layout shift or jank
- [ ] Feels smooth and intentional
- [ ] Works on both desktop (side-by-side) and mobile (stacked)

## Notes

- Uses existing tw-animate-css library for animations
- Smart tab default prevents flash by including `hasInsights` in API response
- Sticky video on desktop keeps it visible while scrolling long transcripts
- Animation timing designed for quick "1-2-3" rhythm without feeling slow
