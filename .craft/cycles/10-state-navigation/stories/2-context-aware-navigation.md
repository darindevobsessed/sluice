---
name: context-aware-navigation
title: "Context-Aware Navigation"
status: active
priority: high
created: 2026-02-13
updated: 2026-02-13
cycle: state-navigation
story_number: 2
chunks_total: 3
chunks_complete: 1
current_chunk: 2
---

# Story: Context-Aware Navigation

## Spark
Navigation flows become contextual — the app remembers where you came from. When adding a video from Discovery, the success state offers "Back to Discovery" (with filters intact) instead of only "Browse Knowledge Bank." Video detail's back button returns to the originating page, not always `/`. Uses a `returnTo` URL parameter passed through navigation chains. Covers both Add Video and Add Transcript flows.

## Key Flows
- Discovery (filtered) → "Add to KB" → `/add?url=...&returnTo=/discovery?channel=abc&type=not-saved` → Success → "Back to Discovery" with filters
- Discovery → Video detail → `/videos/123?returnTo=/discovery?channel=abc` → back → Discovery with filters
- KB (searching) → Video detail → `/videos/123?returnTo=/?q=react&type=youtube` → back → KB with search/filters
- Add Transcript flow also supports returnTo

## Implementation Notes
- `returnTo` param for all contextual navigation (explicit, survives refresh)
- Fallback to `/` when no `returnTo` present (direct navigation, bookmarks)
- Success state labels are contextual: "Back to Discovery" vs "Browse Knowledge Bank" based on returnTo origin

## Dependencies
**Blocked by:** 1-url-filter-state
**Blocks:** none

## Decisions
- Use `encodeURIComponent`/`decodeURIComponent` for returnTo values (handles nested query params)
- Validate returnTo starts with `/` to prevent open redirects
- returnTo is read-only from URL — no state management needed
- SuccessState gets `returnTo` prop, contextual label derived via `getReturnLabel()` utility

## Acceptance
- [ ] Discovery → Add → Success shows "Back to Discovery" with filters intact
- [ ] KB (with search) → Video detail back button returns to KB with search/filters
- [ ] Direct navigation (no returnTo) falls back to default behavior
- [ ] Add Transcript flow supports returnTo identically to Add Video
- [ ] Open redirect prevention: external URLs in returnTo are rejected
- [ ] All existing tests continue to pass

## Chunks

### Chunk 1: returnTo Utility + SuccessState Context

**Goal:** Create the core navigation utility and update SuccessState to render contextual "back" labels.

**Files:**
- `src/lib/navigation.ts` — create
- `src/lib/__tests__/navigation.test.ts` — create (TDD: tests first)
- `src/components/add-video/SuccessState.tsx` — modify (add `returnTo` prop, contextual label)
- `src/components/add-video/__tests__/SuccessState.test.tsx` — modify (add returnTo tests)

**Implementation Details:**
- **`src/lib/navigation.ts`** — three functions:
  - `buildReturnTo(pathname: string, searchParams: URLSearchParams): string` — constructs a returnTo value by combining `pathname` + `?` + `searchParams.toString()`, then `encodeURIComponent()` the whole thing. Returns empty string if pathname is `/` with no params (no point returning to bare KB).
  - `parseReturnTo(returnTo: string | null): string | null` — `decodeURIComponent()`, validate it starts with `/` (prevent open redirects), return null if invalid.
  - `getReturnLabel(returnTo: string | null): { href: string; label: string }` — maps decoded returnTo to contextual labels: `/discovery*` → "Back to Discovery", `/*` with params → "Back to Knowledge Bank", default → "Browse Knowledge Bank". Returns `{ href, label }`.
- **`SuccessState.tsx`** — add optional `returnTo?: string | null` prop (line 6-18 interface). At line 109, replace hardcoded `<Link href="/">` with:
  ```tsx
  const { href: returnHref, label: returnLabel } = getReturnLabel(returnTo)
  // ...
  <Link href={returnHref}>
    <p className="font-medium">{returnLabel}</p>
  ```
  Keep the Search icon. Only the text and href change.
- **Tests first:** Write `navigation.test.ts` covering encoding round-trips (Discovery with `channel=abc&type=not-saved`), KB with search (`q=react&type=youtube`), bare `/`, malformed input, open redirect prevention (`https://evil.com` → null). Then SuccessState tests: verify "Back to Discovery" when `returnTo` contains `/discovery`, verify "Browse Knowledge Bank" when no returnTo.

**What Could Break:**
- Double-encoding: `encodeURIComponent` applied twice would break URLs. Tests catch this.
- SuccessState prop backward compatibility: `returnTo` is optional, defaults to null → existing behavior preserved.

**Done When:**
- [ ] `buildReturnTo` + `parseReturnTo` + `getReturnLabel` pass all unit tests
- [ ] Open redirect prevention: external URLs return null
- [ ] SuccessState shows "Back to Discovery" with returnTo containing `/discovery`
- [ ] SuccessState shows "Browse Knowledge Bank" with no returnTo (backward compat)

### Chunk 2: Add Flows + Discovery Origin Links

**Goal:** Wire returnTo through the Add Video and Add Transcript flows, and add returnTo to Discovery's "Add to Bank" links.

**Files:**
- `src/components/add-video/AddVideoPage.tsx` — modify (read `returnTo` from URL, pass to SuccessState)
- `src/components/add-transcript/AddTranscriptPage.tsx` — modify (read `returnTo` from URL, pass to SuccessState)
- `src/components/discovery/DiscoveryVideoCard.tsx` — modify (add returnTo to addUrl)
- `src/components/discovery/DiscoveryContent.tsx` — modify (compute returnTo, pass to DiscoveryVideoCard)
- `src/components/add-video/__tests__/AddVideoPage.test.tsx` — modify (add returnTo tests)
- `src/components/add-transcript/__tests__/AddTranscriptPage.test.tsx` — modify (add returnTo tests)

**Implementation Details:**
- **AddVideoPage.tsx** — at line 23 where `const searchParams = useSearchParams()`, also read `returnTo`: `const returnTo = searchParams.get('returnTo')`. Pass to SuccessState at line 280: `<SuccessState ... returnTo={returnTo} />`. No state needed — returnTo is read-only from URL.
- **AddTranscriptPage.tsx** — currently has no URL param reading. Add `import { useSearchParams } from 'next/navigation'`, then `const searchParams = useSearchParams()` and `const returnTo = searchParams.get('returnTo')`. Pass to SuccessState at line 88: `<SuccessState ... returnTo={returnTo} />`.
- **DiscoveryVideoCard.tsx** — at line 32, change addUrl construction. Accept new prop `returnTo?: string` from parent. If present, append `&returnTo=${returnTo}` to the addUrl.
- **DiscoveryContent.tsx** — compute returnTo via `buildReturnTo('/discovery', searchParams)` using the existing `useURLParams()` at line 49. Pass to each DiscoveryVideoCard as prop.
- **Tests:** Follow existing pattern in `AddVideoPage.test.tsx:393-422` — use `mockSearchParams.set('returnTo', encodeURIComponent('/discovery?channel=abc'))`, render, submit, verify SuccessState shows "Back to Discovery". Similar for AddTranscript.

**What Could Break:**
- DiscoveryVideoCard prop change — need to update all usages. Currently only used in `DiscoveryContent.tsx`.
- AddTranscriptPage adding `useSearchParams` might need Suspense boundary — check if the parent page already wraps in Suspense.

**Done When:**
- [ ] Clicking "Add to Bank" from Discovery includes `?returnTo=` with encoded discovery URL
- [ ] Add Video success shows "Back to Discovery" when returnTo present
- [ ] Add Transcript success shows "Back to Discovery" when returnTo present
- [ ] Both flows show "Browse Knowledge Bank" when accessed directly (no returnTo)

### Chunk 3: Video Detail Back Nav + KB Origin Links

**Goal:** Video detail page reads `returnTo` for its back button, and KB/Discovery video cards include returnTo in their detail links.

**Files:**
- `src/app/videos/[id]/page.tsx` — modify (read `returnTo` for backHref/backLabel)
- `src/components/videos/VideoCard.tsx` — modify (add `returnTo` to detail link)
- `src/components/knowledge-bank/KnowledgeBankContent.tsx` — modify (compute returnTo, pass to VideoCard)
- `src/components/discovery/DiscoveryVideoCard.tsx` — modify (add returnTo to detail link if applicable)

**Implementation Details:**
- **Video detail page** (`src/app/videos/[id]/page.tsx`) — at lines 70-85 where `setPageTitle` is called. Add `useSearchParams` to read `returnTo`. Use `parseReturnTo()` to validate:
  ```tsx
  const searchParams = useSearchParams()
  const returnTo = parseReturnTo(searchParams.get('returnTo'))
  const backHref = returnTo || '/'
  const backLabel = returnTo?.startsWith('/discovery') ? 'Discovery' : 'Knowledge Bank'
  setPageTitle({ title: video.title, backHref, backLabel })
  ```
  Also update the error state back button at line 114.
- **VideoCard.tsx** — at line 67 `<Link href={/videos/${video.id}}>`, accept optional `returnTo?: string` prop. If present, append `?returnTo=${returnTo}` to the link.
- **KnowledgeBankContent.tsx** — compute returnTo via `buildReturnTo('/', searchParams)` using the existing `useURLParams()` at line 46. Pass to VideoCard as prop. Only pass when there are active filters (`searchParams.toString()` is non-empty).
- **DiscoveryVideoCard.tsx** — if the card links to video detail (title link), add returnTo there too.

**What Could Break:**
- VideoCard prop addition — used in multiple places (KB, possibly search results). Need to check all usages.
- `useSearchParams` in video detail page may need Suspense wrapping — check the layout.

**Done When:**
- [ ] KB (with search `?q=react`) → video detail shows "Back to Knowledge Bank"
- [ ] Discovery → video detail shows "Back to Discovery"
- [ ] Direct navigation to video detail shows "Knowledge Bank" (default)
- [ ] Back button navigates to the correct page with filters intact
- [ ] All existing tests pass
