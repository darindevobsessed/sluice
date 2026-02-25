import { getSubtitles } from 'youtube-caption-extractor'
import { YoutubeTranscript } from '@danielxceron/youtube-transcript'
import type { TranscriptSegment } from '@/lib/transcript/types'

export interface TranscriptFetchResult {
  success: boolean;
  transcript: string | null;
  segments: TranscriptSegment[];
  error?: string;
  language?: string;
  fromCache?: boolean;
}

interface CachedResult {
  data: TranscriptFetchResult;
  expiresAt: number;
}

// In-memory cache to avoid re-fetching
const transcriptCache = new Map<string, CachedResult>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch transcript for a YouTube video.
 *
 * Uses youtube-caption-extractor (serverless-optimized) as primary,
 * falls back to @danielxceron/youtube-transcript for local dev.
 *
 * @param videoId - YouTube video ID (not full URL)
 * @returns Transcript data or error
 */
export async function fetchTranscript(
  videoId: string
): Promise<TranscriptFetchResult> {
  // Check cache first
  const cached = transcriptCache.get(videoId)
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true }
  }

  try {
    // Primary: youtube-caption-extractor (handles serverless/datacenter IPs)
    // Fallback: @danielxceron/youtube-transcript (reliable locally)
    let segments: TranscriptSegment[]

    try {
      const subtitles = await getSubtitles({ videoID: videoId, lang: 'en' })

      if (!subtitles || subtitles.length === 0) {
        throw new Error('No subtitles returned')
      }

      segments = subtitles.map((item) => ({
        timestamp: formatTimestamp(parseFloat(item.start)),
        seconds: Math.floor(parseFloat(item.start)),
        text: item.text.trim(),
      }))
    } catch {
      // Fall back to original library
      const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })

      if (!items || items.length === 0) {
        const result: TranscriptFetchResult = {
          success: false,
          transcript: null,
          segments: [],
          error: 'No transcript available for this video',
        }
        transcriptCache.set(videoId, {
          data: result,
          expiresAt: Date.now() + CACHE_TTL,
        })
        return result
      }

      segments = items.map((item) => ({
        timestamp: formatTimestamp(item.offset),
        seconds: Math.floor(item.offset),
        text: item.text.trim(),
      }))
    }

    // Build full transcript text with timestamps
    const transcript = segments
      .map((seg) => `${seg.timestamp}\n${seg.text}`)
      .join('\n\n')

    const result: TranscriptFetchResult = {
      success: true,
      transcript,
      segments,
      language: 'en',
    }

    // Cache successful result
    transcriptCache.set(videoId, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL,
    })

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    let errorMessage = `Failed to fetch transcript: ${message}`

    // Provide user-friendly error messages
    if (message.includes('disabled') || message.includes('Transcript is disabled')) {
      errorMessage = 'Transcripts are disabled for this video'
    } else if (message.includes('private') || message.includes('unavailable')) {
      errorMessage = 'Video is private or unavailable'
    } else if (message.includes('not found') || message.includes('No transcript')) {
      errorMessage = 'No transcript available for this video'
    }

    const result: TranscriptFetchResult = {
      success: false,
      transcript: null,
      segments: [],
      error: errorMessage,
    }

    // Cache failures briefly
    transcriptCache.set(videoId, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL,
    })

    return result
  }
}

/**
 * Clear cache for a specific video (useful for retry)
 */
export function clearTranscriptCache(videoId: string): void {
  transcriptCache.delete(videoId)
}

/**
 * Format seconds to timestamp string (MM:SS or H:MM:SS)
 */
function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
