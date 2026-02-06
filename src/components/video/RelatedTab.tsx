'use client'

import { useRelatedChunks } from '@/hooks/useRelatedChunks'
import { RelatedChunkCard } from './RelatedChunkCard'

interface RelatedTabProps {
  videoId: number
}

export function RelatedTab({ videoId }: RelatedTabProps) {
  const { related, isLoading, error } = useRelatedChunks(videoId)

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border p-4" data-testid="loading-skeleton">
            <div className="mb-2 flex justify-between">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-5 w-20 rounded-full bg-muted" />
            </div>
            <div className="mb-2 h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load related content. Try refreshing.
        </p>
      </div>
    )
  }

  // Empty state
  if (related.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-secondary p-8 text-center">
        <p className="text-muted-foreground">
          No related content found yet. Add more videos to discover connections.
        </p>
      </div>
    )
  }

  // Results
  return (
    <div className="space-y-4">
      {related.map((chunk) => (
        <RelatedChunkCard key={chunk.chunkId} chunk={chunk} />
      ))}
    </div>
  )
}
