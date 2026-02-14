'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/time-utils'

export interface DiscoveryVideo {
  youtubeId: string
  title: string
  channelId: string
  channelName: string
  publishedAt: string
  description: string
  inBank: boolean
}

interface DiscoveryVideoCardProps {
  video: DiscoveryVideo
  className?: string
  isNew?: boolean
  focusAreas?: { id: number; name: string; color: string }[]
  returnTo?: string
}

export function DiscoveryVideoCard({ video, className, isNew = false, focusAreas, returnTo }: DiscoveryVideoCardProps) {
  const publishedDate = new Date(video.publishedAt)
  const relativeTime = formatRelativeTime(publishedDate)
  const thumbnailUrl = `https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg`
  const addUrl = `/add?url=https://youtube.com/watch?v=${video.youtubeId}${returnTo ? `&returnTo=${returnTo}` : ''}`

  return (
    <Card
      className={cn(
        'group overflow-hidden p-0 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden">
        <Image
          src={thumbnailUrl}
          alt={video.title}
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-105"
          unoptimized
        />
        {/* Green "new" dot */}
        {isNew && (
          <div className="absolute top-2 left-2 size-3 rounded-full bg-[#059669]" aria-label="New video" />
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="line-clamp-2 font-semibold leading-tight text-sm">
          {video.title}
        </h3>
        <p className="text-xs text-muted-foreground">
          {relativeTime}
        </p>

        {/* Focus area badges */}
        {focusAreas && focusAreas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {focusAreas.map((fa) => (
              <Badge key={fa.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                {fa.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Action: Add to Bank or In Bank badge */}
        {video.inBank ? (
          <Badge variant="secondary" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 transition-opacity duration-200">
            <svg
              className="size-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            In Bank
          </Badge>
        ) : (
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link href={addUrl}>
              Add to Bank
            </Link>
          </Button>
        )}
      </div>
    </Card>
  )
}

export function DiscoveryVideoCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card" data-testid="discovery-video-card-skeleton">
      {/* Thumbnail skeleton */}
      <div className="aspect-video w-full animate-pulse bg-muted" />

      {/* Content skeleton */}
      <div className="p-3 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
