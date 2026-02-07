'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
}

export function ChannelSection({ channel, onUnfollow }: ChannelSectionProps) {
  const [videos, setVideos] = useState<DiscoveryVideo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      }
    }

    fetchVideos()
  }, [channel.id])

  return (
    <div className="space-y-3">
      {/* Channel header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{channel.name}</h2>
          <p className="text-sm text-muted-foreground">@{channel.channelId}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUnfollow(channel.id)}
        >
          Unfollow
        </Button>
      </div>

      {/* Videos horizontal scroll */}
      <div
        data-testid="channel-videos-container"
        className="overflow-x-auto scroll-snap-type-x mandatory pb-2 -mx-6 px-6"
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
