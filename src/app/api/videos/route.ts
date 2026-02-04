import { db, videos } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const videoSchema = z.object({
  youtubeId: z.string().min(1, "YouTube ID is required"),
  title: z.string().min(1, "Title is required"),
  channel: z.string().min(1, "Channel is required"),
  thumbnail: z.string().optional(),
  transcript: z.string().min(50, "Transcript must be at least 50 characters"),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

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

    const { youtubeId, title, channel, thumbnail, transcript } = validationResult.data;

    // Check if video already exists
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

    // Insert video into database
    const result = await db
      .insert(videos)
      .values({
        youtubeId,
        title,
        channel,
        thumbnail: thumbnail || null,
        transcript,
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
