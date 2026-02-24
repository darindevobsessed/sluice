import { NextResponse } from 'next/server'
import { refreshDiscoveryVideos } from '@/lib/automation/rss'
import { startApiTimer } from '@/lib/api-timing'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function POST(_request: Request): Promise<NextResponse> {
  // Require authenticated session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const timer = startApiTimer('/api/channels/videos/refresh', 'POST')
  try {
    const result = await refreshDiscoveryVideos()
    timer.end(200, { videoCount: result.videoCount, channelCount: result.channelCount })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to refresh discovery videos:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to refresh discovery videos' },
      { status: 500 }
    )
  }
}

/**
 * Allow longer execution for RSS fetching across many channels.
 * Requires Vercel Pro plan.
 */
export const maxDuration = 30
