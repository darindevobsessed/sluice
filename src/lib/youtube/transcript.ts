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

interface RawTranscriptItem {
  text: string;
  duration: number;
  offset: number;
}

// In-memory cache to avoid re-fetching
const transcriptCache = new Map<string, CachedResult>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Two XML formats YouTube uses for transcripts
const RE_XML_STANDARD = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g
const RE_XML_ASR = /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g
const RE_XML_ASR_SEGMENT = /<s[^>]*>([^<]*)<\/s>/g

/**
 * Fetch transcript via YouTube InnerTube API.
 * Uses Android client which works from both local and datacenter IPs.
 * Handles both standard and ASR transcript XML formats.
 */
async function fetchTranscriptInnerTube(videoId: string, lang = 'en'): Promise<RawTranscriptItem[]> {
  const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; Android 13)',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.09.37',
          androidSdkVersion: 33,
          hl: lang,
          gl: 'US',
        },
      },
      videoId,
    }),
  })

  const data = await playerResponse.json()
  const captions = data?.captions?.playerCaptionsTracklistRenderer

  if (!captions?.captionTracks?.length) {
    throw new Error('Transcript is disabled on this video')
  }

  const tracks = captions.captionTracks as Array<{
    languageCode: string;
    kind?: string;
    baseUrl: string;
  }>

  // Find best matching track
  const track =
    tracks.find((t) => t.languageCode === lang) ||
    tracks.find((t) => t.languageCode.startsWith(lang + '-')) ||
    tracks.find((t) => t.kind === 'asr') ||
    tracks[0]!

  const transcriptResponse = await fetch(track.baseUrl, {
    headers: {
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; Android 13)',
      'Accept-Language': lang,
    },
  })

  if (!transcriptResponse.ok) {
    throw new Error('Failed to fetch transcript file')
  }

  const xml = await transcriptResponse.text()

  if (!xml || xml.length === 0) {
    throw new Error('Empty transcript response')
  }

  // Try standard format first: <text start="..." dur="...">...</text>
  const standardResults = [...xml.matchAll(RE_XML_STANDARD)]
  if (standardResults.length) {
    return standardResults
      .map((result) => ({
        text: decodeHtmlEntities(result[3] ?? ''),
        duration: parseFloat(result[2] ?? '0'),
        offset: parseFloat(result[1] ?? '0'),
      }))
      .filter((item) => item.text.trim() !== '')
  }

  // Try ASR format: <p t="..." d="...">...<s>...</s>...</p>
  const asrResults = [...xml.matchAll(RE_XML_ASR)]
  if (asrResults.length) {
    return asrResults
      .map((block) => {
        let text: string
        const segments = [...(block[3] ?? '').matchAll(RE_XML_ASR_SEGMENT)]
        if (segments.length) {
          text = segments.map((s) => s[1] ?? '').join('').trim()
        } else {
          text = (block[3] ?? '').replace(/<[^>]*>/g, '').trim()
        }

        return {
          text: decodeHtmlEntities(text),
          duration: Number(block[2] ?? '0') / 1000,
          offset: Number(block[1] ?? '0') / 1000,
        }
      })
      .filter((item) => item.text.trim() !== '')
  }

  throw new Error('No transcript content found in response')
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

/**
 * Fetch transcript for a YouTube video.
 *
 * Uses YouTube InnerTube API (Android client) which works from
 * both local machines and datacenter IPs (Vercel, AWS, etc).
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
    const items = await fetchTranscriptInnerTube(videoId, 'en')

    if (!items.length) {
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

    // Convert to our segment format
    const segments: TranscriptSegment[] = items.map((item) => ({
      timestamp: formatTimestamp(item.offset),
      seconds: Math.floor(item.offset),
      text: item.text.trim(),
    }))

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

    transcriptCache.set(videoId, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL,
    })

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    let errorMessage = `Failed to fetch transcript: ${message}`

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
