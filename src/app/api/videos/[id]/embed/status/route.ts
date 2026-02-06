import { NextResponse } from 'next/server';
import { db, chunks } from '@/lib/db';
import { eq, isNotNull, count, and } from 'drizzle-orm';

interface StatusResponse {
  hasEmbeddings: boolean;
  chunkCount: number;
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/videos/[id]/embed/status
 * Check if a video has embeddings
 */
export async function GET(
  request: Request,
  context: RouteContext
): Promise<NextResponse<StatusResponse>> {
  try {
    const { id } = await context.params;
    const videoId = parseInt(id, 10);

    if (isNaN(videoId)) {
      return NextResponse.json(
        {
          hasEmbeddings: false,
          chunkCount: 0,
        },
        { status: 400 }
      );
    }

    // Count chunks with non-null embeddings
    const [result] = await db
      .select({ count: count() })
      .from(chunks)
      .where(and(eq(chunks.videoId, videoId), isNotNull(chunks.embedding)));

    const chunkCount = result?.count ?? 0;

    return NextResponse.json({
      hasEmbeddings: chunkCount > 0,
      chunkCount,
    });
  } catch (error) {
    console.error('Error checking embedding status:', error);
    return NextResponse.json(
      {
        hasEmbeddings: false,
        chunkCount: 0,
      },
      { status: 500 }
    );
  }
}
