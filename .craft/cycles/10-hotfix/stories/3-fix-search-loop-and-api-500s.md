---
name: fix-search-loop-and-api-500s
title: Fix search render loop and persistent API 500s
status: complete
cycle: hotfix
story_number: 3
created: 2026-02-14
updated: 2026-02-14
priority: urgent
chunks_total: 2
chunks_complete: 2
current_chunk: 3
---

# Story: Fix search render loop and persistent API 500s

## Spark
Two frontend bugs: (1) The Knowledge Bank search triggers an infinite render loop (~2 req/sec) when a query param is in the URL — caused by `useURLParams` creating unstable `updateParams` refs because `searchParams` is in its dependency array. Each `router.replace()` changes `searchParams` → new `updateParams` → new `handleSearch` → VideoSearch effect re-fires → loop. (2) All API routes start returning empty-body 500s after ~15 min of inactivity, persisting until server restart. DB is fine (MCP still works). The error occurs at the Next.js Turbopack serving layer before route handlers execute.

## Delivery
Chunk 1 fixes the render loop by making `updateParams` referentially stable — reading `window.location.search` inside the callback instead of closing over `searchParams`. This breaks the cascade that causes VideoSearch to re-fire its effect endlessly. Chunk 2 switches the dev server from Turbopack to webpack (`--webpack` flag), eliminating the known Turbopack route handler instability that causes persistent 500s after idle. Together, both bugs are resolved.

## Scope
**Included:**
- Fix `useURLParams` callback instability by reading `window.location.search` instead of depending on `searchParams`
- Switch dev server from Turbopack to webpack to eliminate persistent API 500s

**Excluded:**
- Server-side route handler changes (the 500 is not in handler code)
- Changes to the MCP server (it works fine)
- Turbopack upstream fix (we switch bundlers instead)

## Hardest Constraint
The 500 root cause is in Turbopack's route handler compilation layer — a known issue area (vercel/next.js #77036, #86140). Already on latest Next.js (16.1.6). Switching to webpack is the proven fix.

## Decisions
### Render loop fix approach
**Type:** component
**Choice:** inline
Fix directly in `useURLParams` hook — remove `searchParams` from `updateParams` deps, read `window.location.search` inside the callback instead.

### Dev bundler
**Type:** component
**Choice:** inline
Switch from Turbopack (default) to webpack via `--webpack` flag on `next dev` script. Slightly slower HMR but eliminates the persistent 500s.

## Chunk 1: Fix useURLParams callback instability

**Goal:** Eliminate the infinite render loop by making `updateParams` referentially stable across navigations.

**Files:**
- Modify: `src/hooks/__tests__/useURLParams.test.ts` — add referential stability test
- Modify: `src/hooks/useURLParams.ts` — remove `searchParams` from deps

**Implementation Details:**

1. **Test first** — In `src/hooks/__tests__/useURLParams.test.ts`, add a test that verifies `updateParams` returns the same function reference after a simulated navigation (re-render with new `searchParams` mock). Pattern: use `renderHook` + `rerender()`, compare `result.current.updateParams` identity across renders using `toBe`.

2. **Fix** — In `src/hooks/useURLParams.ts:11-33`, change `updateParams` to read current params from `window.location.search` inside the callback body:
   ```typescript
   const updateParams = useCallback((
     updates: Record<string, string | null>,
     method: 'replace' | 'push' = 'replace'
   ) => {
     const params = new URLSearchParams(window.location.search)
     Object.entries(updates).forEach(([key, value]) => {
       if (value === null || value === '') {
         params.delete(key)
       } else {
         params.set(key, value)
       }
     })
     const queryString = params.toString()
     const url = queryString ? `${pathname}?${queryString}` : pathname
     router[method](url)
   }, [pathname, router])
   ```
   Key change: `searchParams` removed from deps, `window.location.search` read inside callback.

3. Keep `searchParams` in the hook return — still needed for reactive reads (e.g., `urlQuery`, `contentType`).

**What Could Break:**
- If `window.location.search` is stale when called (unlikely — `router.replace()` updates it synchronously)
- Other consumers of `useURLParams` (DiscoveryContent) — they benefit from the fix, no changes needed

**Done When:**
- [ ] New referential stability test passes
- [ ] All existing `useURLParams` tests pass (9 tests)
- [ ] No repeated `GET /?q=...` requests in dev server logs

## Chunk 2: Switch dev server from Turbopack to webpack

**Goal:** Prevent persistent API 500s by using the stable webpack bundler for dev mode.

**Files:**
- Modify: `package.json` — add `--webpack` flag to `next:dev` script
- Possibly modify: `next.config.ts` — migrate `experimental.serverComponentsExternalPackages` to top-level `serverExternalPackages` if webpack warns

**Implementation Details:**

1. In `package.json`, change `next:dev` script from:
   `exec next dev -p ${PORT:-3001}`
   to:
   `exec next dev --webpack -p ${PORT:-3001}`

2. Start dev server with `npm run dev` and verify it starts cleanly.

3. If webpack warns about `experimental.serverComponentsExternalPackages`, migrate in `next.config.ts`:
   - Move `experimental.serverComponentsExternalPackages: ['sharp', 'onnxruntime-node']` to top-level `serverExternalPackages: ['sharp', 'onnxruntime-node']`

4. Run full test suite to verify no regressions.

**What Could Break:**
- Slightly slower HMR rebuilds (acceptable tradeoff)
- ONNX/sharp external package config may need migration
- `outputFileTracingExcludes` paths may differ

**Done When:**
- [ ] Dev server starts cleanly with `--webpack`
- [ ] No build warnings or errors
- [ ] All tests pass
- [ ] Manual verification: dev server stable for 15+ min without API 500s (user verifies over time)
