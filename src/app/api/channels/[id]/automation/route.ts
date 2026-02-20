import { db, channels } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { updateChannelAutomation } from '@/lib/automation/queries'
import { startApiTimer } from '@/lib/api-timing'

const automationSchema = z.object({
  autoFetch: z.boolean().optional(),
  fetchIntervalHours: z.number().int().positive().optional(),
  feedUrl: z.string().url().optional(),
})

const channelIdSchema = z.string().regex(/^\d+$/, 'Channel ID must be a positive integer')

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = startApiTimer('/api/channels/[id]/automation', 'GET')
  try {
    const { id } = await params

    // Validate channel ID
    const idValidation = channelIdSchema.safeParse(id)
    if (!idValidation.success) {
      timer.end(400)
      return NextResponse.json(
        { error: idValidation.error.issues[0]?.message || 'Invalid channel ID' },
        { status: 400 }
      )
    }

    const channelId = parseInt(id, 10)

    // Look up the channel
    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)

    const channelData = channel[0]

    if (!channelData) {
      timer.end(404)
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    // Return automation settings
    timer.end(200)
    return NextResponse.json({
      feedUrl: channelData.feedUrl,
      autoFetch: channelData.autoFetch,
      fetchIntervalHours: channelData.fetchIntervalHours,
      lastFetchedAt: channelData.lastFetchedAt,
    })
  } catch (error) {
    console.error('Error fetching automation settings:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to fetch automation settings' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = startApiTimer('/api/channels/[id]/automation', 'PATCH')
  try {
    const { id } = await params

    // Validate channel ID
    const idValidation = channelIdSchema.safeParse(id)
    if (!idValidation.success) {
      timer.end(400)
      return NextResponse.json(
        { error: idValidation.error.issues[0]?.message || 'Invalid channel ID' },
        { status: 400 }
      )
    }

    const channelId = parseInt(id, 10)

    // Parse and validate request body
    const body = await request.json()
    const validationResult = automationSchema.safeParse(body)

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0]
      timer.end(400)
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      )
    }

    // Check if channel exists
    const existingChannel = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)

    if (!existingChannel[0]) {
      timer.end(404)
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    // Update automation settings
    const updatedChannel = await updateChannelAutomation(
      channelId,
      validationResult.data
    )

    timer.end(200)
    return NextResponse.json({
      channel: updatedChannel[0],
    })
  } catch (error) {
    console.error('Error updating automation settings:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to update automation settings' },
      { status: 500 }
    )
  }
}
