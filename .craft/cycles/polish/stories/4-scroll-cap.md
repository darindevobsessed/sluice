---
name: transcript-scroll-cap
title: Cap Transcript Textarea Height with Inner Scroll
status: complete
cycle: polish
story_number: 4
created: 2026-02-09
updated: 2026-02-09
priority: high
chunks_total: 1
chunks_complete: 1
---

# Story: Cap Transcript Textarea Height with Inner Scroll

## Spark
When adding a video with a large transcript, the textarea grows unbounded pushing tags, notes, and the submit button way off screen. Cap the textarea height so it grows naturally for short content but scrolls internally for long transcripts.

## Scope

**Included:**
- Add `max-h-[500px] overflow-y-auto` to the transcript Textarea in `TranscriptSection.tsx`

**Excluded:**
- No changes to the base `Textarea` component (transcript-specific fix)
- No collapsible/preview states
- No changes to other textareas in the form

## Preserve
- `field-sizing-content` auto-grow behavior for short content
- All existing transcript fetch/edit functionality
- Character count display below textarea

## Hardest Constraint
Ensuring `field-sizing-content` and `max-h` interact correctly across browsers — the textarea should grow naturally until it hits the cap, then scroll.

## Technical Concerns
- `field-sizing-content` is a newer CSS property; its interaction with `max-height` is well-defined in spec but worth a quick browser check

## Recommendations
- Keep the fix to a single class change on the Textarea in TranscriptSection.tsx
- Don't modify the shared base Textarea component

## Dependencies
**Blocked by:** None
**Blocks:** None

## Decisions

### Transcript Container
**Type:** component
**Choice:** inline

### Content Overflow
**Type:** layout
**Choice:** grow-to-cap (field-sizing-content + max-h-[500px] overflow-y-auto)

## Acceptance
- [ ] Given a short transcript (<20 lines), the textarea grows naturally to fit content
- [ ] Given a long transcript (thousands of lines), the textarea caps at ~500px and scrolls internally
- [ ] Given the textarea is capped, the tags, notes, and submit button remain visible without excessive scrolling
- [ ] Given the textarea is scrolling, the character count below still updates correctly

## Chunks

### Chunk 1: Add max-height and overflow scroll to transcript textarea

**Goal:** Cap the transcript textarea at 500px and enable inner scrolling for long content.

**Files:**
- `src/components/add-video/TranscriptSection.tsx` — modify (add `max-h-[500px] overflow-y-auto` to Textarea className)
- `src/components/add-video/__tests__/TranscriptSection.test.tsx` — create (test that textarea has correct classes)

**Criteria:**
- Textarea className includes `max-h-[500px]` and `overflow-y-auto`
- Existing `min-h-[300px]` preserved
- Existing `text-base leading-relaxed` preserved
- Test verifies the textarea renders with expected classes

## Notes
Single CSS change — add max-h-[500px] and overflow-y-auto to the Textarea className in TranscriptSection.tsx.
