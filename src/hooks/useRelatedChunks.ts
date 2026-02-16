'use client'

import { useState, useEffect } from 'react'
import type { RelatedChunk } from '@/lib/graph/types'

export function useRelatedChunks(videoId: number) {
  const [related, setRelated] = useState<RelatedChunk[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const abortController = new AbortController()
    let isStale = false

    fetch(`/api/videos/${videoId}/related`, { signal: abortController.signal })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch related chunks')
        }
        return res.json()
      })
      .then(data => {
        if (!isStale) {
          setRelated(data.related)
        }
      })
      .catch(err => {
        // Ignore abort errors
        if (err.name === 'AbortError') {
          return
        }
        if (!isStale) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!isStale) {
          setIsLoading(false)
        }
      })

    return () => {
      isStale = true
      abortController.abort()
    }
  }, [videoId])

  return { related, isLoading, error }
}
