import { NextResponse } from 'next/server'
import { getRelatedChunks } from '@/lib/graph/traverse'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const { id } = await context.params
  const videoId = parseInt(id, 10)

  if (isNaN(videoId) || videoId <= 0) {
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
    return NextResponse.json({ related })
  } catch (error) {
    console.error('Error getting related chunks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
