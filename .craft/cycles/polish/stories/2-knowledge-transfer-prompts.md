---
name: knowledge-transfer-prompts
title: Knowledge Transfer Prompts from Video Insights
status: active
priority: high
created: 2026-02-08
updated: 2026-02-08
chunks_total: 4
chunks_complete: 2
---

# Story: Knowledge Transfer Prompts from Video Insights

## Spark
Add a **knowledge transfer prompt** to extractions — distilled learnings with specific techniques, concrete details, and enough context that Claude can act on it immediately. This is a NEW field added alongside the existing claudeCode section (which stays as-is). Primary delivery is through the MCP `search_rag` tool, so knowledge flows directly into Claude's context. UI copy button as fallback on the video detail page.

## Scope

**Included:**
- Add `knowledgePrompt` field to ExtractionResult type
- Update extraction prompt to generate a knowledge transfer prompt alongside existing sections
- Enhance `search_rag` MCP tool to return knowledge prompts with search results
- Display knowledge prompt in InsightsPanel with copy button (using existing InsightSection component)
- Handle old extractions gracefully (show re-extract prompt if knowledgePrompt missing)

**Excluded:**
- Changes to the existing claudeCode section (skills/commands/agents/hooks/rules stay as-is)
- New MCP tools (enhance existing `search_rag`)
- Changes to the extraction streaming/persistence architecture (just completed)
- Auto-installing anything into `.claude/` directory
- Changes to summary, insights, or action items sections

## Preserve
- Existing extraction flow (streaming, section progress, background persistence)
- All existing sections unchanged (summary, insights, action items, claudeCode)
- ExtractionProvider / useExtraction architecture
- ClaudeCodeSection component and its rendering
- MCP tool registration patterns in `src/lib/mcp/tools.ts`

## Hardest Constraint
The knowledge prompt must be structured well enough that Claude can reason from it and take action. Too vague and Claude won't know what to do. Too prescriptive and we're back to pre-built artifacts. The sweet spot is: specific learnings, concrete details, clear context — letting Claude decide how to apply them to the user's project.

## Dependencies
**Blocked by:** None
**Blocks:** None

## Decisions

### MCP Tool Name
**Type:** technical
**Choice:** Keep existing `search_rag` name — don't rename to avoid breaking existing configurations

### Existing claudeCode Section
**Type:** component
**Choice:** Keep as-is — knowledge prompt is additive, not a replacement

### Old Extractions
**Type:** component
**Choice:** Show re-extract prompt for old extractions missing knowledgePrompt

### Content Scope
**Type:** technical
**Choice:** Generate knowledge prompt for all videos (dev and non-dev)

## Visual Direction
**Vibe:** Clean, minimal — the knowledge block should read like a well-written prompt
**Feel:** Professional, actionable
**Key tokens:** Existing InsightsPanel patterns, InsightSection component

## Acceptance
- [ ] Given a video extraction, when complete, then a knowledgePrompt field contains distilled learnings with specific techniques and actionable details
- [ ] Given the knowledge prompt, when pasted into Claude, then Claude can reason about what to do and take concrete action
- [ ] Given the MCP `search_rag` tool, when called with a relevant query, then the knowledge prompt is included in the response for matching videos
- [ ] Given the InsightsPanel UI, when viewing insights, then a Knowledge Prompt section displays with a copy button
- [ ] Given a dev video (e.g., MCP optimization), when extraction runs, then the knowledge prompt captures specific techniques, settings, commands, and implementation details
- [ ] Given a non-dev video, when extraction completes, then the knowledge prompt captures domain insights, mental models, and applicable frameworks
- [ ] Given an old extraction without knowledgePrompt, when viewing insights, then the UI shows a re-extract prompt instead of the knowledge section

## Definition of Done
- [ ] All chunks complete
- [ ] All acceptance criteria verified
- [ ] Tests written and passing
- [ ] Preserve list confirmed intact
- [ ] No regressions in related features
- [ ] Build passes

## Chunks

### Chunk 1: Type + Extraction Prompt

**Goal:** Add `knowledgePrompt` field to ExtractionResult and update the extraction prompt to generate it alongside existing sections.

**Files:**
- `src/lib/claude/prompts/types.ts` — modify (add `knowledgePrompt: string` to ExtractionResult)
- `src/lib/claude/prompts/extract.ts` — modify (add knowledge prompt instructions to `buildExtractionPrompt()`)

**Implementation Details:**
- Add `knowledgePrompt: string` field to ExtractionResult type (alongside existing `claudeCode`)
- In the extraction prompt, add a new section asking the LLM to produce a knowledge transfer prompt: distilled learnings, specific techniques, concrete details, actionable context
- The prompt should instruct: "Write this as if you're teaching another AI assistant what you learned from this video. Include specific techniques, settings, commands, and reasoning — not generic summaries. The reader should be able to act on this knowledge immediately."
- Keep it as a top-level field, same level as `summary`, `insights`, `actionItems`, `claudeCode`

**What Could Break:**
- Existing extractions in DB won't have this field — UI must handle `undefined`
- Adding another section to the extraction prompt increases response length

**Done When:**
- [ ] `ExtractionResult` type includes `knowledgePrompt: string`
- [ ] `buildExtractionPrompt()` includes knowledge prompt instructions
- [ ] TypeScript compiles with no errors

### Chunk 2: Streaming Parser + ExtractionProvider

**Goal:** Update the parser to extract `knowledgePrompt` from streaming JSON, and add it to ExtractionProvider's section tracking.

**Files:**
- `src/lib/claude/prompts/parser.ts` — modify (add knowledgePrompt extraction)
- `src/components/providers/ExtractionProvider.tsx` — modify (add knowledgePrompt to section statuses and completion check)

**Implementation Details:**
- In `parsePartialJSON()`, add extraction for `knowledgePrompt` field — simple string, use same pattern as `summary` extraction (regex for key + string value)
- In `calculateSectionStatuses()`, add `knowledgePrompt` status detection (pending → working → done)
- In `isCompleteExtraction()`, include `knowledgePrompt` in completeness check
- Add `knowledgePrompt` to the `SectionStatus` tracking in ExtractionProvider

**What Could Break:**
- Parser regex needs to handle the new field without disrupting existing section extraction
- Section status ordering — knowledgePrompt should come after claudeCode in the extraction sequence

**Done When:**
- [ ] Streaming extraction progressively reveals knowledgePrompt content
- [ ] Section status shows pending → working → done for knowledgePrompt
- [ ] Extraction completion includes knowledgePrompt

### Chunk 3: UI — Knowledge Prompt Section + Copy Button

**Goal:** Display the knowledge prompt in InsightsPanel with a copy button. Add as a new InsightSection below ClaudeCodeSection.

**Files:**
- `src/components/insights/InsightsPanel.tsx` — modify (add knowledge prompt InsightSection)

**Implementation Details:**
- Add a new `InsightSection` below the ClaudeCodeSection for the knowledge prompt
- Use existing `InsightSection` component: `title="Knowledge Prompt"`, lucide icon (`Brain` or `BookOpen`), status from section statuses, content from `extractionData.knowledgePrompt`
- InsightSection already has CopyButton built in when status is `done` — get copy for free
- Handle `undefined` knowledgePrompt (old extractions): don't render the section, show subtle "Re-extract for knowledge prompt" message instead
- No changes to ClaudeCodeSection

**What Could Break:**
- Old extractions in DB won't have knowledgePrompt — conditional render handles this
- InsightsPanel layout with extra section

**Done When:**
- [ ] Knowledge prompt displays as a readable section in InsightsPanel
- [ ] Copy button works and copies the full knowledge prompt
- [ ] Old extractions without knowledgePrompt show re-extract prompt or are hidden gracefully
- [ ] Streaming progress shows for the section during extraction

### Chunk 4: MCP Tool Enhancement + Tests

**Goal:** Enhance `search_rag` to include knowledge prompts in results. Update all affected tests.

**Files:**
- `src/lib/mcp/tools.ts` — modify (enhance search_rag to include knowledgePrompt)
- `src/lib/claude/prompts/__tests__/extract.test.ts` — modify (add knowledgePrompt tests)
- `src/lib/claude/prompts/__tests__/parser.test.ts` — modify (add knowledgePrompt parsing tests)
- `src/lib/mcp/__tests__/tools.test.ts` — modify (add knowledgePrompt in search results tests)
- `src/components/insights/__tests__/InsightsPanel.test.tsx` — modify (add knowledge prompt section tests)

**Implementation Details:**
- In `search_rag` handler: after getting search results, look up insights for matched video IDs from the `insights` table. If a video has a `knowledgePrompt` in its extraction, append it to the search result content block.
- Format: Include the knowledge prompt as a clearly labeled block in the MCP response so Claude can distinguish it from transcript chunks
- Tests: Add `knowledgePrompt` to test fixtures where needed, test parser handles it, test MCP returns it, test UI renders it
- Update any test fixtures that construct ExtractionResult objects to include knowledgePrompt

**What Could Break:**
- search_rag currently doesn't query the insights table — need to add that DB access
- Response format change could affect how Claude processes search results

**Done When:**
- [ ] `search_rag` returns knowledge prompts alongside search results for matching videos
- [ ] All existing tests still pass
- [ ] New tests cover: knowledgePrompt parsing, UI rendering, MCP inclusion
- [ ] `npm test` and `npm run build` pass

## Notes
Key files:
- `src/lib/claude/prompts/extract.ts` — extraction prompt (add knowledgePrompt instructions)
- `src/lib/claude/prompts/types.ts` — ExtractionResult type (add knowledgePrompt field)
- `src/lib/claude/prompts/parser.ts` — streaming parser (add knowledgePrompt extraction)
- `src/components/providers/ExtractionProvider.tsx` — section status tracking
- `src/components/insights/InsightsPanel.tsx` — add knowledge prompt InsightSection
- `src/lib/mcp/tools.ts` — enhance search_rag to return knowledge prompts

File Impact:
| File | Chunks | Action |
|------|--------|--------|
| `src/lib/claude/prompts/types.ts` | 1 | modify |
| `src/lib/claude/prompts/extract.ts` | 1 | modify |
| `src/lib/claude/prompts/parser.ts` | 2 | modify |
| `src/components/providers/ExtractionProvider.tsx` | 2 | modify |
| `src/components/insights/InsightsPanel.tsx` | 3 | modify |
| `src/lib/mcp/tools.ts` | 4 | modify |
| Test files (4) | 4 | modify |

Dependencies: Chunk 2 requires 1. Chunk 3 requires 2. Chunk 4 requires 1-3.
