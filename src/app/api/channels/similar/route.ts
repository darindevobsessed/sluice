import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, channels } from '@/lib/db'
import { findSimilarChannels } from '@/lib/channels/similarity'
import { startApiTimer } from '@/lib/api-timing'

const queryParamsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
})

export async function GET(request: Request) {
  const timer = startApiTimer('/api/channels/similar', 'GET')
  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const parseResult = queryParamsSchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      timer.end(400)
      return NextResponse.json(
        { error: firstError?.message || 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { limit } = parseResult.data

    // Fetch all followed channels
    const followedChannels = await db.select().from(channels)

    // Handle no followed channels
    if (followedChannels.length === 0) {
      timer.end(200)
      return NextResponse.json({
        suggestions: [],
        message: 'No followed channels to base recommendations on',
      })
    }

    // Extract channel names
    const channelNames = followedChannels.map(channel => channel.name)

    // Find similar channels
    const similarChannels = await findSimilarChannels(channelNames, { limit })

    // Handle no similar channels found
    if (similarChannels.length === 0) {
      timer.end(200)
      return NextResponse.json({
        suggestions: [],
        message: 'No similar channels found',
      })
    }

    // Return successful response
    timer.end(200)
    return NextResponse.json({
      suggestions: similarChannels,
    })
  } catch (error) {
    console.error('Error fetching similar channels:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to fetch similar channels' },
      { status: 500 }
    )
  }
}
