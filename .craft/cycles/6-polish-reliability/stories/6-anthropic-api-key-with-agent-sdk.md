---
name: replace-anthropic-api-key-with-agent-sdk
title: Replace raw Anthropic API calls with Agent SDK
status: active
cycle: polish-reliability
story_number: 6
created: 2026-02-10
updated: 2026-02-10
priority: urgent
chunks_total: 2
chunks_complete: 0
---

# Story: Replace raw Anthropic API calls with Agent SDK

## Spark
Two files (`src/lib/mcp/tools.ts` and `src/lib/personas/streaming.ts`) use raw `fetch` to the Anthropic Messages API requiring `ANTHROPIC_API_KEY`, but the rest of the app uses `query()` from `@anthropic-ai/claude-agent-sdk` which uses the session token. This causes persona chat and ensemble queries to fail with "ANTHROPIC_API_KEY environment variable is required" when no API key is set.

## Scope
**Included:**
- Replace `queryPersona()` in `src/lib/mcp/tools.ts:111-173` with Agent SDK `query()`
- Replace `streamPersonaResponse()` in `src/lib/personas/streaming.ts:75-179` with Agent SDK `query()`
- Remove `ANTHROPIC_API_URL` and `ANTHROPIC_API_KEY` references from both files
- Update tests in `src/lib/personas/__tests__/streaming.test.ts`

**Excluded:**
- No changes to persona creation flow (already uses Agent SDK)
- No changes to the ensemble orchestration logic itself
- No UI changes

## Hardest Constraint
The streaming path (`streamPersonaResponse`) currently returns a `ReadableStream<Uint8Array>` of SSE events, consumed by both the API route and the ensemble. The Agent SDK `query()` returns an async iterable of messages. The transform from async iterable to SSE stream must preserve the existing event format so the UI client doesn't break.

## Technical Concerns
- Agent SDK `query()` is non-streaming by nature (returns full messages). Need to verify it can emit incremental text or adapt the SSE format to send complete responses.
- The ensemble path (`streamEnsembleResponse`) depends on `streamPersonaResponse` returning a `ReadableStream` — interface must stay compatible or ensemble must be updated too.

## Acceptance
- Given a persona exists, when `chat_with_persona` MCP tool is called, then it responds without requiring `ANTHROPIC_API_KEY`
- Given a persona exists, when `ensemble_query` MCP tool is called, then all personas respond without requiring `ANTHROPIC_API_KEY`
- Given the PersonaPanel UI queries a persona, when the response streams back, then SSE events arrive correctly
- Given no `ANTHROPIC_API_KEY` is set, when any persona feature is used, then it works using the session token

## Chunks

### Chunk 1: Replace queryPersona in tools.ts

**Goal:** Replace the raw `fetch` to Anthropic Messages API with Agent SDK `query()` so the `chat_with_persona` and `ensemble_query` MCP tools work without `ANTHROPIC_API_KEY`.

**Files:**
- `src/lib/mcp/tools.ts` — modify (rewrite `queryPersona`, remove API key/URL constants)

**Implementation Details:**
- Import `query` from `@anthropic-ai/claude-agent-sdk`
- Remove `ANTHROPIC_API_URL` constant (line 104)
- Keep `MODEL` constant for query options
- Rewrite `queryPersona` (lines 111-173):
  - Remove `ANTHROPIC_API_KEY` env check
  - Build system prompt same way (using `getPersonaContext` + `formatContextForPrompt`)
  - Call `query()` with prompt = system prompt + question concatenated (same pattern as service.ts:59)
  - Options: `{ model: MODEL, maxTurns: 1, tools: [], persistSession: false }`
  - Iterate async iterable, extract text from `assistant` message `content` blocks
  - Follow exact pattern from `service.ts:59-80`
- Fix stale message at line 241: "30+ videos" → "5+ transcripts"
- No test changes needed — `tools.test.ts` doesn't test `chat_with_persona` or `ensemble_query`

**What Could Break:**
- `query()` prompt handling — service.ts concatenates system prompt into prompt string, follow same pattern

**Done When:**
- [ ] `queryPersona` uses Agent SDK `query()` instead of raw fetch
- [ ] No `ANTHROPIC_API_KEY` or `ANTHROPIC_API_URL` references in tools.ts
- [ ] TypeScript compiles clean

### Chunk 2: Replace streamPersonaResponse in streaming.ts + update tests

**Goal:** Replace the raw streaming fetch with Agent SDK `query()` using `includePartialMessages: true` to stream persona responses without `ANTHROPIC_API_KEY`.

**Files:**
- `src/lib/personas/streaming.ts` — modify (rewrite `streamPersonaResponse`)
- `src/lib/personas/__tests__/streaming.test.ts` — modify (mock Agent SDK instead of `fetch`)

**Implementation Details:**
- streaming.ts changes:
  - Import `query` from `@anthropic-ai/claude-agent-sdk`
  - Remove `ANTHROPIC_API_URL` constant
  - Keep `MODEL`, `MAX_TOKENS`, helper functions (`estimateTokens`, `limitContextTokens`, `buildSystemPrompt`)
  - Rewrite `streamPersonaResponse` (lines 75-179):
    - Remove `ANTHROPIC_API_KEY` env check
    - Build system prompt using existing `buildSystemPrompt()`
    - Create `AbortController` wired to incoming `signal` (listen for signal abort → controller.abort())
    - Call `query()` with prompt = system prompt + question concatenated
    - Options: `{ model: MODEL, maxTurns: 1, tools: [], includePartialMessages: true, abortController, persistSession: false }`
    - Return `ReadableStream<Uint8Array>` that:
      - Iterates the async iterable from `query()`
      - For `stream_event` with `event.type === 'content_block_delta'`: emit `data: ${JSON.stringify(event)}\n\n`
      - On iteration complete: emit `data: {"type":"done"}\n\n` and close
    - Pattern: follow `chat.ts:38-83`
  - This preserves the SSE format that `ensemble.ts` already parses (line 182 checks `data.type === 'content_block_delta'` and reads `data.delta?.text`)

- streaming.test.ts changes:
  - Replace `global.fetch` mock with `vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: vi.fn() }))`
  - Remove `vi.stubEnv('ANTHROPIC_API_KEY', ...)` calls
  - Mock `query` to return async iterables with appropriate `stream_event` and `assistant` messages
  - Test: returns ReadableStream (stream_event → SSE data lines)
  - Test: includes persona system prompt + context in query prompt
  - Test: emits done event on completion
  - Test: handles abort signal
  - Test: handles query errors
  - Test: limits context tokens

**What Could Break:**
- SSE format: ensemble.ts expects `data.type === 'content_block_delta'` with `data.delta?.text` — raw SDK event has this shape
- Abort signal wiring: Agent SDK takes `abortController`, not `signal` — create new AbortController and wire signal

**Done When:**
- [ ] `streamPersonaResponse` uses Agent SDK `query()` instead of raw fetch
- [ ] No `ANTHROPIC_API_KEY` or `ANTHROPIC_API_URL` references in streaming.ts
- [ ] SSE event format is compatible with ensemble.ts consumer
- [ ] All streaming tests pass with Agent SDK mocks
- [ ] `npm test` passes clean

## Notes
- Pattern to follow: `src/lib/personas/service.ts:59-80` uses `query()` successfully
- Streaming pattern: `src/agent/chat.ts:38-83` uses `query()` with `includePartialMessages: true`
- The `query()` import: `import { query } from '@anthropic-ai/claude-agent-sdk'`
- ensemble.ts mocks `streamPersonaResponse` in its tests, so no ensemble test changes needed
- tools.test.ts only tests `search_rag` and `get_list_of_creators`, not persona tools
