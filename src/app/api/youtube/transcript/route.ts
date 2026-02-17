import { NextResponse } from 'next/server';
import { fetchTranscript, clearTranscriptCache } from '@/lib/youtube/transcript';
import { z } from 'zod';

const requestSchema = z.object({
  videoId: z.string().min(1).max(20),
  forceRefresh: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
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
