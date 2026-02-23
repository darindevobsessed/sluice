# System Architecture

## Overview

Sluice is a knowledge extraction platform that processes YouTube videos through AI analysis to generate actionable insights and Claude Code plugin suggestions.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Pages     │  │    API      │  │ Components  │              │
│  │  (App Dir)  │  │   Routes    │  │  (React)    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│  ┌───────────────────────┴────────────────────────────┐         │
│  │              Shared Libraries (/lib)                │         │
│  │  ┌──────┐  ┌─────────┐  ┌────────┐  ┌──────────┐  │         │
│  │  │  db  │  │ youtube │  │ claude │  │  agent   │  │         │
│  │  └──┬───┘  └─────────┘  └────────┘  └────┬─────┘  │         │
│  └─────┼────────────────────────────────────┼────────┘         │
│        │                                    │                   │
└────────┼────────────────────────────────────┼───────────────────┘
         │                                    │
         ▼                                    ▼
   ┌───────────┐                     ┌────────────────┐
   │  SQLite   │                     │  Agent Server  │
   │ (better-  │                     │  (WebSocket)   │
   │ sqlite3)  │                     └───────┬────────┘
   └───────────┘                             │
                                             ▼
                                    ┌────────────────┐
                                    │  Claude API    │
                                    │ (Agent SDK)    │
                                    └────────────────┘
```

## Core Flows

### 1. Video Ingestion Flow

```
User Input (YouTube URL)
        │
        ▼
┌───────────────────┐
│  URL Validation   │  lib/youtube/parse-url.ts
│  & ID Extraction  │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  oEmbed Metadata  │  lib/youtube/oembed.ts
│  Fetch (title,    │
│  thumbnail, etc)  │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Manual Transcript│  User pastes from YouTube
│  Input (Copy/Paste│
│  from YouTube)    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Transcript Parse │  lib/transcript/parse.ts
│  (timestamps)     │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Save to Database │  POST /api/videos
└───────────────────┘
```

### 2. Insight Extraction Flow

```
User clicks "Extract Insights"
        │
        ▼
┌───────────────────┐
│  useExtraction    │  hooks/useExtraction.ts
│  Hook             │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  AgentConnection  │  lib/agent/connection.ts
│  (WebSocket)      │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Agent Server     │  agent/server.ts
│  (validates token)│
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Claude API       │  @anthropic-ai/claude-agent-sdk
│  (streaming)      │
└────────┬──────────┘
         │
         ▼ (streaming JSON)
┌───────────────────┐
│  Partial JSON     │  lib/claude/prompts/parser.ts
│  Parser           │
└────────┬──────────┘
         │
         ▼ (progressive updates)
┌───────────────────┐
│  InsightsPanel    │  components/insights/
│  (live UI update) │
└────────┬──────────┘
         │
         ▼ (on complete)
┌───────────────────┐
│  Persist to DB    │  POST /api/videos/[id]/insights
└───────────────────┘
```

### 3. Search Flow

```
User enters search query
        │
        ▼
┌───────────────────┐
│  VideoSearch      │  components/videos/VideoSearch.tsx
│  Component        │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  GET /api/videos  │  Query parameter: ?q=...
│  ?q=search        │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  FTS5 Full-Text   │  SQLite virtual table
│  Search           │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Ranked Results   │  Ordered by relevance
└───────────────────┘
```

## Component Architecture

### Provider Hierarchy

```tsx
<html>
  <body>
    <ThemeProvider>          {/* Dark/light mode */}
      <AgentProvider>        {/* WebSocket connection */}
        <Sidebar />          {/* Navigation */}
        <MainContent>
          {children}         {/* Page content */}
        </MainContent>
      </AgentProvider>
    </ThemeProvider>
  </body>
</html>
```

### Key Component Groups

| Directory | Purpose | Key Components |
|-----------|---------|----------------|
| `components/ui/` | Reusable primitives | Button, Card, Input, Tabs |
| `components/layout/` | App shell | Sidebar, MainContent |
| `components/videos/` | Video display | VideoCard, VideoGrid, VideoPlayer |
| `components/insights/` | AI insights | InsightsPanel, InsightSection, ClaudeCodeSection |
| `components/add-video/` | Ingestion workflow | AddVideoPage, VideoPreviewCard |

## Data Models

### Video Entity

```typescript
interface Video {
  id: number;              // Auto-increment PK
  youtubeId: string;       // YouTube video ID (unique)
  title: string;
  channel: string;
  thumbnail: string | null;
  duration: number | null; // Seconds
  transcript: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Insight Entity

```typescript
interface Insight {
  id: string;              // nanoid
  videoId: number;         // FK to videos (unique - 1:1)
  contentType: string;     // 'dev' | 'meeting' | 'educational' | etc.
  extraction: ExtractionResult; // Full JSON extraction
  createdAt: Date;
  updatedAt: Date;
}
```

### ExtractionResult Schema

```typescript
interface ExtractionResult {
  contentType: 'dev' | 'meeting' | 'educational' | 'thought-leadership' | 'general';
  summary: {
    tldr: string;
    overview: string;
    keyPoints: string[];
  };
  insights: Array<{
    title: string;
    timestamp: string;
    explanation: string;
    actionable: string;
  }>;
  actionItems: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    resources: Array<{ name: string; description: string }>;
  };
  claudeCode: {
    applicable: boolean;
    skills: ClaudeSkill[];
    commands: ClaudeCommand[];
    agents: ClaudeAgent[];
    hooks: ClaudeHook[];
    rules: ClaudeRule[];
  };
}
```

## Agent Architecture

### Token-Based Authentication

```
1. Agent server starts → generates random token → writes to .agent-token
2. Next.js API reads token → provides to frontend via /api/agent/token
3. Frontend connects to WebSocket with token
4. Agent server validates token on connection
```

### Message Protocol

```typescript
// Client → Server
{ type: 'auth', token: string }
{ type: 'generate', id: string, insightType: string, prompt: string, systemPrompt: string }
{ type: 'cancel', id: string }

// Server → Client
{ type: 'authResult', success: boolean }
{ type: 'start', id: string }
{ type: 'text', id: string, text: string }  // Streaming chunks
{ type: 'done', id: string, content: string }
{ type: 'error', id: string, error: string }
{ type: 'cancelled', id: string }
```

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/videos` | GET | List all videos (with search) |
| `/api/videos` | POST | Create new video |
| `/api/videos/[id]` | GET | Get single video |
| `/api/videos/[id]/insights` | GET | Get video's extraction |
| `/api/videos/[id]/insights` | POST | Save extraction result |
| `/api/agent/token` | GET | Get agent connection token |

## Security Considerations

1. **Agent Token**: Ephemeral, regenerated on each server start
2. **Token File**: Listed in `.gitignore`, never committed
3. **Local-Only**: Agent runs on localhost, no external exposure
4. **No External API Keys in Frontend**: Claude API calls via backend agent only

## Scalability Notes

Current design is optimized for local single-user development. For production:

- Replace SQLite with PostgreSQL
- Add proper authentication/authorization
- Deploy agent as separate microservice
- Add rate limiting to API routes
- Consider vector DB for semantic search
