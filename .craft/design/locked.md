# Locked Patterns

Patterns that have been approved and should be followed consistently.

---

## Design Vibe: Prospector's Clarity

**Locked:** 2026-02-03
**Context:** Established during MVP cycle planning based on LoopOps inspiration

### The Feeling
Gold Miner should feel like a well-organized workshop where valuable knowledge is extracted and refined. Clean but not sterile. Professional but approachable. The UI gets out of the way so the content — the "gold" — shines.

### What This Vibe IS
- Warm and professional
- Content-first, generous whitespace
- Smooth, elegant motion
- Clear visual hierarchy

### What This Vibe Is NOT
- Sterile corporate
- Busy or cluttered
- Playful/gamified
- Dark/moody

---

## Layout Decisions

### Navigation
**Type:** layout
**Choice:** sidebar
**Locked:** 2026-02-03
**Context:** Linear-style persistent sidebar for power-user navigation

**Specification:**
- Persistent left sidebar on all pages
- Logo at top
- Navigation links: Knowledge Bank, Add Video, Discovery, Settings
- Collapsed state on mobile (hamburger)

### Knowledge Bank Page
**Type:** layout
**Choice:** dashboard
**Locked:** 2026-02-03
**Context:** "The Dashboard" design — makes users feel proud of their collection, transforms it from "video bookmarks" into "my knowledge vault"

**Specification:**

**Stats Header:**
- Three stat cards at top showing collection value:
  - Video count ("12 videos")
  - Total content hours ("4.2 hrs of content")
  - Channel count ("8 channels")
- Stats update as collection grows — creates rewarding loop
- Subtle background, doesn't compete with content

**Search Bar:**
- Prominent search input below stats
- Placeholder: "Search videos and transcripts..."
- Real-time filtering (debounced 300ms)
- Clear button when has value

**Card Grid:**
- Responsive grid (1 col mobile → 4 col desktop)
- Cards show: thumbnail (with duration badge), title, channel, date added
- Hover state with subtle shadow lift
- Click navigates to `/videos/[id]`

**Empty State ("The Promise"):**
```
🏔️ ✨

Start building your knowledge vault

Save videos • Search transcripts • Extract insights

[ Add Your First Video ]
```
- Inspirational, not cutesy
- Clear CTA linking to `/add`
- Mountain/sparkle icon suggests discovery and value

**Not Allowed:**
- Plain list without stats header
- Pagination (use infinite scroll or load more if needed)
- Complex filtering UI (search covers most needs)

### Video Detail View
**Type:** layout
**Choice:** full page
**Locked:** 2026-02-03
**Context:** Immersive reading experience for long transcripts

**Specification:**
- Dedicated route: `/videos/[id]`
- Embedded video player at top
- Full transcript below with timestamps
- Metadata sidebar or header
- Claude action buttons prominent

### Discovery Feed
**Type:** layout
**Choice:** unified video grid
**Locked:** 2026-02-03
**Updated:** 2026-02-08
**Context:** "Inline Add with Quick Actions" — clear mental model, easy scanning, no modals. Unlocked grid layout and pagination for better browsing experience.

**Specification:**

**Page Header:**
- Title: "Discovery"
- "Follow a Channel" button (collapsed state) + "Refresh" button
- Clicking "Follow" expands to inline input

**Channel Follow Input (Expanded):**
- Text input: "Paste YouTube channel URL..."
- Follow button + Cancel button
- Accepts: @handle, /channel/ID, /c/name formats
- Shows preview with channel name before confirming

**Video Grid:**
- Unified responsive grid of all discovery videos (not grouped by channel)
- Responsive columns: 1 col mobile → 2 col sm → 3 col md → 4 col lg → 5 col xl
- Gap-6 spacing between cards
- Client-side pagination: 24 videos per page
- Videos sorted by publishedAt descending (newest first)

**Video Cards (Discovery):**
- Thumbnail (16:9, rounded-lg)
- Duration badge (bottom-right)
- Title (truncate 2 lines)
- Published date ("3 days ago")
- "Add to Bank" button
- "✓ In Bank" badge if already added
- Focus area badges for videos already in Knowledge Bank (read-only, no quick-assign)

**Pagination:**
- Appears at bottom when more than one page
- Page numbers with prev/next buttons
- Max ~7 visible page buttons with ellipsis for large page counts
- Current page highlighted with primary color
- Disabled state for prev/next at bounds

**"Add to Bank" Flow:**
- Click → Navigate to `/add?url=VIDEO_URL`
- URL is prefilled on Add Video page
- User just needs to paste transcript
- After adding, card shows "✓ In Bank" badge

**Empty State:**
```
🔭

Discover content worth mining

Follow YouTube channels to see their latest videos.
Cherry-pick the gold and add it to your bank.

┌─────────────────────────────────────┐
│ Paste YouTube channel URL...        │  [ Follow ]
└─────────────────────────────────────┘

Examples:
• youtube.com/@fireship
• youtube.com/c/ThePrimeagen
• youtube.com/channel/UC...
```

**Density Note:**
Discovery is a "browse" page — denser layout is acceptable. Grid layout with pagination keeps the page scannable while handling many videos across multiple channels.

**Not Allowed:**
- Modal for channel management
- Inline transcript paste (use Add Video page)
- Server-side pagination for Discovery videos (client-side only)
- Focus area quick-assign dropdown on Discovery cards (badges only)

### Settings Page
**Type:** layout
**Choice:** full page
**Locked:** 2026-02-03
**Context:** Full settings with theme, preferences, data export

**Specification:**
- Dedicated route: `/settings`
- Sections: Appearance (theme), Preferences, Data Management
- Toggle for dark/light mode
- Export data functionality

### Add Video Page
**Type:** layout
**Choice:** conversational flow
**Locked:** 2026-02-03
**Context:** Single page with progressive disclosure, feels guided not form-like

**Specification:**
- Single scrolling page, not a wizard with steps
- Conversational prompts guide the user: "What video would you like to add?"
- URL input at top → validates → reveals video preview card
- Video preview shows thumbnail, title, channel with "✓ Looks good" confirmation
- Transcript section appears below after URL confirmed
- "How do I get this?" link expands inline instructions (collapsible)
- Tags and notes fields below transcript (optional)
- Single CTA at bottom: "Add to Knowledge Bank"

**Flow:**
```
1. User pastes URL
2. Video preview appears (or manual fallback fields if oEmbed fails)
3. User scrolls down to transcript section
4. Instructions available inline if needed
5. User pastes transcript
6. Optional: adds tags/notes
7. Clicks "Add to Knowledge Bank"
8. Success state with celebration
```

**Not Allowed:**
- Step indicators (1, 2, 3)
- Modal overlays
- Split panel layout
- Navigation between "steps"

---

## Component Decisions

### Search
**Type:** component
**Choice:** inline
**Locked:** 2026-02-03
**Updated:** 2026-02-06
**Context:** Instant feedback, no mode switching — now with hybrid RAG search

**Specification:**
- Search input in Knowledge Bank header
- Results filter in real-time as user types (debounced 300ms)
- **Hybrid search:** Vector similarity + keyword matching combined with Reciprocal Rank Fusion (RRF)
- Three modes available: vector, keyword, hybrid (default)
- Results grouped by video with chunk previews
- Clear button to reset

### Claude Insights UI
**Type:** layout
**Choice:** tabs
**Locked:** 2026-02-03
**Context:** "The Insights Tab" — makes AI extraction feel like building valuable knowledge artifacts, not just chatting with AI

**Specification:**

**Tab System:**
- Video detail page has two tabs below video: **Transcript | Insights**
- Transcript tab: timestamped transcript (default view)
- Insights tab: all Claude-generated content for this video

**Insight Cards:**
Each action type gets a card with three states:

1. **Empty state:** "Not yet generated" + [ Generate ] button
2. **Streaming state:** Content appears with typing cursor, card expands
3. **Complete state:** Full result + [ Regenerate ] button + timestamp

**Action Types:**

*MVP (3 cards):*
| Action | Icon | Description |
|--------|------|-------------|
| Extract Insights | ✨ | Key takeaways and techniques |
| Summarize | 📝 | Quick overview |
| Suggest Plugins | 🔌 | Claude Code skills, commands, agents |

*Future (post-MVP):*
| Action | Icon | Description |
|--------|------|-------------|
| Generate Training Doc | 📄 | Structured learning material |
| Generate Quiz | ❓ | Comprehension questions |
| Extract Code Snippets | 💻 | Code with explanations |

**Card Layout:**
- 2-column grid on desktop (responsive to 1 col on mobile)
- Cards have consistent height in empty state
- Expand vertically when populated
- Rich green accent on generated cards

**Streaming Behavior:**
- Text appears word-by-word with subtle cursor
- Card expands smoothly as content grows
- "Generating..." indicator at card header
- Cancel button during generation

**Persistence:**
- Results saved to database on completion
- "Generated Jan 15, 2026" timestamp on completed cards
- Regenerate overwrites previous result

**Not Allowed:**
- Modal overlays for output
- Output appearing below transcript (use tab instead)
- Generic chat-style interface
- Output that doesn't persist

---

## State Patterns

### Success State
**Type:** component
**Choice:** subtle confirmation
**Locked:** 2026-02-03
**Context:** Professional and satisfying without being flashy — fits "Prospector's Clarity"

**Specification:**
- Green checkmark icon (primary color)
- Clear, direct message: "Added to Knowledge Bank"
- Smooth fade-in animation (200ms)
- Optional: subtle green border/glow that fades
- Toast notification for non-blocking confirmations

**Examples:**
- Add Video success: Full-screen transition to success state with video thumbnail, "Added to Knowledge Bank!", two buttons
- Insight generated: Card border briefly glows green, "Generated" timestamp appears
- Channel followed: Toast: "✓ Following [Channel Name]"

**Not Allowed:**
- Confetti or particle effects
- Sound effects
- Badges or achievement unlocks
- Bouncy/playful animations

### Error State
**Type:** component
**Choice:** helpful and warm
**Locked:** 2026-02-03
**Context:** Errors should guide, not alarm

**Specification:**
- Warm, conversational tone: "Hmm, that didn't work" not "Error 500"
- Red accent but not aggressive (use error token, not pure red)
- Clear action: what to do next
- Icon: subtle warning, not alarming exclamation

**Copy Examples:**
- "We couldn't find that video. Check the URL and try again."
- "Something went wrong generating insights. [Retry]"
- "Couldn't connect to YouTube. Check your connection."

**Not Allowed:**
- Technical jargon ("500 Internal Server Error")
- Blame language ("You entered an invalid URL")
- Empty error states with no guidance

### Loading State
**Type:** component
**Choice:** skeleton + spinner
**Locked:** 2026-02-03
**Context:** Show structure early, indicate activity

**Specification:**
- **Cards/Lists:** Skeleton placeholders matching content shape
- **Actions:** Subtle spinner in button, button disabled
- **Full page:** Skeleton layout matching page structure
- **Streaming:** Typing cursor (▌) with pulse animation

**Animation:**
- Skeleton: subtle shimmer (left-to-right gradient)
- Spinner: simple rotation, primary color
- Pulse: gentle opacity change (not flashy)

**Not Allowed:**
- Blank loading screens
- "Loading..." text without visual
- Aggressive spinners that dominate the view

---

## Token Locks

### Primary Color
**Locked:** 2026-02-03
**Value:** `#059669` (rich green)
**Context:** Growth, value, discovery — fits "Gold Miner" theme

### Primary Hover
**Locked:** 2026-02-03
**Value:** `#047857`

### Typography
**Locked:** 2026-02-03
**Value:** Inter (with system fallbacks)
**Context:** Modern, widely available, readable

### Border Radius
**Locked:** 2026-02-03
**Value:** Soft (12-24px for cards, 8px for inputs, 9999px for pills)
**Context:** Friendly, modern feel from LoopOps inspiration

### Spacing Philosophy
**Locked:** 2026-02-03
**Value:** Generous
**Context:** Content breathes, not cramped

---

---

## Technical Patterns

### Hybrid Search with RRF

**Locked:** 2026-02-06
**Location:** `src/lib/search/hybrid-search.ts`

**Description:** Sophisticated search combining vector similarity (pgvector) and keyword matching using Reciprocal Rank Fusion algorithm.

**Key elements:**
- Three modes: vector, keyword, hybrid (default)
- RRF constant k=60 for balanced fusion
- Fetches 2x results from each method before fusion
- Local FastEmbed embeddings (`all-MiniLM-L6-v2`, 384 dimensions)
- Results grouped by video with chunk previews

---

### Agent Server Architecture

**Locked:** 2026-02-06
**Location:** `src/agent/`

**Description:** Separate WebSocket server for Claude Agent SDK integration, runs concurrently with Next.js dev server.

**Key elements:**
- Token-based authentication (`.agent-token` file)
- Graceful shutdown with cleanup
- Runs via `npm run dev` (concurrently with Next.js)
- Handles chat sessions with video context

---

### Embedding Pipeline with Progress

**Locked:** 2026-02-06
**Location:** `src/lib/embeddings/service.ts`

**Description:** Batched embedding generation with progress callbacks and database transaction handling.

**Key elements:**
- Batch size of 32 for optimal throughput
- Progress callback after each batch
- Error handling per chunk (continues on failure)
- Transaction-based database storage (delete old + insert new)
- Timestamps stored in seconds, processing in milliseconds

---

### Zod Validation at API Boundaries

**Locked:** 2026-02-06
**Location:** `src/app/api/*/route.ts`

**Description:** Request validation with Zod schemas at all API entry points.

**Key elements:**
- Schema defined near route handler
- `safeParse()` for validation
- User-friendly error messages extracted from first error
- Consistent 400 response format
- Type inference from Zod schema

---

### Colocated Tests

**Locked:** 2026-02-06
**Location:** `src/**/__tests__/`

**Description:** Tests organized in `__tests__/` directories next to the code they test, grouped by domain.

**Key elements:**
- Unit tests for components (React Testing Library)
- Integration tests for API routes
- Mocked Next.js primitives (Image, Link)
- Vitest with jsdom environment
- Database tests use better-sqlite3 for speed

---

### Global Extraction Store

**Locked:** 2026-02-08
**Location:** New `ExtractionProvider` context + refactored `useExtraction` hook

**Decision:** Lift extraction state from component-level `useState` into an app-level `ExtractionProvider` context so insight generation progress survives navigation.

**Key elements:**
- `ExtractionProvider` wraps app alongside existing `AgentProvider`
- Global store: `Map<videoId, ExtractionState>` holding overall status, per-section status, partial results
- `useExtraction(videoId)` reads/writes from context instead of local state
- WebSocket callbacks update the global store even when the video page is unmounted
- Cleanup: evict entry from store after DB persistence succeeds

**Rationale:** Option A chosen over lightweight activity tracker (loses streaming UX on return) and persist-and-resume (overkill DB schema changes for sub-30s extractions).

**Not Allowed:**
- Component-level state for extraction progress (won't survive navigation)
- Polling-based "is it done yet?" approach (loses live streaming feel)
- DB-backed partial persistence (unnecessary complexity for this use case)

---

## How to Use These Locks

1. **During implementation:** Reference these decisions, don't deviate
2. **If you need to change:** Ask first, unlock explicitly
3. **New patterns:** Add them here when approved

## Unlocking

To change a locked decision:
1. Explain why the lock should be removed
2. Propose the replacement
3. Get explicit approval
4. Update this file
