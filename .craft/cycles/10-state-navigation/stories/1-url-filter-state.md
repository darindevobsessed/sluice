---
name: url-filter-state
title: "URL Filter State"
status: complete
priority: high
created: 2026-02-13
updated: 2026-02-13
cycle: state-navigation
story_number: 1
chunks_total: 3
chunks_complete: 3
current_chunk: 4
---

# Story: URL Filter State

## Spark
Move filter state from local React state to URL searchParams on both Discovery and Knowledge Bank pages. Discovery encodes channel, content type, and page number (`?channel=`, `?type=`, `?page=`). Knowledge Bank encodes content type and search query (`?q=`, `?type=`). Pages read from URL on mount, and filter changes update the URL. Browser back/forward restores filter state naturally. This is the foundation that makes all other navigation improvements work.

## Implementation Notes
- Use `router.replace()` when filters change (avoid polluting history with every dropdown selection)
- Use `router.push()` for pagination changes (page navigation should be back-navigable)
- Focus Area stays in localStorage (app-wide global, not page-specific)
- Absence of param = default value (no `?type=` = 'all', no `?page=` = page 1)
- Filter changes reset page to 1 (remove `?page=` from URL)
- Invalid params fall back to defaults silently
- useSearch refactored: accepts query as prop, drops internal debounce (VideoSearch handles it)

## Dependencies
**Blocked by:** none
**Blocks:** 2-context-aware-navigation, 3-active-filter-pills

## Acceptance
- [ ] Discovery: channel filter reads from and writes to `?channel=` URL param
- [ ] Discovery: content type filter reads from and writes to `?type=` URL param
- [ ] Discovery: pagination reads from `?page=` and writes via `router.push()`
- [ ] Discovery: filter changes reset page to 1
- [ ] KB: search query reads from and writes to `?q=` URL param
- [ ] KB: content type filter reads from and writes to `?type=` URL param
- [ ] KB: search input initializes from URL and syncs on browser back/forward
- [ ] Both: default state (no params) shows all content with no filters active
- [ ] Both: clean URLs — default values omitted from URL
- [ ] Both: invalid params fall back to defaults (no crash, no error)
- [ ] Both: browser back/forward restores filter state
- [ ] Double-debounce fixed: ~300ms perceived delay on KB search

## Chunks

### Chunk 1: Discovery URL State

**Goal:** Migrate Discovery's channel filter, content type filter, and pagination from local state to URL searchParams. Create a shared `useURLParams` utility hook.

**Files:**
- `src/hooks/useURLParams.ts` — create
- `src/app/discovery/page.tsx` — modify (replace useState with URL reads, add update handlers)
- `src/components/discovery/DiscoveryVideoGrid.tsx` — modify (lift pagination state out, accept props)
- `src/app/discovery/__tests__/page.test.tsx` — modify (mock useSearchParams, test URL behavior)

**Implementation Details:**

New hook `src/hooks/useURLParams.ts`:
- Import `useSearchParams`, `useRouter`, `usePathname` from `next/navigation`
- Export `useURLParams()` returning `{ searchParams, updateParams }`
- `updateParams(updates: Record<string, string | null>, method: 'replace' | 'push' = 'replace')`:
  - Creates new `URLSearchParams` from current `searchParams.toString()`
  - Iterates `updates`: if value is null/empty, delete key; else set key=value
  - Constructs URL: `qs ? \`${pathname}?${qs}\` : pathname`
  - Calls `router[method](url)`

Discovery page — replace local state:
- Remove: `useState<string | null>(null)` for `selectedChannelId`, `useState<ContentTypeValue>('all')` for `contentType`
- Add: `const { searchParams, updateParams } = useURLParams()`
- Read: `selectedChannelId = searchParams.get('channel') || null`
- Read: `contentType = (searchParams.get('type') as ContentTypeValue) || 'all'`
- Read: `currentPage = Number(searchParams.get('page')) || 1`
- Channel change handler: `updateParams({ channel: channelId, page: null })` — resets page
- Type change handler: `updateParams({ type: value === 'all' ? null : value, page: null })` — resets page
- Page change handler: `updateParams({ page: page <= 1 ? null : String(page) }, 'push')` — uses push

DiscoveryVideoGrid refactor:
- Remove internal `useState<{ page: number; videosKey: string }>` (~line 32)
- Remove videosKey useEffect that resets page (~lines 34-38)
- Add props: `currentPage: number` and `onPageChange: (page: number) => void`
- Pagination component reads `currentPage` from props, calls `onPageChange` on click
- Remove internal page-related logic — parent owns page state via URL
- Keep all rendering logic (grid layout, card rendering, empty state)

Tests:
- Mock `useSearchParams` returning `new URLSearchParams('channel=abc&type=saved&page=2')` — verify filters applied
- Test filter change: verify `router.replace` called with updated params and `page` removed
- Test page change: verify `router.push` called with new page param
- Test defaults: empty searchParams → all channels, type 'all', page 1

**What Could Break:**
- DiscoveryVideoGrid's `totalPages` calculation — verify it works when `currentPage` comes from props
- Existing tests that don't mock `useSearchParams` — add to existing `next/navigation` mock

**Done When:**
- [ ] Channel filter reads from and writes to `?channel=` URL param
- [ ] Content type filter reads from and writes to `?type=` URL param
- [ ] Pagination reads from `?page=` and writes via `router.push()`
- [ ] Filter changes reset page to 1 (remove `?page=` from URL)
- [ ] Default state (no params) shows all channels, type all, page 1
- [ ] Clean URLs: default values omitted (no `?type=all` or `?page=1`)
- [ ] Tests pass with URL param mocking

---

### Chunk 2: Knowledge Bank URL State

**Goal:** Migrate KB's search query to `?q=` and content type to `?type=` URL params. Refactor `useSearch` to accept query as a prop. Fix double-debounce.

**Files:**
- `src/app/page.tsx` — modify (read `?q=` and `?type=` from URL, pass query to useSearch)
- `src/hooks/useSearch.ts` — modify (accept query as prop, drop internal query state + debounce)
- `src/components/videos/VideoSearch.tsx` — modify (add defaultValue prop, sync on external changes)
- `src/hooks/__tests__/useSearch.test.ts` — modify (update for new API)
- `src/app/__tests__/page.test.tsx` — modify (mock useSearchParams)

**Implementation Details:**

useSearch refactor — change interface from `{ focusAreaId }` to `{ query, focusAreaId }`:
- Remove: internal `const [query, setQuery] = useState('')` (~line 31)
- Remove: internal `setTimeout` debounce logic
- Add: accept `query: string` as parameter
- Keep: `AbortController` pattern for canceling stale requests
- Keep: `mode` state and `setMode`
- Fire API call via useEffect when `query` changes (immediate, no debounce — debounce handled upstream by VideoSearch)
- Return: `{ results, isLoading, error, mode, setMode }` — no longer returns `query`/`setQuery`

KB page — wire URL params:
- Add: `const { searchParams, updateParams } = useURLParams()`
- Read: `const urlQuery = searchParams.get('q') || ''`
- Read: `const contentType = (searchParams.get('type') as KBContentTypeValue) || 'all'`
- Change: `useSearch({ query: urlQuery, focusAreaId: selectedFocusAreaId })`
- Search handler: `const handleSearch = (q: string) => updateParams({ q: q || null })`
- Type handler: `const handleTypeChange = (type: string) => updateParams({ type: type === 'all' ? null : type })`
- Remove: local `contentType` useState
- Verify: `isQueryQuestion` logic still works — now checks `urlQuery` instead of `query` from useSearch

VideoSearch — add URL sync:
- Add `defaultValue?: string` prop
- Initialize: `const [value, setValue] = useState(defaultValue || '')`
- Add sync effect for browser back/forward:
  ```
  useEffect(() => {
    if (defaultValue !== undefined) setValue(defaultValue)
  }, [defaultValue])
  ```
- Existing debounce + `onSearch` callback behavior unchanged

Tests — useSearch:
- Update to pass `query` as parameter instead of using returned `setQuery`
- Remove debounce timing tests (debounce removed from hook)
- Keep AbortController cancellation tests
- Test: empty query → no API call, non-empty query → API call

Tests — KB page:
- Add `useSearchParams` to `next/navigation` mock
- Test: `?q=react` → search results shown with query 'react'
- Test: `?type=youtube` → content type filter set to youtube

**What Could Break:**
- Any code calling `setQuery` from useSearch — verified only used in page.tsx
- VideoSearch's `defaultValue` sync effect during typing — safe because during typing, defaultValue only changes after VideoSearch's own debounce fires and writes to URL, by which point internal state already matches
- Question detection (`isQueryQuestion`) — verify it reads from `urlQuery` in page.tsx

**Done When:**
- [ ] Search query reads from and writes to `?q=` URL param
- [ ] Content type reads from and writes to `?type=` URL param
- [ ] useSearch accepts query as prop, fires immediately (no internal debounce)
- [ ] VideoSearch initializes from URL query and syncs on back/forward
- [ ] Double-debounce fixed: ~300ms perceived delay (VideoSearch debounce only)
- [ ] Default state (no params) shows all videos, empty search, type all
- [ ] Clean URLs: default values omitted
- [ ] Tests pass

---

### Chunk 3: Defaults, Validation, and Verification

**Goal:** Ensure both pages handle invalid/edge-case URL params gracefully. Add targeted edge-case tests.

**Files:**
- `src/app/discovery/page.tsx` — modify (add param validation)
- `src/app/page.tsx` — modify (add param validation)
- `src/app/discovery/__tests__/page.test.tsx` — modify (add edge case tests)
- `src/app/__tests__/page.test.tsx` — modify (add edge case tests)

**Implementation Details:**

Param validation for Discovery:
- `?channel=nonexistent` — after channels load, validate: `const validChannel = channels.some(c => c.id === channelParam) ? channelParam : null`
- `?type=invalid` — type guard: `const validTypes = ['all', 'saved', 'not-saved'] as const; contentType = validTypes.includes(raw) ? raw : 'all'`
- `?page=abc` or `?page=0` — `Math.max(1, Number(param) || 1)`. Clamp to `totalPages` after videos load.

Param validation for KB:
- `?type=invalid` — if not in `['all', 'youtube', 'transcript']`, treat as 'all'
- `?q=` with only whitespace — trim, treat as empty (no search triggered)

Edge case tests:
- Discovery: `?channel=FAKE_ID` → shows all channels (no crash)
- Discovery: `?type=bogus` → defaults to 'all'
- Discovery: `?page=abc` → page 1. `?page=999` → clamped to last page
- KB: `?type=nope` → defaults to 'all'
- KB: `?q=%20%20` → treated as empty
- Both: empty searchParams → full default state
- Both: navigating between Discovery and KB doesn't leak params across pages

**What Could Break:**
- Channel validation timing — channels load async, so `?channel=abc` is initially unvalidated until channels arrive. Use the raw param for filtering and validate after load. If invalid, the `filteredVideos` useMemo already handles "channel not found" by showing nothing, which is fine.

**Done When:**
- [ ] Invalid channel IDs fall back to "All Channels"
- [ ] Invalid type values fall back to 'all' on both pages
- [ ] Invalid page numbers fall back to 1 (and clamp to max)
- [ ] Whitespace-only queries treated as empty
- [ ] Default values never appear in URL
- [ ] Navigation between pages doesn't leak params
- [ ] All edge case tests pass

## Notes
- `useURLParams` hook created in Chunk 1 is reused by Story 3 (Active Filter Pills) for dismissing filters
- useSearch API change is contained — only caller is page.tsx
- Focus Area intentionally NOT moved to URL (global setting, stays in localStorage)
