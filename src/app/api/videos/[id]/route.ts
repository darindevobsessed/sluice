import { db, videos } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videoId = parseInt(id, 10);

    // Validate ID is a valid number
    if (isNaN(videoId)) {
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
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    const video = result[0];

    return NextResponse.json(
      { video },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching video:", error);
    return NextResponse.json(
      { error: "Failed to fetch video. Please try again." },
      { status: 500 }
    );
  }
}
