---
name: claude-insights
title: Claude Insights
status: active
priority: high
created: 2026-02-03
updated: 2026-02-04
cycle: mvp
story_number: 4
chunks_total: 5
chunks_complete: 0
---

# Story: Claude Insights

## Spark

The "gold" in Gold Miner — Claude-powered knowledge extraction using a **Single Smart Button** pattern. On the video detail page, a tab system shows Transcript and Insights. The Insights tab has one "Extract Insights" button that:

1. **Analyzes the transcript** to determine content type (dev tutorial, meeting, talk, etc.)
2. **Runs appropriate extractions in parallel** based on content type
3. **Shows all results in a unified streaming view** with copy buttons

**Universal extractions (all content):**
- Summary (TL;DR + overview + key points)
- Key Insights (timestamped, actionable takeaways)
- Action Items (immediate, short-term, long-term)

**Dev-specific extractions (technical content only):**
- Claude Code Plugins: Skills, Commands, Agents, Hooks, Rules
- Copy-paste ready format for `.claude/` directory

Uses **Local Agent Architecture** — a terminal-based agent leverages `@anthropic-ai/claude-agent-sdk` to use Claude Code's existing authentication (no API key needed). Results persist so users build a "dossier" per video.

## Dependencies

**Blocked by:** Story 3 (Knowledge Bank) — needs video detail page with transcript
**Blocks:** None

## Acceptance

- [ ] Video detail page has Transcript | Insights tabs
- [ ] Insights tab shows single "Extract Insights" button initially
- [ ] Clicking Extract starts unified streaming view with all sections
- [ ] Sections stream in sequence: Summary → Key Insights → Action Items → (Claude Code Plugins if dev content)
- [ ] Each section shows status: ○ Pending → ● Working → ✓ Done
- [ ] Streaming output appears word-by-word with cursor animation
- [ ] Each completed section has [Copy] button
- [ ] Claude Code Plugins section has expandable items with individual [Copy] buttons
- [ ] Copy buttons copy exact format ready for `.claude/` directory
- [ ] Results persist to database on completion
- [ ] Revisiting video shows previously generated insights immediately
- [ ] [Regenerate] button overwrites previous results
- [ ] [Cancel] button during generation
- [ ] Error state with retry option on API failure
- [ ] Agent auto-starts with `npm run dev`
- [ ] Token auto-injected (no manual copy/paste)
- [ ] Clean shutdown when dev server stops (no orphan processes)

## Architecture: Local Agent Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                        npm run dev                                   │
├─────────────────────────────────────────────────────────────────────┤
│  concurrently --kill-others:                                         │
│                                                                      │
│  1. Agent Process (port 9333)                                        │
│     ├── Generates token → writes to .agent-token                     │
│     ├── Starts WebSocket server                                      │
│     ├── Uses @anthropic-ai/claude-agent-sdk (reads macOS Keychain)   │
│     └── Handles SIGINT/SIGTERM for clean shutdown                    │
│                                                                      │
│  2. Next.js Process (port 3000)                                      │
│     ├── /api/agent/token reads .agent-token                          │
│     ├── Client fetches token, connects to ws://localhost:9333        │
│     └── Proxies insight generation through agent                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- No ANTHROPIC_API_KEY needed — uses Claude Code's OAuth session
- Local-only design — perfect for personal knowledge base
- Clean DX — one command starts everything

## Chunks

### Chunk 1: Local Agent Infrastructure

**Goal:** Create the local agent that uses Claude Agent SDK and auto-connects to the web app.

**Files:**
- `src/agent/index.ts` — create (agent entry point)
- `src/agent/server.ts` — create (WebSocket server)
- `src/agent/auth.ts` — create (token generation)
- `src/agent/chat.ts` — create (Claude Agent SDK integration)
- `src/lib/agent/connection.ts` — create (browser WebSocket client)
- `src/lib/agent/AgentProvider.tsx` — create (React context)
- `src/app/api/agent/token/route.ts` — create (token endpoint)
- `scripts/start-agent.ts` — create (CLI startup script)
- `package.json` — modify (add deps + concurrent dev script)
- `.gitignore` — modify (add .agent-token)

**Implementation Details:**

**Install dependencies:**
```bash
npm install @anthropic-ai/claude-agent-sdk ws concurrently nanoid chalk tsx
npm install -D @types/ws
```

**Agent entry (src/agent/index.ts):**
```typescript
#!/usr/bin/env npx tsx
import { createServer } from './server'
import { generateToken } from './auth'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import chalk from 'chalk'

const PORT = 9333
const TOKEN_FILE = '.agent-token'

// Clean up stale token on startup
if (existsSync(TOKEN_FILE)) unlinkSync(TOKEN_FILE)

const token = generateToken()
const server = createServer({ port: PORT, token })

// Write token for Next.js to read
writeFileSync(TOKEN_FILE, token)

console.log(chalk.cyan(`🔧 Gold Miner Agent running on port ${PORT}`))
console.log(chalk.gray(`   Token: ${token}`))

// Graceful shutdown
const shutdown = async () => {
  console.log(chalk.yellow('\n[Agent] Shutting down...'))
  await server.stop()
  if (existsSync(TOKEN_FILE)) unlinkSync(TOKEN_FILE)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.start()
```

**Token generation (src/agent/auth.ts):**
```typescript
import { nanoid } from 'nanoid'

export function generateToken(): string {
  // Short readable token: abc-123-xyz
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let g = 0; g < 3; g++) {
    if (g > 0) token += '-'
    for (let i = 0; i < 3; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return token
}

export function validateToken(provided: string, expected: string): boolean {
  return provided === expected
}
```

**WebSocket server (src/agent/server.ts):**
```typescript
import { WebSocketServer, WebSocket } from 'ws'
import { EventEmitter } from 'events'
import { validateToken } from './auth'
import { handleInsightRequest, cancelInsight } from './chat'

interface ServerOptions {
  port: number
  token: string
}

export function createServer(options: ServerOptions) {
  const emitter = new EventEmitter()
  let wss: WebSocketServer | null = null
  let activeClient: WebSocket | null = null
  let isAuthenticated = false

  function send(ws: WebSocket, message: object) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  return {
    on: emitter.on.bind(emitter),

    async start() {
      wss = new WebSocketServer({ port: options.port })

      wss.on('connection', (ws) => {
        if (activeClient) {
          ws.close(1000, 'Another client connected')
          return
        }

        activeClient = ws
        isAuthenticated = false
        emitter.emit('connection')

        ws.on('message', async (data) => {
          const message = JSON.parse(data.toString())

          if (message.type === 'auth') {
            const success = validateToken(message.token, options.token)
            isAuthenticated = success
            send(ws, { type: 'auth_result', success })
            if (!success) ws.close()
            return
          }

          if (!isAuthenticated) {
            send(ws, { type: 'error', error: 'Not authenticated' })
            return
          }

          if (message.type === 'generate_insight') {
            handleInsightRequest(ws, message)
          }

          if (message.type === 'cancel_insight') {
            cancelInsight(message.id)
          }
        })

        ws.on('close', () => {
          if (activeClient === ws) {
            activeClient = null
            isAuthenticated = false
            emitter.emit('disconnection')
          }
        })
      })
    },

    async stop() {
      if (activeClient) {
        activeClient.close(1000, 'Server shutting down')
      }
      if (wss) {
        wss.close()
        wss = null
      }
    }
  }
}
```

**Claude Agent SDK integration (src/agent/chat.ts):**
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { WebSocket } from 'ws'

const activeRequests = new Map<string, AbortController>()

export async function handleInsightRequest(
  ws: WebSocket,
  message: { id: string; type: string; prompt: string; systemPrompt: string }
) {
  const { id, prompt, systemPrompt } = message
  const abortController = new AbortController()
  activeRequests.set(id, abortController)

  const send = (event: object) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'insight_stream', id, ...event }))
    }
  }

  try {
    const agentQuery = query({
      prompt,
      options: {
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,  // Single response, no tool use
        systemPrompt: {
          type: 'preset',
          preset: 'empty',  // Start fresh, we provide full system prompt
          append: systemPrompt,
        },
      },
    })

    let currentText = ''

    for await (const sdkMessage of agentQuery) {
      if (abortController.signal.aborted) {
        send({ event: 'cancelled' })
        break
      }

      if (sdkMessage.type === 'assistant') {
        for (const block of sdkMessage.message.content) {
          if (block.type === 'text') {
            const delta = block.text.slice(currentText.length)
            if (delta) {
              currentText = block.text
              send({ event: 'text', content: delta })
            }
          }
        }
      }
    }

    send({ event: 'done', fullContent: currentText })
  } catch (error) {
    send({ event: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
  } finally {
    activeRequests.delete(id)
  }
}

export function cancelInsight(id: string): boolean {
  const controller = activeRequests.get(id)
  if (controller) {
    controller.abort()
    activeRequests.delete(id)
    return true
  }
  return false
}
```

**Token API route (src/app/api/agent/token/route.ts):**
```typescript
import { readFileSync, existsSync } from 'fs'
import { NextResponse } from 'next/server'

const TOKEN_FILE = '.agent-token'

export async function GET() {
  if (!existsSync(TOKEN_FILE)) {
    return NextResponse.json(
      { error: 'Agent not running', available: false },
      { status: 503 }
    )
  }

  try {
    const token = readFileSync(TOKEN_FILE, 'utf-8').trim()
    return NextResponse.json({ token, available: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to read token', available: false },
      { status: 500 }
    )
  }
}
```

**Browser connection (src/lib/agent/connection.ts):**
```typescript
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface InsightStreamEvent {
  type: 'insight_stream'
  id: string
  event: 'text' | 'done' | 'error' | 'cancelled'
  content?: string
  fullContent?: string
  error?: string
}

export class AgentConnection {
  private ws: WebSocket | null = null
  private status: ConnectionStatus = 'disconnected'
  private listeners = new Set<(status: ConnectionStatus) => void>()
  private streamCallbacks = new Map<string, (event: InsightStreamEvent) => void>()

  getStatus() { return this.status }

  onStatusChange(cb: (status: ConnectionStatus) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status
    this.listeners.forEach(cb => cb(status))
  }

  async connect(url: string, token: string): Promise<void> {
    this.setStatus('connecting')
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({ type: 'auth', token }))
      }

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)

        if (msg.type === 'auth_result') {
          if (msg.success) {
            this.setStatus('connected')
            resolve()
          } else {
            this.setStatus('error')
            reject(new Error('Authentication failed'))
          }
        }

        if (msg.type === 'insight_stream') {
          const cb = this.streamCallbacks.get(msg.id)
          cb?.(msg as InsightStreamEvent)
          if (msg.event === 'done' || msg.event === 'error' || msg.event === 'cancelled') {
            this.streamCallbacks.delete(msg.id)
          }
        }
      }

      this.ws.onerror = () => {
        this.setStatus('error')
        reject(new Error('Connection failed'))
      }

      this.ws.onclose = () => {
        if (this.status !== 'error') this.setStatus('disconnected')
      }
    })
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
    this.setStatus('disconnected')
  }

  generateInsight(
    id: string,
    prompt: string,
    systemPrompt: string,
    onStream: (event: InsightStreamEvent) => void
  ): void {
    if (!this.ws || this.status !== 'connected') {
      throw new Error('Not connected')
    }
    this.streamCallbacks.set(id, onStream)
    this.ws.send(JSON.stringify({ type: 'generate_insight', id, prompt, systemPrompt }))
  }

  cancelInsight(id: string): void {
    this.ws?.send(JSON.stringify({ type: 'cancel_insight', id }))
    this.streamCallbacks.delete(id)
  }
}
```

**Package.json updates:**
```json
{
  "scripts": {
    "dev": "concurrently --kill-others -n agent,next -c cyan,green \"npm run agent\" \"npm run next:dev\"",
    "next:dev": "next dev",
    "agent": "tsx src/agent/index.ts"
  }
}
```

**.gitignore addition:**
```
.agent-token
```

**What Could Break:**
- Claude Code not authenticated — check macOS Keychain, show helpful error
- Port 9333 in use — detect and show error
- WebSocket connection drops — implement reconnect with backoff

**Done When:**
- [ ] `npm run dev` starts both agent and Next.js
- [ ] Agent generates token and writes to .agent-token
- [ ] Next.js can read token via /api/agent/token
- [ ] WebSocket connection authenticates successfully
- [ ] SIGINT/SIGTERM cleanly shuts down agent
- [ ] No orphan processes after stopping dev server
- [ ] .agent-token is removed on shutdown

---

### Chunk 2: Unified Extraction Prompt

**Goal:** Create a single unified prompt that extracts all relevant content based on transcript analysis.

**Files:**
- `src/lib/claude/prompts/extract.ts` — create (unified extraction prompt)
- `src/lib/claude/prompts/types.ts` — create (TypeScript types for structured output)
- `src/lib/claude/prompts/index.ts` — create (exports)

**Implementation Details:**

**Unified Extraction Prompt:**
The prompt first classifies content type, then extracts all applicable sections:

```typescript
export function buildExtractionPrompt(video: { title: string; channel: string; transcript: string }) {
  return `You are extracting actionable knowledge from video content.

**Video:** ${video.title}
**Channel:** ${video.channel}

**Transcript:**
${video.transcript}

---

## Instructions

1. First, classify this content:
   - Technical/development focused? → Include Claude Code plugins
   - Meeting/discussion? → Focus on decisions and action items
   - Educational/tutorial? → Focus on techniques and steps
   - Thought leadership? → Focus on frameworks and insights

2. Extract ALL applicable sections as JSON:

{
  "contentType": "dev" | "meeting" | "educational" | "thought-leadership" | "general",

  "summary": {
    "tldr": "2-3 sentences capturing core value",
    "overview": "2-3 paragraphs explaining the content",
    "keyPoints": ["Point 1", "Point 2", ...]
  },

  "insights": [
    {
      "title": "Insight title",
      "timestamp": "HH:MM:SS or approximate",
      "explanation": "2-3 sentences",
      "actionable": "How to apply this"
    }
  ],

  "actionItems": {
    "immediate": ["Action 1", "Action 2"],
    "shortTerm": ["Action 1", "Action 2"],
    "longTerm": ["Action 1", "Action 2"],
    "resources": [{ "name": "Resource", "description": "What it is" }]
  },

  "claudeCode": {
    "applicable": true/false,
    "skills": [
      {
        "name": "skill-name",
        "description": "When to use",
        "allowedTools": ["Read", "Write"],
        "instructions": "Full markdown instructions"
      }
    ],
    "commands": [
      {
        "name": "command-name",
        "description": "What it does",
        "argumentHint": "[filename]",
        "steps": "Full markdown steps"
      }
    ],
    "agents": [
      {
        "name": "agent-name",
        "description": "What it specializes in",
        "model": "sonnet",
        "systemPrompt": "Full system prompt"
      }
    ],
    "hooks": [
      {
        "name": "hook-name",
        "event": "PreToolUse | PostToolUse | Stop",
        "matcher": "pattern",
        "command": "shell command",
        "purpose": "What it automates"
      }
    ],
    "rules": [
      {
        "name": "rule-name",
        "rule": "Clear imperative instruction",
        "rationale": "Why this matters",
        "goodExample": "Example of following",
        "badExample": "Example of violating"
      }
    ]
  }
}

---

Guidelines:
- Write for someone who will NOT watch the video
- Be specific, not vague
- Include timestamps for insights when possible
- For Claude Code plugins, output must be copy-paste ready
- Skills need clear instructions Claude can follow
- If content isn't dev-focused, set claudeCode.applicable = false
- Return valid JSON only`
}
```

**Output Types (src/lib/claude/prompts/types.ts):**
```typescript
export interface ExtractionResult {
  contentType: 'dev' | 'meeting' | 'educational' | 'thought-leadership' | 'general'
  summary: {
    tldr: string
    overview: string
    keyPoints: string[]
  }
  insights: Array<{
    title: string
    timestamp: string
    explanation: string
    actionable: string
  }>
  actionItems: {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
    resources: Array<{ name: string; description: string }>
  }
  claudeCode: {
    applicable: boolean
    skills: ClaudeSkill[]
    commands: ClaudeCommand[]
    agents: ClaudeAgent[]
    hooks: ClaudeHook[]
    rules: ClaudeRule[]
  }
}

export interface ClaudeSkill {
  name: string
  description: string
  allowedTools: string[]
  instructions: string
}

export interface ClaudeCommand {
  name: string
  description: string
  argumentHint: string
  steps: string
}

export interface ClaudeAgent {
  name: string
  description: string
  model: 'haiku' | 'sonnet' | 'opus'
  systemPrompt: string
}

export interface ClaudeHook {
  name: string
  event: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification'
  matcher: string
  command: string
  purpose: string
}

export interface ClaudeRule {
  name: string
  rule: string
  rationale: string
  goodExample: string
  badExample: string
}
```

**Format Functions for Copy Buttons:**
```typescript
export function formatSkillForCopy(skill: ClaudeSkill): string {
  return `---
name: ${skill.name}
description: ${skill.description}
allowed-tools: ${skill.allowedTools.join(', ')}
---

${skill.instructions}`
}

export function formatCommandForCopy(cmd: ClaudeCommand): string {
  return `---
name: ${cmd.name}
description: ${cmd.description}
argument-hint: ${cmd.argumentHint}
disable-model-invocation: true
---

${cmd.steps}`
}

export function formatAgentForCopy(agent: ClaudeAgent): string {
  return `---
name: ${agent.name}
description: ${agent.description}
model: ${agent.model}
---

${agent.systemPrompt}`
}

export function formatRuleForCopy(rule: ClaudeRule): string {
  return `## ${rule.name}

${rule.rule}

**Rationale:** ${rule.rationale}

**Example:**
- Good: ${rule.goodExample}
- Bad: ${rule.badExample}`
}
```

**What Could Break:**
- JSON parsing errors — validate and handle gracefully
- Large transcripts exceeding context — truncate intelligently
- Claude Code section quality varies — iterate on prompts

**Done When:**
- [ ] Unified prompt extracts all sections in one call
- [ ] JSON output parses correctly
- [ ] Format functions produce valid Claude Code files
- [ ] Copy buttons copy exact ready-to-use format
- [ ] Non-dev content correctly skips Claude Code section

---

### Chunk 3: Insights Database Schema & Persistence

**Goal:** Add insights table and API routes for storing the unified extraction result.

**Files:**
- `src/lib/db/schema.ts` — modify (add insights table)
- `src/app/api/videos/[id]/insights/route.ts` — create (GET, POST)
- `src/lib/db/insights.ts` — create (database functions)

**Implementation Details:**

**Insights table schema:**
Store the full extraction result as JSON for flexibility:

```typescript
export const insights = sqliteTable('insights', {
  id: text('id').primaryKey(),
  videoId: text('video_id').notNull().references(() => videos.id).unique(),
  contentType: text('content_type').notNull(), // 'dev' | 'meeting' | 'educational' | etc.
  extraction: text('extraction', { mode: 'json' }).notNull(), // Full ExtractionResult
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

**GET /api/videos/[id]/insights:**
- Returns existing extraction for a video (or null if not generated)
- Response: `{ extraction: ExtractionResult | null, generatedAt: string | null }`

**POST /api/videos/[id]/insights:**
- Saves completed extraction (called by client after streaming completes)
- Body: `{ extraction: ExtractionResult }`
- Upserts (replaces if exists)

```typescript
import { getExtractionForVideo, upsertExtraction } from '@/lib/db/insights'
import type { ExtractionResult } from '@/lib/claude/prompts/types'

// GET - retrieve existing extraction
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getExtractionForVideo(id)

  if (!result) {
    return Response.json({ extraction: null, generatedAt: null })
  }

  return Response.json({
    extraction: result.extraction,
    generatedAt: result.updatedAt.toISOString(),
  })
}

// POST - save completed extraction
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { extraction } = await req.json() as { extraction: ExtractionResult }

  // Validate extraction has required fields
  if (!extraction.contentType || !extraction.summary) {
    return Response.json({ error: 'Invalid extraction format' }, { status: 400 })
  }

  const result = await upsertExtraction(id, extraction)

  return Response.json({
    extraction: result.extraction,
    generatedAt: result.updatedAt.toISOString(),
  })
}
```

**Database functions (src/lib/db/insights.ts):**
```typescript
import { db } from './index'
import { insights } from './schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { ExtractionResult } from '@/lib/claude/prompts/types'

export async function getExtractionForVideo(videoId: string) {
  return db.select()
    .from(insights)
    .where(eq(insights.videoId, videoId))
    .get()
}

export async function upsertExtraction(videoId: string, extraction: ExtractionResult) {
  const now = new Date()
  const existing = await getExtractionForVideo(videoId)

  if (existing) {
    await db.update(insights)
      .set({
        contentType: extraction.contentType,
        extraction,
        updatedAt: now,
      })
      .where(eq(insights.id, existing.id))

    return { ...existing, extraction, contentType: extraction.contentType, updatedAt: now }
  }

  const newRecord = {
    id: nanoid(),
    videoId,
    contentType: extraction.contentType,
    extraction,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(insights).values(newRecord)
  return newRecord
}

export async function deleteExtraction(videoId: string) {
  await db.delete(insights).where(eq(insights.videoId, videoId))
}
```

**Data Flow:**
1. User clicks "Extract Insights" → sends request to agent via WebSocket
2. Agent streams JSON response back to client (parsed and displayed progressively)
3. On completion, client POSTs full ExtractionResult to `/api/videos/[id]/insights`
4. Server persists to SQLite as JSON
5. On page revisit, client fetches existing extraction and displays immediately

**What Could Break:**
- JSON storage/retrieval — ensure proper serialization
- Large extractions — SQLite text is unlimited but consider pagination for UI

**Done When:**
- [ ] Insights table created with JSON column
- [ ] One extraction per video (unique constraint)
- [ ] GET returns null for ungenerated, full extraction otherwise
- [ ] POST upserts correctly
- [ ] Timestamps track creation and updates

---

### Chunk 4: Tab UI & Unified Insights View

**Goal:** Create the tab system with single "Extract Insights" button and unified streaming results view.

**Files:**
- `src/app/videos/[id]/page.tsx` — modify (add tabs)
- `src/components/insights/InsightsTabs.tsx` — create
- `src/components/insights/InsightsPanel.tsx` — create (main panel)
- `src/components/insights/InsightSection.tsx` — create (individual section)
- `src/components/insights/ClaudeCodeSection.tsx` — create (expandable plugins)
- `src/components/insights/CopyButton.tsx` — create (copy to clipboard)
- `src/components/ui/tabs.tsx` — create (via shadcn/ui)
- `src/components/ui/collapsible.tsx` — create (via shadcn/ui)

**Implementation Details:**

**Install shadcn/ui components:**
```bash
npx shadcn@latest add tabs collapsible
```

**InsightsTabs component:**
- Two tabs: Transcript | Insights
- Transcript tab shows existing TranscriptView
- Insights tab shows InsightsPanel

**InsightsPanel — Empty State:**
```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-medium mb-2">No insights generated yet</h3>
  <p className="text-muted-foreground mb-6 max-w-md">
    Claude will analyze this video and extract summaries, key insights,
    action items, and Claude Code plugins (if dev content).
  </p>
  <Button onClick={onExtract} size="lg">
    <Sparkles className="mr-2 h-4 w-4" />
    Extract Insights
  </Button>
</div>
```

**InsightsPanel — Streaming State:**
```tsx
<div className="space-y-6">
  <div className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">Extracting insights...</span>
    <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
  </div>

  <InsightSection
    title="Summary"
    icon={<FileText />}
    status={summaryStatus}  // 'pending' | 'working' | 'done'
    content={summary}
    onCopy={() => copyToClipboard(summary)}
  />

  <InsightSection
    title="Key Insights"
    icon={<Lightbulb />}
    status={insightsStatus}
    content={insights}
    onCopy={() => copyToClipboard(formatInsights(insights))}
  />

  <InsightSection
    title="Action Items"
    icon={<CheckSquare />}
    status={actionsStatus}
    content={actionItems}
    onCopy={() => copyToClipboard(formatActions(actionItems))}
  />

  {claudeCode?.applicable && (
    <ClaudeCodeSection
      status={claudeCodeStatus}
      skills={claudeCode.skills}
      commands={claudeCode.commands}
      agents={claudeCode.agents}
      hooks={claudeCode.hooks}
      rules={claudeCode.rules}
    />
  )}
</div>
```

**InsightSection component:**
```tsx
interface InsightSectionProps {
  title: string
  icon: ReactNode
  status: 'pending' | 'working' | 'done'
  content: string | object
  onCopy: () => void
}

function InsightSection({ title, icon, status, content, onCopy }: InsightSectionProps) {
  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator status={status} />
          {status === 'done' && <CopyButton onClick={onCopy} />}
        </div>
      </div>
      <div className="p-4">
        {status === 'pending' && (
          <span className="text-muted-foreground">Waiting...</span>
        )}
        {status === 'working' && (
          <div className="prose prose-sm">
            {content}
            <span className="animate-pulse">▌</span>
          </div>
        )}
        {status === 'done' && (
          <div className="prose prose-sm">
            {/* Rendered content */}
          </div>
        )}
      </div>
    </div>
  )
}
```

**ClaudeCodeSection component:**
```tsx
function ClaudeCodeSection({ status, skills, commands, agents, hooks, rules }) {
  const total = skills.length + commands.length + agents.length + hooks.length + rules.length

  return (
    <div className="border rounded-lg border-amber-200 bg-amber-50/50">
      <div className="flex items-center justify-between p-4 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <Wrench className="text-amber-600" />
          <span className="font-medium">Claude Code Plugins</span>
          {status === 'done' && (
            <Badge variant="secondary">{total} items</Badge>
          )}
        </div>
        <StatusIndicator status={status} />
      </div>

      {status === 'done' && (
        <div className="p-4 space-y-4">
          {skills.length > 0 && (
            <PluginGroup title="Skills" items={skills} formatFn={formatSkillForCopy} />
          )}
          {commands.length > 0 && (
            <PluginGroup title="Commands" items={commands} formatFn={formatCommandForCopy} />
          )}
          {agents.length > 0 && (
            <PluginGroup title="Agents" items={agents} formatFn={formatAgentForCopy} />
          )}
          {hooks.length > 0 && (
            <PluginGroup title="Hooks" items={hooks} formatFn={formatHookForCopy} />
          )}
          {rules.length > 0 && (
            <PluginGroup title="Rules" items={rules} formatFn={formatRuleForCopy} />
          )}
        </div>
      )}
    </div>
  )
}

function PluginGroup({ title, items, formatFn }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
        <ChevronRight className="h-4 w-4" />
        {title} ({items.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 space-y-2 mt-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-white rounded border">
            <span className="font-mono text-sm">{item.name}</span>
            <CopyButton onClick={() => copyToClipboard(formatFn(item))} />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**CopyButton component:**
```tsx
function CopyButton({ onClick }: { onClick: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    await onClick()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}
```

**InsightsPanel — Complete State:**
Same as streaming but all sections show 'done' status, plus:
- Header shows "Insights extracted • {timestamp}"
- [Regenerate] button in header

**What Could Break:**
- JSON streaming may arrive incomplete — buffer until valid JSON
- Large Claude Code sections — use virtual scrolling if needed
- Copy on mobile — handle clipboard API fallback

**Done When:**
- [ ] Tab system switches between Transcript and Insights
- [ ] Empty state shows single Extract button
- [ ] Streaming shows all sections with status indicators
- [ ] Each section has working Copy button
- [ ] Claude Code section is collapsible with per-item Copy
- [ ] Complete state shows Regenerate option
- [ ] Mobile responsive layout

---

### Chunk 5: Streaming Integration & Error Handling

**Goal:** Wire up the agent WebSocket connection to the unified UI with progressive JSON parsing, error handling, and persistence.

**Files:**
- `src/lib/agent/AgentProvider.tsx` — modify (add auto-connect)
- `src/hooks/useExtraction.ts` — create (unified extraction hook)
- `src/lib/claude/prompts/parser.ts` — create (progressive JSON parser)
- `src/components/insights/InsightsPanel.tsx` — modify (integrate hook)

**Implementation Details:**

**AgentProvider with auto-connect:**
```typescript
'use client'
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { AgentConnection, ConnectionStatus } from './connection'

interface AgentContextValue {
  status: ConnectionStatus
  agent: AgentConnection | null
  error: string | null
}

const AgentContext = createContext<AgentContextValue | null>(null)

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<AgentConnection | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const connectionRef = useRef<AgentConnection | null>(null)

  useEffect(() => {
    let cancelled = false

    async function connect() {
      try {
        const res = await fetch('/api/agent/token')
        const data = await res.json()

        if (!data.available || cancelled) {
          setError(data.error || 'Agent not available')
          return
        }

        const connection = new AgentConnection()
        connectionRef.current = connection
        connection.onStatusChange(setStatus)

        await connection.connect('ws://localhost:9333', data.token)
        if (!cancelled) {
          setAgent(connection)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Connection failed')
        }
      }
    }

    connect()
    return () => { cancelled = true; connectionRef.current?.disconnect() }
  }, [])

  return (
    <AgentContext.Provider value={{ status, agent, error }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgent must be within AgentProvider')
  return ctx
}
```

**useExtraction hook (unified):**
```typescript
import { useState, useRef, useCallback } from 'react'
import { useAgent } from '@/lib/agent/AgentProvider'
import { nanoid } from 'nanoid'
import { parsePartialJSON } from '@/lib/claude/prompts/parser'
import type { ExtractionResult } from '@/lib/claude/prompts/types'

type SectionStatus = 'pending' | 'working' | 'done'

interface ExtractionState {
  overall: 'idle' | 'extracting' | 'done' | 'error'
  sections: {
    summary: SectionStatus
    insights: SectionStatus
    actions: SectionStatus
    claudeCode: SectionStatus
  }
  partial: Partial<ExtractionResult>
  error: string | null
}

export function useExtraction(videoId: string) {
  const { agent, status } = useAgent()
  const [state, setState] = useState<ExtractionState>({
    overall: 'idle',
    sections: { summary: 'pending', insights: 'pending', actions: 'pending', claudeCode: 'pending' },
    partial: {},
    error: null,
  })
  const requestIdRef = useRef<string | null>(null)
  const rawContentRef = useRef('')

  const extract = useCallback(async (video: { title: string; channel: string; transcript: string }) => {
    if (!agent || status !== 'connected') {
      setState(s => ({ ...s, overall: 'error', error: 'Agent not connected' }))
      return
    }

    setState({
      overall: 'extracting',
      sections: { summary: 'working', insights: 'pending', actions: 'pending', claudeCode: 'pending' },
      partial: {},
      error: null,
    })
    rawContentRef.current = ''

    const id = nanoid()
    requestIdRef.current = id

    const prompt = buildExtractionPrompt(video)

    agent.generateInsight(id, prompt, '', (event) => {
      if (event.event === 'text' && event.content) {
        rawContentRef.current += event.content

        // Try to parse partial JSON and update state
        const parsed = parsePartialJSON(rawContentRef.current)
        if (parsed) {
          setState(s => ({
            ...s,
            partial: parsed,
            sections: {
              summary: parsed.summary ? 'done' : s.sections.summary === 'done' ? 'done' : 'working',
              insights: parsed.insights?.length ? 'done' : parsed.summary ? 'working' : 'pending',
              actions: parsed.actionItems ? 'done' : parsed.insights?.length ? 'working' : 'pending',
              claudeCode: parsed.claudeCode ? 'done' : parsed.actionItems ? 'working' : 'pending',
            },
          }))
        }
      }

      if (event.event === 'done' && event.fullContent) {
        try {
          const extraction = JSON.parse(event.fullContent) as ExtractionResult
          setState({
            overall: 'done',
            sections: { summary: 'done', insights: 'done', actions: 'done', claudeCode: 'done' },
            partial: extraction,
            error: null,
          })

          // Persist to database
          fetch(`/api/videos/${videoId}/insights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extraction }),
          }).catch(err => console.error('Failed to save:', err))
        } catch (err) {
          setState(s => ({ ...s, overall: 'error', error: 'Failed to parse response' }))
        }
      }

      if (event.event === 'error') {
        setState(s => ({ ...s, overall: 'error', error: event.error || 'Extraction failed' }))
      }

      if (event.event === 'cancelled') {
        setState(s => ({ ...s, overall: 'idle' }))
      }
    })
  }, [agent, status, videoId])

  const cancel = useCallback(() => {
    if (requestIdRef.current && agent) {
      agent.cancelInsight(requestIdRef.current)
      requestIdRef.current = null
    }
  }, [agent])

  return { state, extract, cancel, isConnected: status === 'connected' }
}
```

**Progressive JSON Parser (src/lib/claude/prompts/parser.ts):**
```typescript
import type { ExtractionResult } from './types'

/**
 * Attempts to parse partial JSON as it streams in.
 * Returns whatever fields are complete, or null if unparseable.
 */
export function parsePartialJSON(raw: string): Partial<ExtractionResult> | null {
  // Try to find complete sections in the JSON
  try {
    // First try parsing as complete JSON
    return JSON.parse(raw)
  } catch {
    // Not complete yet, try to extract individual sections
    const result: Partial<ExtractionResult> = {}

    // Try to extract contentType
    const contentTypeMatch = raw.match(/"contentType"\s*:\s*"([^"]+)"/)
    if (contentTypeMatch) {
      result.contentType = contentTypeMatch[1] as ExtractionResult['contentType']
    }

    // Try to extract complete summary object
    const summaryMatch = raw.match(/"summary"\s*:\s*(\{[^}]+\})/)
    if (summaryMatch) {
      try {
        result.summary = JSON.parse(summaryMatch[1])
      } catch {}
    }

    // Try to extract insights array (may be partial)
    const insightsStart = raw.indexOf('"insights"')
    if (insightsStart !== -1) {
      // Find matching brackets
      const arrayStart = raw.indexOf('[', insightsStart)
      if (arrayStart !== -1) {
        let depth = 1
        let pos = arrayStart + 1
        while (pos < raw.length && depth > 0) {
          if (raw[pos] === '[') depth++
          if (raw[pos] === ']') depth--
          pos++
        }
        if (depth === 0) {
          try {
            result.insights = JSON.parse(raw.slice(arrayStart, pos))
          } catch {}
        }
      }
    }

    // Similar extraction for actionItems and claudeCode...

    return Object.keys(result).length > 0 ? result : null
  }
}
```

**Error handling:**
- Agent not running: Show banner with instructions
- Connection lost: Show reconnecting indicator
- Generation error: Show error with Retry button
- Cancel: Clean abort, return to idle state
- JSON parse error: Show "Processing..." and retry parse on completion

**InsightsPanel integration:**
```typescript
function InsightsPanel({ videoId, video }: { videoId: string; video: Video }) {
  const { status, error: connectionError } = useAgent()
  const { state, extract, cancel, isConnected } = useExtraction(videoId)
  const [existingExtraction, setExistingExtraction] = useState<ExtractionResult | null>(null)

  // Load existing extraction on mount
  useEffect(() => {
    fetch(`/api/videos/${videoId}/insights`)
      .then(res => res.json())
      .then(data => {
        if (data.extraction) setExistingExtraction(data.extraction)
      })
  }, [videoId])

  if (!isConnected) {
    return <ConnectionBanner status={status} error={connectionError} />
  }

  if (state.overall === 'idle' && !existingExtraction) {
    return <EmptyState onExtract={() => extract(video)} />
  }

  const extraction = state.overall === 'done' ? state.partial : existingExtraction
  const sections = state.overall === 'extracting' ? state.sections : {
    summary: 'done', insights: 'done', actions: 'done', claudeCode: 'done'
  }

  return (
    <ExtractionView
      extraction={extraction}
      sections={sections}
      isExtracting={state.overall === 'extracting'}
      onCancel={cancel}
      onRegenerate={() => extract(video)}
    />
  )
}
```

**What Could Break:**
- Partial JSON parsing edge cases — extensive testing needed
- Agent crashes mid-stream — detect and show error
- Large extractions — consider chunked persistence
- Race conditions — use refs for request IDs

**Done When:**
- [ ] Auto-connects to agent on page load
- [ ] Shows connection status when agent unavailable
- [ ] Single button triggers full extraction
- [ ] Sections update status as JSON streams in
- [ ] Cancel stops generation cleanly
- [ ] Completed extraction persists to database
- [ ] Previously generated extraction loads immediately
- [ ] Copy buttons work for all sections
- [ ] Claude Code plugins individually copyable
- [ ] Error states with retry options
- [ ] No memory leaks on navigation

## Notes

- **Single Smart Button** pattern — one click extracts all relevant content
- Universal extractions: Summary, Key Insights, Action Items
- Dev-specific extractions: Skills, Commands, Agents, Hooks, Rules for Claude Code
- Copy buttons provide exact format ready for `.claude/` directory
- **Local Agent Architecture** — no API key needed, uses Claude Code OAuth
- Results persist as JSON — full extraction stored per video
- Streaming via WebSocket (not SSE) for bidirectional communication
- JSON response parsed progressively for streaming display
- Consider reconnection backoff in future polish

### Sources
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
