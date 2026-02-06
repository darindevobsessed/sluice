import { NextResponse } from 'next/server';
import { db, videos, chunks } from '@/lib/db';
import { eq, and, isNotNull, count } from 'drizzle-orm';
import { parseTranscript } from '@/lib/transcript/parse';
import { chunkTranscript } from '@/lib/embeddings/chunker';
import { embedChunks } from '@/lib/embeddings/service';
import type { TranscriptSegment } from '@/lib/embeddings/types';

interface EmbedResponse {
  success: boolean;
  alreadyEmbedded?: boolean;
  chunkCount: number;
  durationMs?: number;
  relationshipsCreated?: number;
  error?: string;
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/videos/[id]/embed
 * Generate embeddings for a video transcript
 */
export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse<EmbedResponse>> {
  try {
    const { id } = await context.params;
    const videoId = parseInt(id, 10);

    if (isNaN(videoId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid video ID',
          chunkCount: 0,
        },
        { status: 400 }
      );
    }

    // Fetch video with transcript
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: 'Video not found',
          chunkCount: 0,
        },
        { status: 404 }
      );
    }

    // Check if video has transcript
    if (!video.transcript) {
      return NextResponse.json(
        {
          success: false,
          error: 'Video has no transcript',
          chunkCount: 0,
        },
        { status: 400 }
      );
    }

    // Check if already embedded (chunks exist with non-null embeddings)
    const [result] = await db
      .select({ count: count() })
      .from(chunks)
      .where(and(eq(chunks.videoId, videoId), isNotNull(chunks.embedding)));

    const existingChunkCount = result?.count ?? 0;

    if (existingChunkCount > 0) {
      return NextResponse.json({
        success: true,
        alreadyEmbedded: true,
        chunkCount: existingChunkCount,
      });
    }

    // Parse transcript into segments
    const parsedSegments = parseTranscript(video.transcript);

    // Convert parsed segments to TranscriptSegment format
    const segments: TranscriptSegment[] = parsedSegments.map((seg) => ({
      text: seg.text,
      offset: seg.seconds * 1000, // Convert seconds to milliseconds
    }));

    // Chunk transcript
    const chunkedSegments = chunkTranscript(segments);

    if (chunkedSegments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No chunks generated from transcript',
          chunkCount: 0,
        },
        { status: 400 }
      );
    }

    // Generate embeddings and store to database
    const embeddingResult = await embedChunks(chunkedSegments, undefined, videoId);

    if (embeddingResult.errorCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to generate embeddings for ${embeddingResult.errorCount} chunks`,
          chunkCount: embeddingResult.successCount,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyEmbedded: false,
      chunkCount: embeddingResult.successCount,
      durationMs: embeddingResult.durationMs,
      relationshipsCreated: embeddingResult.relationshipsCreated,
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        chunkCount: 0,
      },
      { status: 500 }
    );
  }
}
