'use client'

import { useMemo, useCallback } from 'react'
import { useURLParams } from '@/hooks/useURLParams'
import type { Video } from '@/lib/db/schema'

export const SORT_OPTIONS = [
  { id: 'added', label: 'Date Added' },
  { id: 'published', label: 'Date Published' },
  { id: 'duration', label: 'Duration' },
  { id: 'title', label: 'Title A-Z' },
] as const

export type SortOptionId = typeof SORT_OPTIONS[number]['id']

const VALID_SORT_IDS = new Set<string>(SORT_OPTIONS.map(o => o.id))

interface UseVideoSortOptions {
  videos: Video[]
}

interface UseVideoSortResult {
  sortedVideos: Video[]
  sortOption: SortOptionId
  setSortOption: (id: SortOptionId) => void
}

export function useVideoSort({ videos }: UseVideoSortOptions): UseVideoSortResult {
  const { searchParams, updateParams } = useURLParams()

  const rawSort = searchParams.get('sort') ?? ''
  const sortOption: SortOptionId = VALID_SORT_IDS.has(rawSort)
    ? (rawSort as SortOptionId)
    : 'added'

  const setSortOption = useCallback((id: SortOptionId) => {
    updateParams({ sort: id === 'added' ? null : id })
  }, [updateParams])

  const sortedVideos = useMemo(() => {
    const arr = [...videos]
    switch (sortOption) {
      case 'added':
        return arr.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      case 'published':
        return arr.sort((a, b) => {
          if (!a.publishedAt && !b.publishedAt) return 0
          if (!a.publishedAt) return 1
          if (!b.publishedAt) return -1
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        })
      case 'duration':
        return arr.sort((a, b) => {
          if (a.duration === null && b.duration === null) return 0
          if (a.duration === null) return 1
          if (b.duration === null) return -1
          return a.duration - b.duration
        })
      case 'title':
        return arr.sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        )
      default:
        return arr
    }
  }, [videos, sortOption])

  return { sortedVideos, sortOption, setSortOption }
}
