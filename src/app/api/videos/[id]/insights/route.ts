import { NextResponse } from 'next/server'
import { getExtractionForVideo, upsertExtraction } from '@/lib/db/insights'
import type { ExtractionResult } from '@/lib/claude/prompts/types'
import { startApiTimer } from '@/lib/api-timing'

/**
 * GET /api/videos/[id]/insights
 * Retrieve existing extraction for a video
 * Returns null if no extraction has been generated yet
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = parseInt(id, 10);
  const timer = startApiTimer(`/api/videos/${id}/insights`, 'GET')
  try {
    if (isNaN(videoId)) {
      timer.end(400)
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const result = await getExtractionForVideo(videoId);

    if (!result) {
      timer.end(200, { found: false })
      return NextResponse.json({
        extraction: null,
        generatedAt: null,
      });
    }

    timer.end(200, { found: true })
    return NextResponse.json({
      extraction: result.extraction,
      generatedAt: result.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/videos/[id]/insights
 * Save completed extraction (upserts - creates or replaces)
 * Called by client after streaming extraction completes
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = parseInt(id, 10);
  const timer = startApiTimer(`/api/videos/${id}/insights`, 'POST')
  try {
    if (isNaN(videoId)) {
      timer.end(400)
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const body = (await request.json()) as { extraction?: ExtractionResult };

    if (!body.extraction) {
      timer.end(400)
      return NextResponse.json(
        { error: 'Missing extraction in request body' },
        { status: 400 }
      );
    }

    const extraction = body.extraction;

    // Validate extraction has required fields
    if (!extraction.contentType || !extraction.summary) {
      timer.end(400)
      return NextResponse.json(
        { error: 'Invalid extraction format' },
        { status: 400 }
      );
    }

    const result = await upsertExtraction(videoId, extraction);

    timer.end(200)
    return NextResponse.json({
      extraction: result.extraction,
      generatedAt: result.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error saving insights:', error);
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to save insights' },
      { status: 500 }
    );
  }
}
