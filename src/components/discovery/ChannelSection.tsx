'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { DiscoveryVideoCard, DiscoveryVideoCardSkeleton } from './DiscoveryVideoCard'

interface Channel {
  id: number
  channelId: string
  name: string
  createdAt: Date
}

interface DiscoveryVideo {
  youtubeId: string
  title: string
  channelId: string
  channelName: string
  publishedAt: string
  description: string
  inBank: boolean
}

interface ChannelSectionProps {
  channel: Channel
  onUnfollow: (channelId: number) => void
  refreshTrigger?: number
}

export function ChannelSection({ channel, onUnfollow, refreshTrigger }: ChannelSectionProps) {
  const [videos, setVideos] = useState<DiscoveryVideo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch(`/api/channels/${channel.id}/videos`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load videos')
          return
        }

        setVideos(data)
      } catch {
        setError('Failed to load videos')
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }

    fetchVideos()
  }, [channel.id, refreshTrigger])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setError(null)
    // Trigger re-fetch by updating a dependency - we'll do this by calling fetch directly
    const fetchVideos = async () => {
      try {
        const response = await fetch(`/api/channels/${channel.id}/videos`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load videos')
          return
        }

        setVideos(data)
      } catch {
        setError('Failed to load videos')
      } finally {
        setIsRefreshing(false)
      }
    }

    fetchVideos()
  }

  return (
    <div className="space-y-3">
      {/* Channel header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{channel.name}</h2>
          <p className="text-sm text-muted-foreground">@{channel.channelId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh channel"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUnfollow(channel.id)}
          >
            Unfollow
          </Button>
        </div>
      </div>

      {/* Videos horizontal scroll */}
      <div
        data-testid="channel-videos-container"
        className="overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {isLoading ? (
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <DiscoveryVideoCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400 py-4">
            Failed to load videos. Please try again.
          </div>
        ) : videos.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            No videos found for this channel.
          </div>
        ) : (
          <div className="flex gap-4">
            {videos.map((video) => (
              <DiscoveryVideoCard key={video.youtubeId} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
