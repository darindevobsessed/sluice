---
name: programmatic-transcripts
title: Programmatic Transcripts
status: active
priority: high
created: 2026-02-05
updated: 2026-02-05
cycle: rag-foundation
story_number: 2
chunks_total: 3
chunks_complete: 2
---

# Story: Programmatic Transcripts

## Spark

Eliminate manual transcript pasting. When a user adds a YouTube URL, automatically fetch the transcript using the `youtube-transcript` npm package. This removes friction and enables future automation (cron jobs in Cycle 2).

Keep manual paste as fallback for videos where auto-fetch fails (private videos, disabled captions, etc.).

> *"Try to make the transcript programmatic."*

We're going Node-only first (youtube-transcript npm) per user preference. Python/Chromium fallback can come in Cycle 2 if needed.

## Dependencies

**Blocked by:** None (can run parallel with Story 1)
**Blocks:** None directly, but enables Cycle 2 automation

## Acceptance

- [ ] Entering a valid YouTube URL automatically fetches the transcript
- [ ] Loading state shown while fetching ("Fetching transcript...")
- [ ] Success shows "✓ Auto-fetched from YouTube" indicator
- [ ] Failure shows error message with manual paste fallback
- [ ] User can edit auto-fetched transcript
- [ ] Debounce prevents rapid-fire requests (500ms after typing stops)
- [ ] Stale requests cancelled when URL changes (AbortController)
- [ ] Server-side rate limiting (10 requests/minute per IP)
- [ ] In-memory cache prevents duplicate fetches (5-minute TTL)
- [ ] Works gracefully when transcript unavailable (fallback to manual)

## Chunks

### Chunk 1: Transcript Fetch Service with Rate Limiting

**Goal:** Create a service to fetch YouTube transcripts with caching and rate limit support.

**Files:**
- `src/lib/youtube/transcript.ts` — create
- `src/lib/rate-limit.ts` — create
- `package.json` — modify (add youtube-transcript)

**Implementation Details:**

**Install package:**
```bash
npm install youtube-transcript
```

**src/lib/rate-limit.ts:**
```typescript
/**
 * Simple in-memory rate limiter
 * For production, consider Redis-based solution
 */
const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if request is within rate limit
 *
 * @param key - Unique identifier (e.g., IP address)
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Get remaining requests for a key
 */
export function getRateLimitRemaining(key: string, limit: number): number {
  const record = requestCounts.get(key);
  if (!record) return limit;
  return Math.max(0, limit - record.count);
}

// Cleanup old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60000); // Every minute
```

**src/lib/youtube/transcript.ts:**
```typescript
import { YoutubeTranscript } from 'youtube-transcript';
import type { TranscriptSegment } from '@/lib/transcript/types';

export interface TranscriptFetchResult {
  success: boolean;
  transcript: string | null;
  segments: TranscriptSegment[];
  error?: string;
  language?: string;
  fromCache?: boolean;
}

// In-memory cache to avoid re-fetching
const transcriptCache = new Map<string, { data: TranscriptFetchResult; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch transcript for a YouTube video
 *
 * @param videoId - YouTube video ID (not full URL)
 * @returns Transcript data or error
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptFetchResult> {
  // Check cache first
  const cached = transcriptCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  try {
    // Fetch transcript (defaults to English, falls back to auto-generated)
    const items = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en',
    });

    if (!items || items.length === 0) {
      const result: TranscriptFetchResult = {
        success: false,
        transcript: null,
        segments: [],
        error: 'No transcript available for this video',
      };
      // Cache failures too (to avoid hammering YouTube)
      transcriptCache.set(videoId, { data: result, expiresAt: Date.now() + CACHE_TTL });
      return result;
    }

    // Convert to our segment format
    const segments: TranscriptSegment[] = items.map((item) => ({
      timestamp: formatTimestamp(item.offset / 1000),
      seconds: Math.floor(item.offset / 1000),
      text: item.text.trim(),
    }));

    // Build full transcript text with timestamps
    const transcript = segments
      .map((seg) => `${seg.timestamp}\n${seg.text}`)
      .join('\n\n');

    const result: TranscriptFetchResult = {
      success: true,
      transcript,
      segments,
      language: 'en',
    };

    // Cache successful result
    transcriptCache.set(videoId, { data: result, expiresAt: Date.now() + CACHE_TTL });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    let errorMessage = `Failed to fetch transcript: ${message}`;

    // Provide user-friendly error messages
    if (message.includes('disabled') || message.includes('Transcript is disabled')) {
      errorMessage = 'Transcripts are disabled for this video';
    } else if (message.includes('private') || message.includes('unavailable')) {
      errorMessage = 'Video is private or unavailable';
    } else if (message.includes('not found') || message.includes('No transcript')) {
      errorMessage = 'No transcript available for this video';
    }

    const result: TranscriptFetchResult = {
      success: false,
      transcript: null,
      segments: [],
      error: errorMessage,
    };

    // Cache failures briefly
    transcriptCache.set(videoId, { data: result, expiresAt: Date.now() + CACHE_TTL });

    return result;
  }
}

/**
 * Clear cache for a specific video (useful for retry)
 */
export function clearTranscriptCache(videoId: string): void {
  transcriptCache.delete(videoId);
}

/**
 * Format seconds to timestamp string (MM:SS or H:MM:SS)
 */
function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```

**What Could Break:**
- `youtube-transcript` package changes or YouTube API changes
- Cache memory usage for many unique videos (mitigated by TTL cleanup)

**Done When:**
- [ ] `fetchTranscript('dQw4w9WgXcQ')` returns transcript data
- [ ] Subsequent calls return cached result
- [ ] Error cases return meaningful messages
- [ ] Cache expires after 5 minutes
- [ ] Rate limiter correctly counts requests

---

### Chunk 2: API Route with Rate Limiting

**Goal:** Create an API route that the frontend can call, with server-side rate limiting.

**Files:**
- `src/app/api/youtube/transcript/route.ts` — create

**Implementation Details:**

**src/app/api/youtube/transcript/route.ts:**
```typescript
import { NextResponse } from 'next/server';
import { fetchTranscript, clearTranscriptCache } from '@/lib/youtube/transcript';
import { checkRateLimit, getRateLimitRemaining } from '@/lib/rate-limit';
import { z } from 'zod';

const RATE_LIMIT = 10; // requests
const RATE_WINDOW = 60 * 1000; // 1 minute

const requestSchema = z.object({
  videoId: z.string().min(1).max(20),
  forceRefresh: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    // Check rate limit
    if (!checkRateLimit(`transcript:${clientIp}`, RATE_LIMIT, RATE_WINDOW)) {
      const remaining = getRateLimitRemaining(`transcript:${clientIp}`, RATE_LIMIT);
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please wait a moment before trying again.',
          rateLimited: true,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            'Retry-After': '60',
          },
        }
      );
    }

    const body = await request.json();
    const { videoId, forceRefresh } = requestSchema.parse(body);

    // Clear cache if force refresh requested
    if (forceRefresh) {
      clearTranscriptCache(videoId);
    }

    const result = await fetchTranscript(videoId);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        fallbackToManual: true,
      });
    }

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      segments: result.segments,
      language: result.language,
      fromCache: result.fromCache,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid video ID' },
        { status: 400 }
      );
    }

    console.error('Transcript fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transcript',
      fallbackToManual: true,
    });
  }
}
```

**What Could Break:**
- IP detection may not work in all deployment environments
- Rate limit state lost on server restart (acceptable for dev)

**Done When:**
- [ ] POST `/api/youtube/transcript` with `{ videoId: "abc" }` returns transcript
- [ ] Invalid videoId returns 400
- [ ] 11th request within 1 minute returns 429
- [ ] `forceRefresh: true` bypasses cache
- [ ] Headers include rate limit info

---

### Chunk 3: Update Add Video UI with Debounce

**Goal:** Auto-fetch transcript when URL is validated, with debounce and abort handling.

**Files:**
- `src/components/add-video/AddVideoPage.tsx` — modify
- `src/components/add-video/TranscriptSection.tsx` — modify
- `src/components/add-video/TranscriptInstructions.tsx` — modify

**Implementation Details:**

**AddVideoPage.tsx changes:**
```typescript
// Add imports
import { useRef, useCallback } from 'react';

// Add state
const [transcriptFetching, setTranscriptFetching] = useState(false);
const [transcriptFetchError, setTranscriptFetchError] = useState<string | null>(null);
const [transcriptSource, setTranscriptSource] = useState<'auto' | 'manual' | null>(null);
const abortControllerRef = useRef<AbortController | null>(null);
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

// Updated handleUrlChange with debounce and abort
const handleUrlChange = useCallback(async (value: string) => {
  setUrl(value);
  setError(null);
  setMetadata(null);
  setShowManualFallback(false);
  setTranscriptFetchError(null);

  // Cancel any pending debounce
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }

  // Cancel any in-flight request
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }

  if (!value.trim()) {
    setTranscript('');
    setTranscriptSource(null);
    return;
  }

  const parsed = parseYouTubeUrl(value);

  if (!parsed?.isValid) {
    setError('Please enter a valid YouTube URL');
    return;
  }

  // Debounce: wait 500ms after user stops typing
  debounceTimerRef.current = setTimeout(async () => {
    setLoading(true);

    const data = await fetchVideoMetadata(parsed.videoId);
    setLoading(false);

    if (data) {
      setMetadata(data);

      // Auto-fetch transcript
      setTranscriptFetching(true);
      setTranscriptFetchError(null);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        const transcriptRes = await fetch('/api/youtube/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: parsed.videoId }),
          signal: abortControllerRef.current.signal,
        });

        const transcriptData = await transcriptRes.json();

        if (transcriptData.success) {
          setTranscript(transcriptData.transcript);
          setTranscriptSource('auto');
        } else if (transcriptData.rateLimited) {
          setTranscriptFetchError('Please wait a moment before trying another video');
          setTranscriptSource('manual');
        } else {
          setTranscriptFetchError(transcriptData.error || 'Could not fetch transcript');
          setTranscriptSource('manual');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled, ignore
          return;
        }
        setTranscriptFetchError('Failed to fetch transcript');
        setTranscriptSource('manual');
      } finally {
        setTranscriptFetching(false);
        abortControllerRef.current = null;
      }
    } else {
      setShowManualFallback(true);
      setError('Could not fetch video details. Please enter them manually.');
    }
  }, 500); // 500ms debounce
}, []);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, []);

// Handle retry
const handleRetryTranscript = useCallback(async () => {
  const parsed = parseYouTubeUrl(url);
  if (!parsed?.videoId) return;

  setTranscriptFetching(true);
  setTranscriptFetchError(null);

  try {
    const res = await fetch('/api/youtube/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: parsed.videoId, forceRefresh: true }),
    });

    const data = await res.json();

    if (data.success) {
      setTranscript(data.transcript);
      setTranscriptSource('auto');
    } else {
      setTranscriptFetchError(data.error || 'Could not fetch transcript');
    }
  } catch {
    setTranscriptFetchError('Failed to fetch transcript');
  } finally {
    setTranscriptFetching(false);
  }
}, [url]);

// Pass new props to TranscriptSection
<TranscriptSection
  value={transcript}
  onChange={(value) => {
    setTranscript(value);
    // If user edits, switch to manual mode
    if (transcriptSource === 'auto' && value !== transcript) {
      setTranscriptSource('manual');
    }
  }}
  isFetching={transcriptFetching}
  fetchError={transcriptFetchError}
  source={transcriptSource}
  onRetryFetch={handleRetryTranscript}
/>
```

**TranscriptSection.tsx:**
```typescript
"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TranscriptInstructions } from "./TranscriptInstructions";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface TranscriptSectionProps {
  value: string;
  onChange: (value: string) => void;
  isFetching?: boolean;
  fetchError?: string | null;
  source?: 'auto' | 'manual' | null;
  onRetryFetch?: () => void;
}

export function TranscriptSection({
  value,
  onChange,
  isFetching,
  fetchError,
  source,
  onRetryFetch,
}: TranscriptSectionProps) {
  const charCount = value.length;

  // Loading state
  if (isFetching) {
    return (
      <div className="space-y-3">
        <Label className="text-base">Fetching transcript...</Label>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">
            Automatically fetching transcript from YouTube...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="transcript" className="text-base">
          {source === 'auto' ? 'Transcript' : 'Paste the transcript:'}
        </Label>
        {source === 'auto' && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            Auto-fetched from YouTube
          </span>
        )}
      </div>

      {fetchError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {fetchError}
            </span>
          </div>
          {onRetryFetch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetryFetch}
              className="shrink-0"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          )}
        </div>
      )}

      <TranscriptInstructions collapsed={source === 'auto'} />

      <Textarea
        id="transcript"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          source === 'auto'
            ? 'Transcript loaded. Edit if needed...'
            : 'Paste the full video transcript here...'
        }
        className="min-h-[300px] text-base leading-relaxed"
      />

      <p className="text-sm text-muted-foreground">
        {charCount.toLocaleString()} character{charCount !== 1 ? 's' : ''}
        {source === 'auto' && ' • You can edit the auto-fetched transcript'}
      </p>
    </div>
  );
}
```

**TranscriptInstructions.tsx:**
```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface TranscriptInstructionsProps {
  collapsed?: boolean;
}

export function TranscriptInstructions({ collapsed = false }: TranscriptInstructionsProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);

  if (collapsed && !isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-3 w-3" />
        How to get a transcript manually
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
      {collapsed && (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-3 w-3" />
          Hide instructions
        </button>
      )}
      <p className="mb-2 text-muted-foreground">
        To get the transcript from YouTube:
      </p>
      <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
        <li>Open the video on YouTube</li>
        <li>Click the &quot;...&quot; menu below the video</li>
        <li>Select &quot;Show transcript&quot;</li>
        <li>Click the three dots in the transcript panel</li>
        <li>Select &quot;Toggle timestamps&quot; (optional)</li>
        <li>Select all text and copy</li>
      </ol>
    </div>
  );
}
```

**What Could Break:**
- Debounce timer may fire after component unmounts (cleanup handles this)
- AbortError needs to be caught and ignored

**Done When:**
- [ ] Typing URL triggers fetch after 500ms pause
- [ ] Changing URL mid-fetch cancels previous request
- [ ] "✓ Auto-fetched" badge appears on success
- [ ] Error shows with "Retry" button on failure
- [ ] Manual paste still works as fallback
- [ ] Instructions collapse when auto-fetched
- [ ] Editing auto-fetched transcript works smoothly

---

## Notes

- **Package**: `youtube-transcript` (500k+ weekly downloads, reliable)
- **Fallback**: Manual paste always works if auto-fetch fails
- **Rate limiting**: 10 requests/minute per IP, with 5-minute cache
- **Debounce**: 500ms prevents rapid-fire requests while typing
- **AbortController**: Cancels stale requests when URL changes
- **Cycle 2 consideration**: When adding cron jobs, we'll need queue-based throttling with exponential backoff
