import { db, videos, focusAreas, videoFocusAreas } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const assignFocusAreaSchema = z.object({
  focusAreaId: z.number().int().positive('Focus area ID is required'),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params
    const videoId = parseInt(idParam, 10)

    if (isNaN(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 })
    }

    // Check if video exists
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1)

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Get focus areas for this video
    const videoFocusAreasResult = await db
      .select({
        id: focusAreas.id,
        name: focusAreas.name,
        color: focusAreas.color,
        createdAt: focusAreas.createdAt,
      })
      .from(videoFocusAreas)
      .innerJoin(focusAreas, eq(videoFocusAreas.focusAreaId, focusAreas.id))
      .where(eq(videoFocusAreas.videoId, videoId))

    return NextResponse.json({ focusAreas: videoFocusAreasResult }, { status: 200 })
  } catch (error) {
    console.error('Error fetching video focus areas:', error)
    return NextResponse.json(
      { error: 'Failed to fetch focus areas. Please try again.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params
    const videoId = parseInt(idParam, 10)

    if (isNaN(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 })
    }

    const body = await request.json()

    const validationResult = assignFocusAreaSchema.safeParse(body)

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      )
    }

    const { focusAreaId } = validationResult.data

    // Check if video exists
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1)

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Check if focus area exists
    const [focusArea] = await db
      .select()
      .from(focusAreas)
      .where(eq(focusAreas.id, focusAreaId))
      .limit(1)

    if (!focusArea) {
      return NextResponse.json({ error: 'Focus area not found' }, { status: 404 })
    }

    // Check if assignment already exists
    const [existingAssignment] = await db
      .select()
      .from(videoFocusAreas)
      .where(
        and(
          eq(videoFocusAreas.videoId, videoId),
          eq(videoFocusAreas.focusAreaId, focusAreaId)
        )
      )
      .limit(1)

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Focus area already assigned to this video' },
        { status: 409 }
      )
    }

    // Create assignment
    await db.insert(videoFocusAreas).values({
      videoId,
      focusAreaId,
    })

    return new Response(null, { status: 201 })
  } catch (error) {
    console.error('Error assigning focus area:', error)
    return NextResponse.json(
      { error: 'Failed to assign focus area. Please try again.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params
    const videoId = parseInt(idParam, 10)

    if (isNaN(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const focusAreaIdParam = searchParams.get('focusAreaId')

    if (!focusAreaIdParam) {
      return NextResponse.json(
        { error: 'focusAreaId query parameter is required' },
        { status: 400 }
      )
    }

    const focusAreaId = parseInt(focusAreaIdParam, 10)

    if (isNaN(focusAreaId)) {
      return NextResponse.json({ error: 'Invalid focus area ID' }, { status: 400 })
    }

    // Check if video exists
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1)

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Check if assignment exists
    const [existingAssignment] = await db
      .select()
      .from(videoFocusAreas)
      .where(
        and(
          eq(videoFocusAreas.videoId, videoId),
          eq(videoFocusAreas.focusAreaId, focusAreaId)
        )
      )
      .limit(1)

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Focus area not assigned to this video' },
        { status: 404 }
      )
    }

    // Delete assignment
    await db
      .delete(videoFocusAreas)
      .where(
        and(
          eq(videoFocusAreas.videoId, videoId),
          eq(videoFocusAreas.focusAreaId, focusAreaId)
        )
      )

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('Error removing focus area:', error)
    return NextResponse.json(
      { error: 'Failed to remove focus area. Please try again.' },
      { status: 500 }
    )
  }
}
