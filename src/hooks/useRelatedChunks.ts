'use client'

import { useState, useEffect } from 'react'
import type { RelatedChunk } from '@/lib/graph/types'

export function useRelatedChunks(videoId: number) {
  const [related, setRelated] = useState<RelatedChunk[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/videos/${videoId}/related`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch related chunks')
        }
        return res.json()
      })
      .then(data => setRelated(data.related))
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [videoId])

  return { related, isLoading, error }
}
