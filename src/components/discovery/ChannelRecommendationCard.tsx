'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SimilarChannel } from '@/lib/channels/similarity'

interface ChannelRecommendationCardProps {
  channel: SimilarChannel
  className?: string
}

export function ChannelRecommendationCard({ channel, className }: ChannelRecommendationCardProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [channelId, setChannelId] = useState<number | null>(null)
  const [isFollowLoading, setIsFollowLoading] = useState(false)
  const [isCronLoading, setIsCronLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFollow = async () => {
    setIsFollowLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/channels/similar/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: channel.channelName }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to follow channel')
        return
      }

      setIsFollowing(true)
      setChannelId(data.channel.id)
    } catch {
      setError('Failed to follow channel')
    } finally {
      setIsFollowLoading(false)
    }
  }

  const handleAddToCron = async () => {
    if (!channelId) return

    setIsCronLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/channels/${channelId}/automation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoFetch: true }),
      })

      if (!response.ok) {
        setError('Failed to enable automation')
        return
      }
    } catch {
      setError('Failed to enable automation')
    } finally {
      setIsCronLoading(false)
    }
  }

  const similarityPercentage = Math.round(channel.similarity * 100)

  return (
    <Card
      className={cn(
        'group overflow-hidden p-0 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] min-w-[280px] snap-start shrink-0',
        className
      )}
    >
      <div className="p-3 space-y-2">
        {/* Channel name */}
        <h3 className="font-semibold text-base">
          {channel.channelName}
        </h3>

        {/* Similarity badge */}
        <Badge variant="secondary">
          {similarityPercentage}% match
        </Badge>

        {/* Video count */}
        <p className="text-sm text-muted-foreground">
          {channel.videoCount} {channel.videoCount === 1 ? 'video' : 'videos'} in bank
        </p>

        {/* Sample video titles */}
        <div className="space-y-1">
          {channel.sampleTitles.slice(0, 3).map((title, index) => (
            <p
              key={index}
              className="text-sm text-muted-foreground line-clamp-1"
            >
              {title}
            </p>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {/* Follow button / Following badge */}
          {isFollowing ? (
            <Badge variant="secondary" className="w-full justify-center">
              Following
            </Badge>
          ) : (
            <Button
              onClick={handleFollow}
              disabled={isFollowLoading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isFollowLoading ? 'Following...' : 'Follow'}
            </Button>
          )}

          {/* Add to Cron button (only shown after following) */}
          {isFollowing && channelId && (
            <Button
              onClick={handleAddToCron}
              disabled={isCronLoading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isCronLoading ? 'Adding...' : 'Add to Cron'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
