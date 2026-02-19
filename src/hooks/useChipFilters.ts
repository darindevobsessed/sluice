'use client'

import { useMemo, useCallback } from 'react'
import { useURLParams } from '@/hooks/useURLParams'
import type { VideoListItem } from '@/lib/db/search'
import type { FocusArea } from '@/lib/db/schema'
import type { Chip } from '@/components/filters/ChipBar'

type FocusAreaMapEntry = Pick<FocusArea, 'id' | 'name' | 'color'>

interface UseChipFiltersOptions {
  videos: VideoListItem[]
  focusAreas: FocusArea[]
  focusAreaMap: Record<number, FocusAreaMapEntry[]>
}

interface UseChipFiltersResult {
  chips: Chip[]
  activeIds: Set<string>
  filteredVideos: VideoListItem[]
  handleToggle: (chipId: string) => void
}

const STATIC_CHIPS: Chip[] = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Recently Added' },
  { id: 'duration-short', label: 'Short (<5 min)', group: 'duration' },
  { id: 'duration-medium', label: 'Medium (5-30 min)', group: 'duration' },
  { id: 'duration-long', label: 'Long (30+ min)', group: 'duration' },
]

export function useChipFilters({
  videos,
  focusAreas,
  focusAreaMap,
}: UseChipFiltersOptions): UseChipFiltersResult {
  const { searchParams, updateParams } = useURLParams()

  const rawChips = searchParams.get('chips') || ''

  const activeIds = useMemo(() => {
    if (!rawChips.trim()) return new Set<string>()
    return new Set(rawChips.split(',').filter(Boolean))
  }, [rawChips])

  const chips = useMemo(() => {
    const focusChips: Chip[] = focusAreas.map(fa => ({
      id: `focus:${fa.id}`,
      label: fa.name,
      group: 'focus',
    }))
    return [...STATIC_CHIPS, ...focusChips]
  }, [focusAreas])

  const handleToggle = useCallback((chipId: string) => {
    if (chipId === 'all') {
      updateParams({ chips: null })
      return
    }

    const next = new Set(activeIds)
    if (next.has(chipId)) {
      next.delete(chipId)
    } else {
      next.add(chipId)
    }

    const joined = Array.from(next).join(',')
    updateParams({ chips: joined || null })
  }, [activeIds, updateParams])

  const filteredVideos = useMemo(() => {
    if (activeIds.size === 0) return videos

    // Group active chip IDs by their logical filter group.
    // duration-* chips share the 'duration' group (OR within group).
    // focus:* chips share the 'focus' group (OR within group).
    // All other chips (e.g. 'recent') are their own group.
    const groups: Record<string, string[]> = {}
    for (const id of activeIds) {
      const group = id.startsWith('duration-') ? 'duration'
        : id.startsWith('focus:') ? 'focus'
        : id
      if (!groups[group]) groups[group] = []
      groups[group]!.push(id)
    }

    // eslint-disable-next-line react-hooks/purity -- Date.now() is intentionally impure for time-based filtering
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const matchesChip = (v: VideoListItem, chipId: string): boolean => {
      if (chipId === 'recent') return v.createdAt >= sevenDaysAgo
      if (chipId === 'duration-short') return v.duration !== null && v.duration < 300
      if (chipId === 'duration-medium') return v.duration !== null && v.duration >= 300 && v.duration <= 1800
      if (chipId === 'duration-long') return v.duration !== null && v.duration > 1800
      if (chipId.startsWith('focus:')) {
        const faId = parseInt(chipId.slice(6), 10)
        return (focusAreaMap[v.id] ?? []).some(fa => fa.id === faId)
      }
      return true
    }

    // AND across groups, OR within group
    return videos.filter(v =>
      Object.values(groups).every(groupChipIds =>
        groupChipIds.some(chipId => matchesChip(v, chipId))
      )
    )
  }, [videos, activeIds, focusAreaMap])

  return { chips, activeIds, filteredVideos, handleToggle }
}
