'use client'

import { useEffect, useState } from 'react'
import { usePageTitle } from '@/components/layout/PageTitleContext'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { FollowChannelInput } from '@/components/discovery/FollowChannelInput'
import { ChannelSection } from '@/components/discovery/ChannelSection'
import { CatchUpSection } from '@/components/discovery/CatchUpSection'

interface Channel {
  id: number
  channelId: string
  name: string
  thumbnailUrl?: string | null
  feedUrl?: string | null
  autoFetch?: boolean | null
  lastFetchedAt?: Date | null
  fetchIntervalHours?: number | null
  createdAt: Date
}

export default function Discovery() {
  const { setPageTitle } = usePageTitle()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    setPageTitle({ title: 'Discovery' })
  }, [setPageTitle])

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('/api/channels')
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load channels')
          return
        }

        setChannels(data)
      } catch {
        setError('Failed to load channels')
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [])

  const handleChannelFollowed = (newChannel: Channel) => {
    setChannels((prev) => [newChannel, ...prev])
  }

  const handleUnfollow = async (channelId: number) => {
    try {
      const response = await fetch(`/api/channels/${channelId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        console.error('Failed to unfollow channel')
        return
      }

      // Remove from local state
      setChannels((prev) => prev.filter((ch) => ch.id !== channelId))
    } catch (err) {
      console.error('Failed to unfollow channel:', err)
    }
  }

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading channels...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400">Failed to load channels. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with follow input and refresh button */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <FollowChannelInput onChannelFollowed={handleChannelFollowed} />
        </div>
        {channels.length > 0 && (
          <Button
            variant="outline"
            size="default"
            onClick={handleRefresh}
            aria-label="Refresh all channels"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        )}
      </div>

      {/* Catch-up section - only when channels exist */}
      {channels.length > 0 && (
        <CatchUpSection />
      )}

      {/* Channel sections */}
      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="max-w-md space-y-4">
            <div className="text-6xl mb-4">🔭</div>
            <p className="text-lg font-medium text-foreground">
              No channels followed yet
            </p>
            <p className="text-muted-foreground">
              Follow a YouTube channel to discover new videos. Try these examples:
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-mono">https://youtube.com/@fireship</p>
              <p className="font-mono">https://youtube.com/@ThePrimeagen</p>
              <p className="font-mono">https://youtube.com/@TomScottGo</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {channels.map((channel) => (
            <ChannelSection
              key={channel.id}
              channel={channel}
              onUnfollow={handleUnfollow}
              refreshTrigger={refreshTrigger}
            />
          ))}
        </div>
      )}
    </div>
  )
}
