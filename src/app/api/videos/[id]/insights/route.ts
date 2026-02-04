import { getExtractionForVideo, upsertExtraction } from '@/lib/db/insights';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

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

  if (isNaN(videoId)) {
    return Response.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  const result = await getExtractionForVideo(videoId);

  if (!result) {
    return Response.json({
      extraction: null,
      generatedAt: null,
    });
  }

  return Response.json({
    extraction: result.extraction,
    generatedAt: result.updatedAt.toISOString(),
  });
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

  if (isNaN(videoId)) {
    return Response.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  const body = (await request.json()) as { extraction?: ExtractionResult };

  if (!body.extraction) {
    return Response.json(
      { error: 'Missing extraction in request body' },
      { status: 400 }
    );
  }

  const extraction = body.extraction;

  // Validate extraction has required fields
  if (!extraction.contentType || !extraction.summary) {
    return Response.json(
      { error: 'Invalid extraction format' },
      { status: 400 }
    );
  }

  const result = await upsertExtraction(videoId, extraction);

  return Response.json({
    extraction: result.extraction,
    generatedAt: result.updatedAt.toISOString(),
  });
}
