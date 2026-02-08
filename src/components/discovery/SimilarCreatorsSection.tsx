'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChannelRecommendationCard } from './ChannelRecommendationCard'
import type { SimilarChannel } from '@/lib/channels/similarity'

export function SimilarCreatorsSection() {
  const [channels, setChannels] = useState<SimilarChannel[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSimilarChannels = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/channels/similar', {
        signal,
      })

      if (!response.ok) {
        setError('Failed to load suggestions')
        return
      }

      const data = await response.json()
      setChannels(data.suggestions || [])
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Failed to load suggestions')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    fetchSimilarChannels(abortController.signal)

    return () => {
      abortController.abort()
    }
  }, [fetchSimilarChannels])

  const handleRefresh = () => {
    fetchSimilarChannels()
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Discover Similar Creators</h2>
        <p className="text-muted-foreground">Loading suggestions...</p>
        {/* Skeleton cards */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="min-w-[280px] shrink-0 rounded-xl border bg-card p-3 space-y-2"
            >
              <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-6 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="space-y-1">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-8 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Discover Similar Creators</h2>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  // No channels loaded yet
  if (!channels) {
    return null
  }

  // Empty state
  if (channels.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Discover Similar Creators</h2>
        <p className="text-muted-foreground">
          Follow more channels and add videos to get personalized suggestions
        </p>
      </div>
    )
  }

  // Render channels in horizontal scroll
  return (
    <div className="space-y-4">
      {/* Header with title and refresh button */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Discover Similar Creators</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label="Refresh suggestions"
        >
          <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Horizontal scroll container */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 scroll-smooth" style={{ scrollSnapType: 'x mandatory' }}>
        {channels.map((channel) => (
          <ChannelRecommendationCard
            key={channel.channelName}
            channel={channel}
          />
        ))}
      </div>
    </div>
  )
}
