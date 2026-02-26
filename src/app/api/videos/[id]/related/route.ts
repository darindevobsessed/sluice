import { NextResponse } from 'next/server'
import { getRelatedChunks } from '@/lib/graph/traverse'
import { startApiTimer } from '@/lib/api-timing'
import { requireSession } from '@/lib/auth-guards'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const denied = await requireSession()
  if (denied) return denied
  const timer = startApiTimer('/api/videos/[id]/related', 'GET')
  const { id } = await context.params
  const videoId = parseInt(id, 10)

  if (isNaN(videoId) || videoId <= 0) {
    timer.end(400)
    return NextResponse.json(
      { error: 'Invalid video ID' },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')
  const minSimilarity = parseFloat(searchParams.get('minSimilarity') || '0.75')

  try {
    const related = await getRelatedChunks(videoId, { limit, minSimilarity })
    timer.end(200)
    return NextResponse.json({ related })
  } catch (error) {
    console.error('Error getting related chunks:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
