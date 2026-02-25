import { YoutubeTranscript } from '@danielxceron/youtube-transcript';
import type { TranscriptSegment } from '@/lib/transcript/types';

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

interface InnerTubeTranscriptItem {
  text: string;
  duration: number;
  offset: number;
  lang: string;
}

// In-memory cache to avoid re-fetching
const transcriptCache = new Map<string, CachedResult>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g

/**
 * Fetch transcript via YouTube InnerTube API (bypasses HTML scraping).
 * Works from datacenter IPs where YouTube serves consent walls instead of video pages.
 */
async function fetchTranscriptInnerTube(videoId: string, lang = 'en'): Promise<InnerTubeTranscriptItem[]> {
  // Step 1: Get caption track URLs via InnerTube player API
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

  if (!captions || !captions.captionTracks?.length) {
    throw new Error('No transcripts available')
  }

  // Find the matching language track (prefer exact, then prefix, then ASR, then first)
  const tracks = captions.captionTracks
  const track =
    tracks.find((t: { languageCode: string }) => t.languageCode === lang) ||
    tracks.find((t: { languageCode: string }) => t.languageCode.startsWith(lang + '-')) ||
    tracks.find((t: { kind: string }) => t.kind === 'asr') ||
    tracks[0]

  // Step 2: Fetch the actual transcript XML
  const transcriptResponse = await fetch(track.baseUrl, {
    headers: {
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; Android 13)',
      ...(lang && { 'Accept-Language': lang }),
    },
  })

  if (!transcriptResponse.ok) {
    throw new Error('Failed to fetch transcript file')
  }

  const xml = await transcriptResponse.text()
  const results = [...xml.matchAll(RE_XML_TRANSCRIPT)]

  if (!results.length) {
    throw new Error('Empty transcript response')
  }

  return results
    .map((result) => ({
      text: decodeHtmlEntities(result[3] ?? ''),
      duration: parseFloat(result[2] ?? '0'),
      offset: parseFloat(result[1] ?? '0'),
      lang: track.languageCode,
    }))
    .filter((item) => item.text.trim() !== '')
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
 * Fetch transcript for a YouTube video
 *
 * @param videoId - YouTube video ID (not full URL)
 * @returns Transcript data or error
 */
export async function fetchTranscript(
  videoId: string
): Promise<TranscriptFetchResult> {
  // Check cache first
  const cached = transcriptCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, fromCache: true };
  }

  try {
    // Try library first, fall back to InnerTube API for datacenter environments
    let items;
    try {
      items = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    } catch (libraryError) {
      // Library fails on Vercel/datacenter IPs due to YouTube consent walls.
      // Fall back to InnerTube API which bypasses HTML scraping.
      items = await fetchTranscriptInnerTube(videoId, 'en');
    }

    if (!items || items.length === 0) {
      const result: TranscriptFetchResult = {
        success: false,
        transcript: null,
        segments: [],
        error: 'No transcript available for this video',
      };
      // Cache failures too (to avoid hammering YouTube)
      transcriptCache.set(videoId, {
        data: result,
        expiresAt: Date.now() + CACHE_TTL,
      });
      return result;
    }

    // Convert to our segment format
    const segments: TranscriptSegment[] = items.map((item) => ({
      timestamp: formatTimestamp(item.offset),
      seconds: Math.floor(item.offset),
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
    transcriptCache.set(videoId, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL,
    });

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
    transcriptCache.set(videoId, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL,
    });

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
