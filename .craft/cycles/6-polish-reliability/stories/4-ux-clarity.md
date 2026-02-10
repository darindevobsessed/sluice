---
name: persona-ux-clarity
title: Persona UX clarity and discoverability improvements
status: active
cycle: polish-reliability
story_number: 4
created: 2026-02-10
updated: 2026-02-10
priority: medium
chunks_total: 4
chunks_complete: 3
---

# Story: Persona UX clarity and discoverability improvements

## Spark
Users can't discover or understand the persona feature. The threshold (30 transcripts) is too high for most users to reach, and there's no visibility into persona status or progress. Lower the threshold to 5, show persona status for all channels on the Knowledge Bank page, add hint text explaining search modes, and improve error messages.

## Scope

**Included:**
- Lower persona suggestion threshold from 30 to 5 transcripts
- New PersonaStatus section on Knowledge Bank page showing all channels with persona progress (X/5 building, active, etc.)
- Hint text below search bar explaining keyword vs question search modes
- Better error messages in PersonaPanel with specific, actionable text
- Replace PersonaSuggestion banner with new PersonaStatus section

**Excluded:**
- New /personas page (not needed — status lives on Knowledge Bank page)
- "Speak to" buttons (confusing with multiple personas — search bar handles both modes)
- Persona editing/customization
- Persona deactivation toggle (keywords vs questions is sufficient control)
- Example clickable questions (cut for scope)

## Preserve
- Current question detection logic (3+ words, question patterns)
- Existing PersonaPanel and PersonaColumn components (structure)
- Current ensemble API and streaming responses
- Knowledge Bank page layout (stats → search → results)
- PersonaColumn error display (improve messages, keep structure)

## Hardest Constraint
Composing the new PersonaStatus section with channels that have personas AND channels still building — must fetch both data sources (channels with transcript counts + existing personas) and merge them into a single view.

## Technical Concerns
- Need a new API endpoint or modify existing suggest endpoint to return ALL channels with their transcript counts and persona status (not just those above threshold)
- PersonaSuggestion component gets replaced by PersonaStatus — need to remove old banner cleanly

## Decisions

### Threshold
**Decision:** Lower persona suggestion threshold from 30 to 5 transcripts
**Rationale:** Users can't reach 30 with typical usage. 5 is achievable and produces useful personas.

### Placement
**Decision:** PersonaStatus section on Knowledge Bank page, between stats and search bar
**Rationale:** No new page needed. Users see persona status every visit. Replaces existing PersonaSuggestion banner.

### No "Speak to" buttons
**Decision:** Informational persona status only, no per-persona action buttons
**Rationale:** With multiple personas, the system auto-selects best matches. Search bar is the single entry point for both keyword and question modes.

### Error Messages
**Decision:** Specific, actionable error messages replacing generic "Something went wrong"
**Rationale:** Users need to know WHY something failed and what they can do about it.

## Dependencies
**Blocked by:** None
**Blocks:** None

## Acceptance
- [ ] Persona suggestion threshold is 5 (not 30)
- [ ] Knowledge Bank page shows persona status for all channels (active personas + building progress)
- [ ] Channels at/above 5 transcripts without a persona show "Create" button with transcript count
- [ ] Channels below 5 transcripts show progress bar (X/5) with "N more needed" text
- [ ] Active personas show channel name with "Active" indicator
- [ ] Hint text below search bar explains: keywords for search, questions for personas
- [ ] PersonaPanel error messages are specific and actionable (not "Something went wrong")
- [ ] PersonaColumn per-persona errors are specific and actionable
- [ ] Old PersonaSuggestion banner is replaced by new PersonaStatus section
- [ ] Existing Knowledge Bank page tests still pass

## Chunks

### Chunk 1: PersonaStatus API endpoint

**Goal:** Create a new API endpoint that returns all channels with their transcript counts and persona status, so the frontend can show the full persona progress view.

**Files:**
- `src/app/api/personas/status/route.ts` — **create**
- `src/app/api/personas/status/__tests__/route.test.ts` — **create**

**Implementation Details:**
- `GET /api/personas/status` returns JSON:
  ```json
  {
    "channels": [
      { "channelName": "Nate B Jones", "transcriptCount": 6, "personaId": null, "personaCreatedAt": null },
      { "channelName": "Anthropic", "transcriptCount": 1, "personaId": null, "personaCreatedAt": null }
    ],
    "threshold": 5
  }
  ```
- Query: join videos grouped by channel (non-null channels only) with left join on personas by channelName
- Include `threshold` in response so frontend doesn't hardcode it
- Sort: active personas first, then by transcript count descending
- Tests: channels with and without personas, channels below/above threshold, null channels excluded

**What Could Break:**
- Channel name matching between videos.channel and personas.channelName — verify they use the same format

**Done When:**
- [ ] Endpoint returns all channels with transcript counts and persona status
- [ ] Active personas sorted first, then by transcript count
- [ ] Null channels excluded
- [ ] Threshold value included in response
- [ ] Tests pass

### Chunk 2: PersonaStatus component + integrate into Knowledge Bank

**Goal:** Create a PersonaStatus component showing all channels with their persona progress, replace PersonaSuggestion banner, and add search hint text.

**Files:**
- `src/components/personas/PersonaStatus.tsx` — **create**
- `src/components/personas/__tests__/PersonaStatus.test.tsx` — **create**
- `src/app/page.tsx` — **modify** (replace PersonaSuggestion with PersonaStatus, add hint text below search)

**Implementation Details:**
- PersonaStatus component:
  - Fetches from `GET /api/personas/status` on mount
  - Section header: "Personas (N active · M building)" using muted text
  - Compact horizontal layout with flex-wrap, small cards per channel:
    - **Active persona:** `@ChannelName ✓` in a pill/badge style (green accent)
    - **Ready to create (≥ threshold):** `@ChannelName (N transcripts) [Create]` — uses existing handleCreate pattern from PersonaSuggestion
    - **Building (< threshold):** `@ChannelName N/5` with a tiny progress bar and "M more needed" in muted text
  - If no channels at all: don't render section
  - Create button calls `POST /api/personas` (same as existing PersonaSuggestion flow)
  - Loading state: subtle shimmer bar
- page.tsx changes:
  - Replace `<PersonaSuggestion />` import/usage with `<PersonaStatus />`
  - Add hint text `<p>` below VideoSearch: "Type keywords to search · Ask a question (3+ words) to hear from your personas" in `text-xs text-muted-foreground`
  - Hint text only shows when personas exist (at least one active)
- Tests: render with mix of active/building/ready channels, verify Create button works, verify hint text shows/hides

**What Could Break:**
- Layout crowding on mobile with many channels — use flex-wrap and limit visible channels
- PersonaSuggestion removal might break existing tests — update or remove PersonaSuggestion tests

**Done When:**
- [ ] PersonaStatus renders channels in correct states (active, ready, building)
- [ ] Create button creates persona and updates card to active
- [ ] Hint text appears below search bar when personas exist
- [ ] PersonaSuggestion banner replaced
- [ ] Knowledge Bank page tests pass

### Chunk 3: Lower threshold + update suggest endpoint

**Goal:** Change the persona suggestion threshold from 30 to 5 and update the suggest API endpoint.

**Files:**
- `src/app/api/personas/suggest/route.ts` — **modify** (change threshold from 30 to 5)
- `src/app/api/personas/suggest/__tests__/route.test.ts` — **modify** (update test expectations)

**Implementation Details:**
- Line 23 in suggest/route.ts: change `c.videoCount >= 30` to `c.videoCount >= 5`
- Extract threshold as a named constant: `const PERSONA_THRESHOLD = 5`
- Export the constant so other files can use it: `export const PERSONA_THRESHOLD = 5`
- Update any tests that assert on the threshold value
- The status endpoint from Chunk 1 should import this constant rather than hardcoding

**What Could Break:**
- Nothing significant — simple value change

**Done When:**
- [ ] Threshold is 5 in suggest endpoint
- [ ] Constant is exported for reuse
- [ ] Status endpoint uses same constant
- [ ] Tests pass

### Chunk 4: Better error messages in PersonaPanel

**Goal:** Replace generic "Something went wrong" error messages with specific, actionable messages in both PersonaPanel and PersonaColumn.

**Files:**
- `src/components/personas/PersonaPanel.tsx` — **modify** (improve error state messaging)
- `src/components/personas/PersonaColumn.tsx` — **modify** (improve per-persona error display)
- `src/hooks/useEnsemble.ts` — **modify** (pass through specific error messages from API)
- `src/app/api/personas/ensemble/route.ts` — **modify** (return specific error types)
- `src/components/personas/__tests__/PersonaPanel.test.tsx` — **modify** (update error message assertions)
- `src/components/personas/__tests__/PersonaColumn.test.tsx` — **modify** (update error message assertions)

**Implementation Details:**
- Ensemble route: categorize errors:
  - No personas found → "No personas available. Create personas from channels with 5+ transcripts."
  - Embedding generation failed → "Unable to process your question. Please try again."
  - Claude API error → pass through the error message (rate limit, auth, etc.)
- useEnsemble hook: preserve error messages from SSE stream, don't replace with generic text
- PersonaPanel error state: show specific message from hook, with actionable hint
  - If no personas: "Create personas from your channels to enable question answering."
  - If API error: show actual error message
- PersonaColumn error state: show per-persona error message instead of generic "Something went wrong"
  - "Unable to generate response — [specific reason]"
- Tests: verify specific error messages render for different error types

**What Could Break:**
- Existing error handling flow — make sure we don't break the retry button or error recovery
- SSE stream error format — ensure backward compatibility

**Done When:**
- [ ] PersonaPanel shows specific error messages (not "Something went wrong")
- [ ] PersonaColumn shows specific per-persona error messages
- [ ] "No personas" empty state message is updated to reference 5-transcript threshold
- [ ] Error messages are actionable (tell user what to do)
- [ ] Retry button still works
- [ ] Tests pass
- [ ] `npm test` passes clean

## Notes
- `PersonaSuggestion` component at `src/components/personas/PersonaSuggestion.tsx` gets replaced by `PersonaStatus`
- Suggest endpoint at `src/app/api/personas/suggest/route.ts` line 23 has the threshold (`>= 30`)
- Knowledge Bank page `src/app/page.tsx` renders PersonaSuggestion at line 181
- PersonaPanel at `src/components/personas/PersonaPanel.tsx` has the generic error at line 64
- PersonaColumn at `src/components/personas/PersonaColumn.tsx` has generic error at line 40
- Ensemble route at `src/app/api/personas/ensemble/route.ts` returns generic errors
