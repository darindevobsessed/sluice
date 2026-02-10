'use client'

import Link from 'next/link'
import type { RelatedChunk } from '@/lib/graph/types'

interface RelatedChunkCardProps {
  chunk: RelatedChunk
}

export function RelatedChunkCard({ chunk }: RelatedChunkCardProps) {
  const similarityPercent = Math.round(chunk.similarity * 100)

  return (
    <Link href={`/videos/${chunk.video.id}`}>
      <div className="rounded-xl border border-border bg-surface p-4 transition-shadow duration-200 hover:shadow-md">
        <div className="mb-2 flex items-center justify-between">
          {chunk.video.channel && (
            <span className="text-sm font-medium text-text-secondary">
              {chunk.video.channel}
            </span>
          )}
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {similarityPercent}% similar
          </span>
        </div>
        <h4 className="mb-2 font-medium leading-tight">
          {chunk.video.title}
        </h4>
        <p className="line-clamp-2 text-sm text-text-secondary">
          {chunk.content}
        </p>
      </div>
    </Link>
  )
}
