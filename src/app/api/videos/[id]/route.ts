import { db, videos } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { startApiTimer } from '@/lib/api-timing'
import { requireSession } from '@/lib/auth-guards'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireSession()
  if (denied) return denied
  const timer = startApiTimer('/api/videos/[id]', 'GET')
  try {
    const { id } = await params;
    const videoId = parseInt(id, 10);

    // Validate ID is a valid number
    if (isNaN(videoId)) {
      timer.end(400)
      return NextResponse.json(
        { error: "Invalid video ID" },
        { status: 400 }
      );
    }

    // Fetch video by ID
    const result = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    // Return 404 if not found
    if (result.length === 0) {
      timer.end(404)
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    const video = result[0];

    timer.end(200)
    return NextResponse.json(
      { video },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching video:", error);
    timer.end(500)
    return NextResponse.json(
      { error: "Failed to fetch video. Please try again." },
      { status: 500 }
    );
  }
}
