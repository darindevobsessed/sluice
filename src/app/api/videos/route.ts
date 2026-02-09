import { db, videos, searchVideos, getVideoStats, videoFocusAreas, focusAreas } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const videoSchema = z.object({
  youtubeId: z.string().min(1).optional(),
  sourceType: z.enum(['youtube', 'transcript']).default('youtube'),
  title: z.string().min(1, "Title is required"),
  channel: z.string().min(1, "Channel is required"),
  thumbnail: z.string().optional(),
  transcript: z.string().min(50, "Transcript must be at least 50 characters"),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  publishedAt: z.string().datetime().optional(), // ISO 8601 date string
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const focusAreaIdParam = searchParams.get('focusAreaId');

    // Validate focusAreaId if provided
    let focusAreaId: number | null = null;
    if (focusAreaIdParam) {
      const parsed = parseInt(focusAreaIdParam, 10);
      if (isNaN(parsed)) {
        return NextResponse.json({ error: 'Invalid focus area ID' }, { status: 400 });
      }
      focusAreaId = parsed;
    }

    // Search videos (empty query returns all videos)
    let videoResults = await searchVideos(query);

    // Filter by focus area if provided
    if (focusAreaId !== null) {
      // Get video IDs assigned to this focus area
      const assignedVideos = await db
        .select({ videoId: videoFocusAreas.videoId })
        .from(videoFocusAreas)
        .where(eq(videoFocusAreas.focusAreaId, focusAreaId));

      const videoIds = assignedVideos.map(v => v.videoId);

      // Filter videos to only those assigned to the focus area
      if (videoIds.length === 0) {
        videoResults = [];
      } else {
        videoResults = videoResults.filter(v => videoIds.includes(v.id));
      }
    }

    // Get stats
    const stats = await getVideoStats();

    // Build focus area map for all returned videos
    const videoIds = videoResults.map(v => v.id);
    const focusAreaMap: Record<number, { id: number; name: string; color: string | null }[]> = {};

    if (videoIds.length > 0) {
      const assignments = await db
        .select({
          videoId: videoFocusAreas.videoId,
          id: focusAreas.id,
          name: focusAreas.name,
          color: focusAreas.color,
        })
        .from(videoFocusAreas)
        .innerJoin(focusAreas, eq(videoFocusAreas.focusAreaId, focusAreas.id))
        .where(inArray(videoFocusAreas.videoId, videoIds));

      for (const row of assignments) {
        const list = focusAreaMap[row.videoId] ?? (focusAreaMap[row.videoId] = []);
        list.push({ id: row.id, name: row.name, color: row.color });
      }
    }

    return NextResponse.json(
      { videos: videoResults, stats, focusAreaMap },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = videoSchema.safeParse(body);

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid request data" },
        { status: 400 }
      );
    }

    const { youtubeId, sourceType, title, channel, thumbnail, transcript } = validationResult.data;

    // Conditional validation: YouTube type requires youtubeId
    if (sourceType === 'youtube' && !youtubeId) {
      return NextResponse.json(
        { error: "YouTube ID is required for YouTube videos" },
        { status: 400 }
      );
    }

    // Check for duplicate only for YouTube videos
    if (sourceType === 'youtube' && youtubeId) {
      const existingVideo = await db
        .select()
        .from(videos)
        .where(eq(videos.youtubeId, youtubeId))
        .limit(1);

      if (existingVideo.length > 0) {
        return NextResponse.json(
          { error: "This video has already been added to your Knowledge Bank" },
          { status: 409 }
        );
      }
    }

    // Insert video into database
    const result = await db
      .insert(videos)
      .values({
        youtubeId: youtubeId || null,
        sourceType,
        title,
        channel,
        thumbnail: thumbnail || null,
        transcript,
        publishedAt: validationResult.data.publishedAt
          ? new Date(validationResult.data.publishedAt)
          : null,
      })
      .returning();

    const createdVideo = result[0];

    return NextResponse.json(
      { video: createdVideo },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating video:", error);
    return NextResponse.json(
      { error: "Failed to save video. Please try again." },
      { status: 500 }
    );
  }
}
