'use client'

import { useEffect, useState } from 'react'
import { useLastVisited } from '@/hooks/useLastVisited'
import { DiscoveryVideoCard } from './DiscoveryVideoCard'

interface DiscoveryVideo {
  youtubeId: string
  title: string
  channelId: string
  channelName: string
  publishedAt: string
  description: string
  inBank: boolean
}

export function CatchUpSection() {
  const { lastVisitedAt } = useLastVisited()
  const [videos, setVideos] = useState<DiscoveryVideo[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Don't fetch if no last visit (first visit)
    if (!lastVisitedAt) {
      return
    }

    const abortController = new AbortController()

    const fetchNewVideos = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/channels/videos?since=${encodeURIComponent(lastVisitedAt)}`,
          { signal: abortController.signal }
        )

        if (!response.ok) {
          throw new Error('Failed to fetch videos')
        }

        const data = await response.json()
        setVideos(data)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError('Failed to load new videos')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchNewVideos()

    return () => {
      abortController.abort()
    }
  }, [lastVisitedAt])

  // Don't render section if no last visit (first visit)
  if (!lastVisitedAt) {
    return null
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Catch Up</h2>
        <p className="text-muted-foreground">Loading new videos...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Catch Up</h2>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  // No videos loaded yet
  if (!videos) {
    return null
  }

  // All caught up (no new videos)
  if (videos.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Catch Up</h2>
        <div className="flex items-center gap-2 text-muted-foreground">
          <svg
            className="size-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>You&apos;re all caught up!</span>
        </div>
      </div>
    )
  }

  // Render videos
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        Catch Up ({videos.length} new)
      </h2>

      {/* Video grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {videos.map((video) => (
          <DiscoveryVideoCard
            key={video.youtubeId}
            video={video}
            isNew={true}
            className="min-w-0"
          />
        ))}
      </div>
    </div>
  )
}
