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
