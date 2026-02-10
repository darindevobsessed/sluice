'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePageTitle } from '@/components/layout/PageTitleContext'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { FollowChannelInput } from '@/components/discovery/FollowChannelInput'
import { DiscoveryVideoGrid } from '@/components/discovery/DiscoveryVideoGrid'
import { ChannelFilterDropdown } from '@/components/discovery/ChannelFilterDropdown'
import type { DiscoveryVideo } from '@/components/discovery/DiscoveryVideoCard'

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

interface BankVideo {
  id: number
  youtubeId: string
  title: string
  channel: string
  transcript: string
  thumbnail: string | null
  publishedAt: Date | null
  createdAt: Date
}

interface FocusArea {
  id: number
  name: string
  color: string | null
}

interface VideosAPIResponse {
  videos: BankVideo[]
  stats: Record<string, unknown>
  focusAreaMap: Record<number, FocusArea[]>
}

export default function Discovery() {
  const { setPageTitle } = usePageTitle()
  const [channels, setChannels] = useState<Channel[]>([])
  const [discoveryVideos, setDiscoveryVideos] = useState<DiscoveryVideo[]>([])
  const [focusAreaMap, setFocusAreaMap] = useState<Record<string, { id: number; name: string; color: string }[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)

  useEffect(() => {
    setPageTitle({ title: 'Discovery' })
  }, [setPageTitle])

  // Fetch videos and focus area map
  const fetchVideos = useCallback(async () => {
    setIsLoadingVideos(true)
    try {
      // Fetch all discovery videos
      const videosResponse = await fetch('/api/channels/videos')

      if (!videosResponse.ok) {
        console.error('Failed to fetch discovery videos')
        setDiscoveryVideos([])
        setFocusAreaMap({})
        return
      }

      const videos: DiscoveryVideo[] = await videosResponse.json()
      setDiscoveryVideos(videos)

      // Fetch bank videos to get focus area map
      const bankResponse = await fetch('/api/videos')

      if (!bankResponse.ok) {
        console.error('Failed to fetch bank videos')
        setFocusAreaMap({})
        return
      }

      const bankData: VideosAPIResponse = await bankResponse.json()

      // Remap focusAreaMap from DB id to youtubeId
      const youtubeIdMap: Record<string, { id: number; name: string; color: string }[]> = {}
      for (const video of bankData.videos) {
        const areas = bankData.focusAreaMap[video.id]
        if (areas && areas.length > 0 && video.youtubeId) {
          youtubeIdMap[video.youtubeId] = areas.map(fa => ({
            id: fa.id,
            name: fa.name,
            color: fa.color ?? '',
          }))
        }
      }

      setFocusAreaMap(youtubeIdMap)
    } catch (err) {
      console.error('Failed to fetch videos:', err)
      setDiscoveryVideos([])
      setFocusAreaMap({})
    } finally {
      setIsLoadingVideos(false)
    }
  }, [])

  // Initial load: fetch channels
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

        // If channels exist, fetch videos
        if (Array.isArray(data) && data.length > 0) {
          await fetchVideos()
        }
      } catch {
        setError('Failed to load channels')
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [fetchVideos])

  const handleChannelFollowed = async (newChannel: Channel) => {
    setChannels((prev) => [newChannel, ...prev])
    // Refetch videos after following a new channel
    await fetchVideos()
  }

  const handleRefresh = async () => {
    await fetchVideos()
  }

  // Filter videos by selected channel
  const filteredVideos = useMemo(() => {
    if (selectedChannelId === null) {
      return discoveryVideos
    }
    return discoveryVideos.filter((video) => video.channelId === selectedChannelId)
  }, [discoveryVideos, selectedChannelId])

  if (isLoading) {
    // Show skeleton grid while loading initial data
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start gap-3">
          <div className="flex-1 w-full">
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
        <DiscoveryVideoGrid videos={[]} isLoading={true} />
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
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header with follow input, filter, and refresh button */}
      <div className="flex flex-col sm:flex-row items-start gap-3">
        <div className="flex-1 w-full">
          <FollowChannelInput onChannelFollowed={handleChannelFollowed} />
        </div>
        {channels.length > 0 && (
          <>
            <ChannelFilterDropdown
              channels={channels}
              selectedChannelId={selectedChannelId}
              onChannelChange={setSelectedChannelId}
            />
            <Button
              variant="outline"
              size="default"
              onClick={handleRefresh}
              aria-label="Refresh all channels"
              className="w-full sm:w-auto"
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </>
        )}
      </div>

      {/* Empty state or video grid */}
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
        <DiscoveryVideoGrid
          videos={filteredVideos}
          isLoading={isLoadingVideos}
          focusAreaMap={focusAreaMap}
        />
      )}
    </div>
  )
}
