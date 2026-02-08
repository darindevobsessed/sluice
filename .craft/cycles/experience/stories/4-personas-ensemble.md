---
name: personas-ensemble
title: Personas & Ensemble
status: active
priority: medium
created: 2026-02-05
updated: 2026-02-08
cycle: experience
story_number: 4
chunks_total: 6
chunks_complete: 2
current_chunk: 3
---

# Story: Personas & Ensemble

## Spark

Create persona agents for each creator once enough transcript data exists. Auto-suggest persona creation when a channel reaches 30+ transcripts — user confirms. Enable search-style ensemble: ask a question from the search bar, get side-by-side persona responses showing different creator perspectives. Add "who's best" routing that suggests which creator is best suited to answer.

Expose as MCP tools for external clients while keeping in-app experience search-flavored, not chat-flavored.

> *"As you get more transcripts, like, just get a bunch of like, get the last 30 videos for each creator. And then once you have that, you can create a persona agent. So you can, like, automate once you've hit a certain threshold of transcripts, it automatically creates a persona agent. So it creates a Nateby Jones agent."*
> *"I also want a I wanna talk to an ensemble. So when we chat with the GoldMiner app and then it will respond to me in different personas. So, like, this is what this guy says. This is what this guy says. His take. This is that take."*
> *"Who would be best to respond to this?"*

**Key decisions:**
- Persona creation: auto-suggest at 30+ transcripts threshold, user confirms
- In-app experience: search-style ensemble (extend search bar, side-by-side persona responses)
- NOT a full chatbot — "keep it the base" (Brad's principle)
- MCP tools for external access: `chat_with_persona`, `ensemble_query`
- Claude API calls server-side for in-app ensemble queries
- Persona = system prompt + RAG context scoped to creator's content
- "Who's best" routing: simple topic match via cosine similarity of query embedding vs persona expertise centroid

## Visual Direction

**Vibe:** Ask the Panel
**Feel:** Intelligent layer on top of search. Knowledge tool, not chatbot.
**Inspiration:** Perplexity's answer panel above search results, ChatGPT's web search with sources

**Layout:**
```
┌──────────────────────────────────────────────┐
│  [🔍 Ask a question or search............]  │
│                                              │
│  ┌─ THE PANEL ───────────────────────────┐  │
│  │  "What's the best approach to RSC?"   │  │
│  │                                        │  │
│  │  ⭐ Best: @Fireship (web dev focus)   │  │
│  │                                        │  │
│  │  ┌ @Fireship ┐ ┌ @Prime ┐ ┌ @Theo ┐  │  │
│  │  │ streaming │ │streaming│ │stream │  │  │
│  │  │ response  │ │response │ │respns │  │  │
│  │  │ 📎 3 src  │ │📎 2 src│ │📎 1   │  │  │
│  │  └───────────┘ └────────┘ └───────┘  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ── Search Results ─────────────────────────  │
│  [By Video] [By Chunk]                       │
│  ... existing search results below ...       │
└──────────────────────────────────────────────┘
```

**Key Elements:**
- Search bar upgrades placeholder to "Ask a question or search..."
- Question detection triggers Panel (ends in ?, starts with how/what/why)
- Panel container with `bg-card` and border, distinct from search results
- Creator columns with avatar + name headers, markdown response body
- Expandable source citations linking to specific transcript chunks
- "Best match" star badge on most relevant persona
- Normal search results still appear below Panel

**Motion:**
- Skeleton shimmer while waiting for persona responses (table-stakes)
- Response text streaming animation — typewriter-style (table-stakes)
- Source citations expand/collapse transition (table-stakes)
- **Streaming text race**: all persona responses stream simultaneously, creating a visual 'race' effect as users watch all three build answers in real-time. "Best match" star appears when best persona finishes first.

## Dependencies

**Blocked by:** Story 2 (Discovery & Following) — needs channel/creator infrastructure
**Blocks:** None

## Acceptance

- [ ] Personas table stores channel-linked persona with system prompt, expertise topics, and expertise embedding
- [ ] Auto-suggestion banner appears on Knowledge Bank page when a channel hits 30+ transcripts
- [ ] User can create a persona from the suggestion (generates system prompt via Claude API)
- [ ] Search bar placeholder upgrades to "Ask a question or search..."
- [ ] Questions detected and trigger "The Panel" above search results
- [ ] Panel shows 2-3 persona responses streaming simultaneously (text race)
- [ ] "Best match" star badge on highest-scoring persona (cosine similarity routing)
- [ ] Source citations expand to show relevant transcript chunks
- [ ] Normal search results still appear below Panel
- [ ] `chat_with_persona` MCP tool works from external clients
- [ ] `ensemble_query` MCP tool returns multi-persona response
- [ ] Panel responsive on mobile (columns stack vertically)

## Chunks

### Chunk 1: Personas DB Schema, Service & CRUD API

**Goal:** Create the personas table, persona creation service (system prompt generation from content analysis), and CRUD API routes including 30+ transcript threshold detection.

**Files:**
- `src/lib/db/schema.ts` — modify (add `personas` table)
- `src/lib/personas/service.ts` — create (persona creation, system prompt generation, expertise extraction)
- `src/lib/personas/__tests__/service.test.ts` — create
- `src/app/api/personas/route.ts` — create (GET all, POST create)
- `src/app/api/personas/[id]/route.ts` — create (DELETE)
- `src/app/api/personas/suggest/route.ts` — create (GET channels at 30+ transcript threshold)

**Implementation Details:**
- `personas` table: `id` (serial PK), `channelName` (text, not null, unique), `name` (text, not null — display name), `systemPrompt` (text, not null — generated from content analysis), `expertiseTopics` (jsonb — array of topic strings), `expertiseEmbedding` (vector 384 — centroid of expertise chunks for routing), `transcriptCount` (integer — cached count at creation time), `createdAt` (timestamp)
- System prompt generation: analyze creator's most common topics from chunk embeddings clustering, extract writing style from transcript samples, build prompt like "You are [creator]. Your expertise is [topics]. You speak in a [style] way. Answer based on your content."
- Expertise embedding: average of top 20 most representative chunks (by proximity to channel centroid)
- Threshold detection API: query channels with 30+ videos in bank where no persona exists
- POST create: accepts channelName, generates system prompt + expertise via Claude API analysis
- DELETE: remove persona

**What Could Break:**
- System prompt generation requires Claude API call — needs ANTHROPIC_API_KEY
- Expertise extraction quality depends on having diverse, well-embedded content

**Done When:**
- [ ] Personas table exists with all fields
- [ ] POST creates persona with generated system prompt and expertise
- [ ] GET suggest returns channels eligible for persona creation
- [ ] DELETE removes persona
- [ ] System prompt captures creator's tone and expertise areas
- [ ] Expertise embedding stored for "who's best" routing

---

### Chunk 2: Single Persona Query & Streaming API

**Goal:** Create API endpoint for querying a single persona with streaming response, including RAG context scoping to the creator's content.

**Files:**
- `src/app/api/personas/[id]/query/route.ts` — create (POST streaming endpoint)
- `src/lib/personas/streaming.ts` — create (Claude API streaming coordinator)
- `src/lib/personas/context.ts` — create (RAG context scoper — fetch relevant chunks for creator)

**Implementation Details:**
- POST `/api/personas/[id]/query`: accepts `{ question: string }`, returns streaming text/event-stream response
- Context scoping: use existing `hybridSearch()` scoped to creator's channel name, fetch top 10 relevant chunks as context
- Streaming: use Anthropic SDK `messages.stream()` server-side, proxy SSE events to client via `ReadableStream`
- Response includes: persona name, streaming text, source chunk references (IDs + preview text)
- System prompt format: `[persona.systemPrompt]\n\nContext from your content:\n[relevant chunks]\n\nAnswer based on your content and expertise: [question]`
- Handle errors: timeout after 30s, return partial response if stream breaks
- AbortController for client disconnect cleanup

**What Could Break:**
- Claude API rate limits with concurrent persona queries
- Context window management — top 10 chunks + system prompt must fit in ~4K tokens
- SSE proxying through Next.js API routes

**Done When:**
- [ ] Single persona query returns streaming response
- [ ] Response scoped to creator's content via RAG
- [ ] Source chunks included in response
- [ ] Proper error handling and timeout
- [ ] AbortController cleanup on disconnect

---

### Chunk 3: Ensemble Query, Multi-Persona Streaming & "Who's Best"

**Goal:** Build ensemble query that fans out to 2-3 personas in parallel with streaming, plus "who's best" routing using expertise embeddings.

**Files:**
- `src/app/api/personas/ensemble/route.ts` — create (POST ensemble streaming endpoint)
- `src/lib/personas/ensemble.ts` — create (multi-stream coordinator + "who's best" logic)

**Implementation Details:**
- POST `/api/personas/ensemble`: accepts `{ question: string, personaIds?: number[] }`, returns SSE stream with persona-tagged events
- Multi-stream: create parallel Claude API streams (one per persona), emit events tagged with persona ID: `data: {"personaId": 1, "type": "delta", "text": "..."}`
- Event types: `persona_start` (name), `delta` (text chunk), `sources` (chunk refs), `best_match` (who's best result), `persona_done`, `all_done`
- "Who's best": embed the question using existing FastEmbed pipeline, cosine similarity against each persona's `expertiseEmbedding`, highest scorer gets star
- If no personaIds specified, use all personas (up to 3, sorted by best match)
- Error handling: if one persona stream fails, continue others, mark failed one with error state
- Token budget per persona: limit context to ~3K tokens each

**What Could Break:**
- Parallel Claude API streams may hit rate limits — stagger start (100ms delay) if needed
- SSE event ordering across streams — persona-tagged events solve this
- One persona failing shouldn't block others

**Done When:**
- [ ] Ensemble streams 2-3 persona responses in parallel
- [ ] Events properly tagged with persona ID
- [ ] "Who's best" star assigned based on expertise similarity
- [ ] Failed personas handled gracefully (others continue)
- [ ] Proper cleanup on disconnect

---

### Chunk 4: Panel UI — Question Detection, Container & Persona Columns

**Goal:** Detect questions in the search bar, render "The Panel" container above search results with streaming persona response columns.

**Files:**
- `src/components/videos/VideoSearch.tsx` — modify (upgrade placeholder, add question detection)
- `src/hooks/useEnsemble.ts` — create (manages ensemble query state, SSE parsing)
- `src/components/personas/PersonaPanel.tsx` — create (panel container with bg-card border)
- `src/components/personas/PersonaColumn.tsx` — create (individual persona response with streaming text)
- `src/components/personas/SourceCitation.tsx` — create (expandable source links)
- `src/app/page.tsx` — modify (insert Panel above SearchResults when question detected)

**Implementation Details:**
- Question detection: `query.endsWith('?') || /^(how|what|why|when|where|who|which|can|should|is|are|do|does)\b/i.test(query)`
- `useEnsemble(question)`: calls POST `/api/personas/ensemble`, parses SSE events, maintains state per persona `{personaId, name, text, sources, isDone, isError}`
- PersonaPanel: `bg-card border rounded-lg p-6` container, title shows the question, "Best: @Creator (topic)" badge, then 3-column grid
- PersonaColumn: creator name header, streaming text body (simple text append for MVP), expandable "N sources" footer
- SourceCitation: Collapsible component showing chunk preview text + link to video timestamp
- "Best match" star: Badge on best-scoring persona column header
- Panel appears above SearchResults, normal search results still show below
- On mobile: columns stack vertically
- Skeleton: 3-column shimmer while waiting for first events

**What Could Break:**
- Question detection false positives on normal search terms
- SSE parsing edge cases
- Panel + search results vertical space management

**Done When:**
- [ ] Question detection triggers Panel display
- [ ] Normal search still works when not a question
- [ ] 3 persona columns stream simultaneously (text race effect)
- [ ] "Best match" star on highest-scoring persona
- [ ] Source citations expand/collapse
- [ ] Search results still appear below Panel
- [ ] Responsive: columns stack on mobile

---

### Chunk 5: MCP Tools & Persona Suggestion Banner

**Goal:** Expose personas as MCP tools for external clients and add auto-suggestion banner when channels hit 30+ transcripts.

**Files:**
- `src/lib/mcp/tools.ts` — modify (add `chat_with_persona` and `ensemble_query` tools)
- `src/components/personas/PersonaSuggestion.tsx` — create (banner for persona creation suggestions)
- `src/app/page.tsx` — modify (show persona suggestion banner when eligible channels exist)

**Implementation Details:**
- `chat_with_persona` MCP tool: schema `{ personaName: string, question: string }`, handler calls persona query, returns text response (non-streaming for MCP)
- `ensemble_query` MCP tool: schema `{ question: string }`, handler calls ensemble, waits for all responses, returns formatted multi-persona response
- Follow existing MCP tool pattern from `search_rag` and `get_list_of_creators`
- PersonaSuggestion banner: "@Fireship has 30+ transcripts — Create a persona agent?" with "Create" and "Dismiss" buttons
- Show on Knowledge Bank page when `/api/personas/suggest` returns eligible channels
- Dismissal stored in localStorage (key per channel)
- Creating: calls POST `/api/personas`, shows success toast

**What Could Break:**
- MCP tool response format must match expected schema
- Banner persistence needs localStorage management

**Done When:**
- [ ] `chat_with_persona` MCP tool works from external clients
- [ ] `ensemble_query` MCP tool returns multi-persona response
- [ ] Persona suggestion banner shows for eligible channels
- [ ] "Create" generates persona with loading state
- [ ] "Dismiss" hides banner persistently

---

### Chunk 6: Polish, Animations & Edge Cases

**Goal:** Add streaming text race animation, skeleton loading, responsive layout polish, and handle all edge cases.

**Files:**
- `src/components/personas/PersonaPanel.tsx` — modify (skeleton shimmer, responsive grid)
- `src/components/personas/PersonaColumn.tsx` — modify (typewriter cursor, streaming animation)
- `src/components/personas/SourceCitation.tsx` — modify (expand/collapse transition)
- `src/app/page.tsx` — modify (no-personas empty state, error states)

**Implementation Details:**
- Streaming text race: all columns stream simultaneously, text appends in real-time, pulsing cursor at end
- Skeleton: 3-column shimmer grid with `animate-pulse` while waiting for first event
- Typewriter cursor: `▌` character with `animate-pulse` at end of streaming text, removed when done
- Source citation transition: shadcn Collapsible with 200ms ease
- "Best match" star fade-in when determined
- No-personas state: "Follow creators and build your knowledge bank to unlock persona queries"
- Error state: friendly error with retry button
- Mobile responsive: Panel columns stack vertically, full width
- Reduced motion: skip typewriter effect, show text instantly
- Final sweep: all states render correctly, no console errors

**What Could Break:**
- Typewriter cursor flicker on fast streams
- Mobile layout with long streaming text

**Done When:**
- [ ] Streaming text race visual effect works
- [ ] Skeleton loading before first events
- [ ] Typewriter cursor pulses during streaming
- [ ] Source citations animate open/close
- [ ] "Best match" star fades in
- [ ] No-personas empty state guides users
- [ ] Error states with retry
- [ ] Responsive on mobile
- [ ] No console errors

## Notes

- Personas table: id, channelName, name, systemPrompt, expertiseTopics, expertiseEmbedding, transcriptCount, createdAt
- System prompt generation: analyze creator's content themes, writing style, expertise areas via Claude API
- Ensemble UI: ask once -> fan out to 2-3 personas -> show responses side-by-side
- "Who's best" uses cosine similarity of query embedding vs persona expertise centroid (simple topic match)
- MCP tools extend existing MCP server in src/lib/mcp/tools.ts
- Keep personas agnostic — learned from content, not hard-coded
- Question detection: ends in ?, starts with how/what/why/when/where/who/which/can/should/is/are/do/does
- Token budget: ~3K per persona context to manage costs
- Rate limiting: consider staggered starts for parallel Claude API streams
