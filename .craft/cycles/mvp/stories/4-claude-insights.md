---
name: claude-insights
title: Claude Insights
status: ready
priority: high
created: 2026-02-03
updated: 2026-02-03
cycle: mvp
story_number: 4
chunks_total: 5
chunks_complete: 0
---

# Story: Claude Insights

## Spark

The "gold" in Gold Miner — Claude-powered knowledge extraction using "The Insights Tab" pattern. On the video detail page, a tab system shows Transcript and Insights. The Insights tab displays cards for each action type that transform from CTA to streaming content to persisted results. MVP includes 3 core actions: Extract Insights (key takeaways), Summarize (quick overview), and Suggest Plugins (Claude Code skills, commands, agents). Uses Claude SDK with local agent token — results persist so users build a "dossier" per video.

## Dependencies

**Blocked by:** Story 3 (Knowledge Bank) — needs video detail page with transcript
**Blocks:** None

## Acceptance

- [ ] Video detail page has Transcript | Insights tabs
- [ ] Insights tab shows 3 action cards (Insights, Summary, Plugins)
- [ ] Cards show "Not yet generated" with Generate button initially
- [ ] Clicking Generate starts streaming with typing cursor
- [ ] Streaming output appears word-by-word in card
- [ ] Completed results show with timestamp and Regenerate option
- [ ] Results persist to database
- [ ] Revisiting video shows previously generated insights
- [ ] Regenerate overwrites previous result
- [ ] Error state with retry option on API failure
- [ ] Cancel button during generation

## Chunks

### Chunk 1: Claude SDK Integration

**Goal:** Set up Claude SDK with agent token and create the core generation function.

**Files:**
- `src/lib/claude/client.ts` — create (Claude client setup)
- `src/lib/claude/types.ts` — create (types for insights)
- `.env.local` — modify (add ANTHROPIC_API_KEY placeholder)
- `package.json` — modify (add @anthropic-ai/sdk)

**Implementation Details:**
- Install `@anthropic-ai/sdk`
- Create Claude client singleton:
  ```typescript
  import Anthropic from '@anthropic-ai/sdk';

  export const claude = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  ```
- Create streaming helper function:
  ```typescript
  export async function* streamCompletion(
    systemPrompt: string,
    userPrompt: string
  ): AsyncGenerator<string> {
    const stream = await claude.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        yield event.delta.text;
      }
    }
  }
  ```
- Types for insight results:
  ```typescript
  type InsightType = 'insights' | 'summary' | 'plugins';

  interface InsightResult {
    id: string;
    videoId: string;
    type: InsightType;
    content: string;
    createdAt: Date;
  }
  ```

**What Could Break:**
- API key not set — clear error message
- Rate limiting — implement retry with backoff

**Done When:**
- [ ] Claude SDK installed and configured
- [ ] Streaming helper function works
- [ ] Types defined for all insight types
- [ ] Client can make successful API calls

---

### Chunk 2: Prompt Templates

**Goal:** Create prompt templates for the 3 core actions with structured output.

**Files:**
- `src/lib/claude/prompts/insights.ts` — create
- `src/lib/claude/prompts/summary.ts` — create
- `src/lib/claude/prompts/plugins.ts` — create
- `src/lib/claude/prompts/index.ts` — create (exports)

**Implementation Details:**

**Extract Insights prompt:**
- System: Expert knowledge extractor focused on actionable takeaways
- Input: Video title, channel, full transcript
- Output structure:
  ```markdown
  ## Key Insights

  ### 1. [Insight Title]
  [Explanation of the insight]

  ### 2. [Insight Title]
  ...

  ## Techniques Mentioned
  - [Technique 1]: [Brief explanation]
  - [Technique 2]: [Brief explanation]

  ## Quotable Moments
  > "[Notable quote]" — [Context]
  ```

**Summarize prompt:**
- System: Concise summarizer, captures essence in 2-3 paragraphs
- Input: Video title, channel, transcript
- Output: 2-3 paragraph summary with key points

**Suggest Plugins prompt:**
- System: Claude Code expert, suggests practical customizations
- Input: Video title, transcript, context about Claude Code plugins
- Output structure:
  ```markdown
  ## Suggested Claude Code Customizations

  ### Skill: [Name]
  **Purpose:** [What it does]
  **Trigger:** [When to use it]
  **Example usage:** [Brief example]

  ### Command: [Name]
  **Purpose:** [What it does]
  **Arguments:** [Expected args]
  **Example:** `/command arg1 arg2`

  ### Agent: [Name]
  **Purpose:** [What specialized task it handles]
  **Tools needed:** [What tools it would use]
  ```

**What Could Break:**
- Prompt engineering may need iteration
- Output format consistency — instruct clearly in system prompt

**Done When:**
- [ ] All 3 prompt templates defined
- [ ] Each produces well-structured output
- [ ] Prompts handle edge cases (short transcripts, etc.)

---

### Chunk 3: Insights Database Schema & API

**Goal:** Add insights table and API routes for generating and retrieving insights.

**Files:**
- `src/lib/db/schema.ts` — modify (add insights table)
- `src/app/api/videos/[id]/insights/route.ts` — create
- `src/app/api/videos/[id]/insights/[type]/route.ts` — create

**Implementation Details:**

**Insights table schema:**
```typescript
export const insights = sqliteTable('insights', {
  id: text('id').primaryKey(),
  videoId: text('video_id').notNull().references(() => videos.id),
  type: text('type').notNull(), // 'insights' | 'summary' | 'plugins'
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

**GET /api/videos/[id]/insights:**
- Returns all insights for a video
- `{ insights: { insights?: InsightResult, summary?: InsightResult, plugins?: InsightResult } }`

**POST /api/videos/[id]/insights/[type]:**
- Generates insight of specified type
- Returns Server-Sent Events stream
- On completion, saves to database
- Body: `{ regenerate?: boolean }` (if true, replaces existing)

**Streaming response pattern:**
```typescript
export async function POST(req, { params }) {
  const { id, type } = params;

  // Get video and transcript
  const video = await getVideo(id);
  if (!video) return Response.json({ error: 'Not found' }, { status: 404 });

  // Get prompt template
  const prompt = getPromptForType(type, video);

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = '';

      for await (const chunk of streamCompletion(prompt.system, prompt.user)) {
        fullContent += chunk;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
      }

      // Save to database
      await saveInsight(id, type, fullContent);

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

**What Could Break:**
- SSE streaming in Next.js App Router — use ReadableStream
- Long transcripts may exceed context — consider chunking

**Done When:**
- [ ] Insights table created and migrated
- [ ] GET route returns existing insights
- [ ] POST route streams new insights
- [ ] Results persist to database
- [ ] Regenerate replaces existing

---

### Chunk 4: Tab UI & Insight Cards

**Goal:** Create the tab system and insight card components for the video detail page.

**Files:**
- `src/app/videos/[id]/page.tsx` — modify (add tabs)
- `src/components/insights/InsightsTabs.tsx` — create
- `src/components/insights/InsightCard.tsx` — create
- `src/components/insights/InsightsPanel.tsx` — create
- `src/components/ui/tabs.tsx` — create (via shadcn/ui)

**Implementation Details:**

**Install shadcn/ui Tabs:**
```bash
npx shadcn@latest add tabs
```

**InsightsTabs component:**
- Two tabs: Transcript | Insights
- Transcript tab shows existing TranscriptView
- Insights tab shows InsightsPanel

**InsightCard component:**
Three states per locked decision:

1. **Empty state:**
   ```tsx
   <Card>
     <CardHeader>
       <Icon /> {title}
     </CardHeader>
     <CardContent>
       <p className="text-muted-foreground">{description}</p>
       <p className="text-sm text-muted-foreground">Not yet generated</p>
     </CardContent>
     <CardFooter>
       <Button onClick={onGenerate}>Generate</Button>
     </CardFooter>
   </Card>
   ```

2. **Streaming state:**
   ```tsx
   <Card className="border-primary">
     <CardHeader>
       <Icon /> {title}
       <Badge>Generating...</Badge>
     </CardHeader>
     <CardContent>
       <div className="prose prose-sm">
         {streamedContent}
         <span className="animate-pulse">▌</span>
       </div>
     </CardContent>
     <CardFooter>
       <Button variant="ghost" onClick={onCancel}>Cancel</Button>
     </CardFooter>
   </Card>
   ```

3. **Complete state:**
   ```tsx
   <Card className="border-primary/30">
     <CardHeader>
       <Icon /> {title}
       <span className="text-xs text-muted-foreground">
         Generated {formatDate(createdAt)}
       </span>
     </CardHeader>
     <CardContent>
       <div className="prose prose-sm max-h-96 overflow-y-auto">
         {/* Render markdown content */}
       </div>
     </CardContent>
     <CardFooter>
       <Button variant="outline" onClick={onRegenerate}>Regenerate</Button>
     </CardFooter>
   </Card>
   ```

**InsightsPanel component:**
- 2-column grid (1 col on mobile)
- Renders InsightCard for each type: insights, summary, plugins
- Fetches existing insights on mount
- Manages generation state per card

**What Could Break:**
- Markdown rendering — use react-markdown or similar
- Card height consistency during streaming

**Done When:**
- [ ] Tab system switches between Transcript and Insights
- [ ] Cards show correct state (empty/streaming/complete)
- [ ] Streaming content appears with cursor animation
- [ ] Completed cards show formatted markdown
- [ ] Regenerate triggers new generation

---

### Chunk 5: Streaming Integration & Error Handling

**Goal:** Wire up the streaming API to the UI with proper error handling and state management.

**Files:**
- `src/hooks/useInsightGeneration.ts` — create
- `src/components/insights/InsightCard.tsx` — modify
- `src/components/insights/InsightsPanel.tsx` — modify

**Implementation Details:**

**useInsightGeneration hook:**
```typescript
export function useInsightGeneration(videoId: string, type: InsightType) {
  const [state, setState] = useState<'idle' | 'loading' | 'streaming' | 'error'>('idle');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const generate = async (regenerate = false) => {
    setState('loading');
    setContent('');
    setError(null);

    abortController.current = new AbortController();

    try {
      const response = await fetch(`/api/videos/${videoId}/insights/${type}`, {
        method: 'POST',
        body: JSON.stringify({ regenerate }),
        signal: abortController.current.signal,
      });

      if (!response.ok) throw new Error('Failed to generate');

      setState('streaming');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.chunk) {
            setContent(prev => prev + data.chunk);
          }
          if (data.done) {
            setState('idle');
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setState('idle');
      } else {
        setState('error');
        setError(err.message);
      }
    }
  };

  const cancel = () => {
    abortController.current?.abort();
  };

  return { state, content, error, generate, cancel };
}
```

**Error handling:**
- Network errors: Show toast with retry button
- API errors: Display in card with retry option
- Abort: Clean cancellation, no error shown

**Loading states:**
- Initial load: Skeleton cards
- Generation: "Generating..." badge with spinner
- Cancel: Immediate stop, content retained

**What Could Break:**
- SSE parsing edge cases — handle partial messages
- Memory leaks from uncanceled requests — cleanup on unmount

**Done When:**
- [ ] Streaming works end-to-end
- [ ] Cancel stops generation cleanly
- [ ] Errors display with retry option
- [ ] Previously generated insights load on page visit
- [ ] Multiple cards can be in different states
- [ ] No memory leaks on navigation

## Notes

- MVP includes 3 actions: Extract Insights, Summarize, Suggest Plugins
- Training Doc, Quiz, Code Snippets deferred to polish cycle
- Uses "The Insights Tab" pattern (locked)
- Claude SDK with agent token (no user API key)
- Results persist — users build a "dossier" per video
- Streaming via Server-Sent Events
- Consider caching/memoization for cost efficiency in future
