---
name: insights-extraction-persistence
title: Persist Insights Extraction Progress Across Navigation
status: active
cycle: polish
story_number: 1
created: 2026-02-08
updated: 2026-02-08
priority: high
chunks_total: 4
chunks_complete: 0
---

# Story: Persist Insights Extraction Progress Across Navigation

## Spark
When insights are extracting and the user navigates away then returns, there's no signal that extraction is running. All state lives in component-level useState inside useExtraction, so it's lost on unmount. A global ExtractionProvider context will hold extraction state in a Map<videoId, ExtractionState>, keeping WebSocket callbacks alive and progress visible across navigation.

## Scope

**Included:**
- New ExtractionProvider context wrapping the app
- Refactor useExtraction to read/write from global context instead of local state
- WebSocket callbacks update global store even when video page is unmounted
- Returning to a video page reconnects to live streaming progress
- Background completion triggers DB persistence automatically
- Cleanup: evict from store after successful DB write

**Excluded:**
- DB-backed partial persistence (no schema changes)
- localStorage/sessionStorage caching
- Progress surviving full page refresh or browser restart
- Global indicator in top bar showing active extractions (could be a follow-up)

## Preserve
- Existing extraction streaming UX (section-by-section, typing cursor)
- AgentConnection WebSocket behavior
- InsightsTabs and InsightsPanel components (consumers, not owners of state)
- API endpoints: GET/POST /api/videos/[id]/insights
- Cancel functionality during extraction

## Hardest Constraint
The useExtraction hook currently owns both the state and the WebSocket callback registration. Splitting these apart — state in context, callbacks still wired through AgentConnection — requires careful lifecycle management so callbacks don't leak or orphan.

## Technical Concerns
- Race condition: user starts extraction, navigates away, extraction completes and writes to DB, user returns — need to check DB first before assuming store state is current
- Memory: partial JSON blobs in the store for each active extraction; need eviction after DB persistence
- Multiple extractions: if user kicks off extraction on video A then video B, both should track independently

## Recommendations
- Model ExtractionProvider after existing FocusAreaProvider/AgentProvider patterns
- Keep ExtractionState type identical to current useExtraction state shape for minimal refactoring
- Use useRef for WebSocket callback references to avoid stale closures in the global store

## Dependencies
**Blocked by:** None
**Blocks:** None

## Decisions

### State Architecture
**Type:** component
**Choice:** Global ExtractionProvider context with Map<videoId, ExtractionState>

### Video Metadata Passing
**Type:** component
**Choice:** Pass video to extract(video) as argument (caller provides data)

### Store Eviction
**Type:** component
**Choice:** Evict immediately after successful DB write

## Acceptance
- [ ] Given insights are extracting, when user navigates away and returns, then extraction progress is visible and streaming continues live
- [ ] Given insights complete while user is on another page, when user returns, then completed insights are shown
- [ ] Given extraction errors while user is away, when user returns, then error state is displayed with retry option
- [ ] Given extraction completes in the background, then results are persisted to DB automatically
- [ ] Given a completed extraction in the store, when DB write succeeds, then the entry is evicted from the global store
- [ ] Given multiple videos with active extractions, then each tracks independently

## Chunks

### Chunk 1: Create ExtractionProvider with global store and actions

**Goal:** Build the provider that holds extraction state globally and exposes startExtraction, cancelExtraction, and getState actions via context. Wire into layout.

**Files:**
- `src/components/providers/ExtractionProvider.tsx` — create
- `src/app/layout.tsx` — modify (add provider inside AgentProvider, outside FocusAreaProvider)

**Implementation Details:**
- Context value: `{ extractions: Map<number, ExtractionEntry>, startExtraction(videoId, video), cancelExtraction(videoId), getState(videoId) }`
- `ExtractionEntry` = `ExtractionState` + `insightId: string | null` + `accumulatedText: string`
- State stored as `useState<Map<number, ExtractionEntry>>`, cloned on mutation for React change detection
- `startExtraction(videoId, video)`: calls `agent.generateInsight()`, registers callbacks that update the Map entry. On `onDone`: persist to DB via POST, then evict from Map on success.
- `cancelExtraction(videoId)`: calls `agent.cancelInsight(insightId)`, sets entry to idle
- Use `useRef` for the Map update function reference to avoid stale closures in WebSocket callbacks
- Uses `useAgent()` from AgentProvider — must be nested inside it in layout.tsx
- Follow FocusAreaProvider pattern: `createContext<T | undefined>(undefined)`, consumer hook `useExtractionStore()` with throw on undefined

**What Could Break:**
- Map cloning on every update could be expensive with many concurrent extractions (unlikely in practice)
- AgentProvider nesting order must be correct

**Done When:**
- [ ] ExtractionProvider renders without errors when added to layout
- [ ] `useExtractionStore()` returns context value inside provider
- [ ] `useExtractionStore()` throws outside provider

### Chunk 2: Refactor useExtraction to use global store

**Goal:** Transform useExtraction from owning state locally to being a thin wrapper that delegates to ExtractionProvider. Maintain the identical external API. Update InsightsTabs consumer.

**Files:**
- `src/hooks/useExtraction.ts` — modify (major refactor)
- `src/components/insights/InsightsTabs.tsx` — modify (simplify props, remove agent pass-through)

**Implementation Details:**
- `useExtraction({ videoId, video })` — drop `agent` param (provider gets it from context)
- Hook calls `useExtractionStore()` to get global actions
- `state`: reads from `store.getState(videoId)` — if store has entry, use it; otherwise return initial idle state
- `extract()`: calls `store.startExtraction(videoId, video)`
- `cancel()`: calls `store.cancelExtraction(videoId)`
- `insightId`: read from store entry
- `loadExisting` effect (on mount): check store first — if store has entry (extracting or done), skip API fetch. If store is empty, fetch from `GET /api/videos/[id]/insights` as before.
- InsightsTabs: remove `useAgent()` call and `agent` prop from useExtraction invocation. Just pass `{ videoId: video.id, video }`

**What Could Break:**
- External API must remain identical: `{ state, extract, cancel, insightId }`
- The loadExisting / store-check priority is the key logic: store > API > idle

**Done When:**
- [ ] Navigating to a video page with no active extraction still works (loads from DB)
- [ ] Starting extraction works identically to before (streaming, section progress, completion)
- [ ] Navigating away and returning shows extraction still in progress (live streaming)
- [ ] Extraction completing in background persists to DB and evicts from store
- [ ] Cancel still works during active extraction

### Chunk 3: Handle edge cases

**Goal:** Address race conditions, agent disconnect, and duplicate extraction guard.

**Files:**
- `src/components/providers/ExtractionProvider.tsx` — modify (edge case handling)
- `src/hooks/useExtraction.ts` — modify (mount-time logic)

**Implementation Details:**
- Race condition on return: if store entry was evicted (extraction finished + DB write succeeded) between navigation, the loadExisting effect falls through to API check, which returns the persisted result. Verify this path works.
- Agent disconnect mid-extraction: when AgentConnection.ws.onclose fires, onError callbacks fire for all active insights. Provider must handle onError by setting the Map entry to error state.
- Duplicate extraction guard: if user triggers startExtraction twice for same videoId, second call should no-op if state is already extracting.
- Cleanup on unmount: when ExtractionProvider unmounts (app teardown), no cleanup needed — Map is garbage collected. Active WebSocket callbacks fire into stale ref, which is harmless.

**What Could Break:**
- Stale closure bugs if Map reference in callbacks is outdated — verify useRef pattern works for dispatch

**Done When:**
- [ ] Starting extraction on an already-extracting video is a no-op
- [ ] Agent disconnect during extraction shows error state when returning to page
- [ ] Extraction that completed during navigation shows persisted results from DB on return

### Chunk 4: Update tests

**Goal:** Update all existing tests and add new ExtractionProvider tests. Verify zero regressions.

**Files:**
- `src/components/providers/__tests__/ExtractionProvider.test.tsx` — create
- `src/hooks/__tests__/useExtraction.test.ts` — modify (wrap with providers)
- `src/components/insights/__tests__/InsightsTabs.test.tsx` — modify (add ExtractionProvider to render tree)

**Implementation Details:**
- ExtractionProvider tests: test context availability, startExtraction updates store, cancelExtraction clears state, eviction after DB write, multiple concurrent extractions tracked independently. Mock useAgent to return mock AgentConnection. Follow FocusAreaProvider test patterns.
- useExtraction tests: wrap renderHook with both AgentProvider (mocked) and ExtractionProvider. Existing 9 tests should pass with minimal changes. Add tests: "returns active store state on mount when extraction is running", "falls back to API when store is empty".
- InsightsTabs tests: add ExtractionProvider to the render wrapper. Verify existing 7 tests pass.

**What Could Break:**
- Mock setup becomes more complex with nested providers
- Some tests may need act() wrapping adjusted for async context updates

**Done When:**
- [ ] All 9 existing useExtraction tests pass
- [ ] All 7 existing InsightsTabs tests pass
- [ ] New ExtractionProvider tests cover: create, cancel, eviction, concurrent extractions
- [ ] `npm test` passes with no regressions

## Notes
Key files:
- `src/hooks/useExtraction.ts` — refactor to read/write from context
- New: `src/components/providers/ExtractionProvider.tsx` — global state store
- `src/app/layout.tsx` — wrap app with ExtractionProvider
- `src/components/insights/InsightsTabs.tsx` — simplify props

File Impact:
| File | Chunks | Action |
|------|--------|--------|
| `src/components/providers/ExtractionProvider.tsx` | 1, 3 | create, modify |
| `src/app/layout.tsx` | 1 | modify |
| `src/hooks/useExtraction.ts` | 2, 3 | modify |
| `src/components/insights/InsightsTabs.tsx` | 2 | modify |
| `src/components/providers/__tests__/ExtractionProvider.test.tsx` | 4 | create |
| `src/hooks/__tests__/useExtraction.test.ts` | 4 | modify |
| `src/components/insights/__tests__/InsightsTabs.test.tsx` | 4 | modify |

Dependencies: Chunk 2 requires 1, Chunk 3 requires 2, Chunk 4 requires 3.
