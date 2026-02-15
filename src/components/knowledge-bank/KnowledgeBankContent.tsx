'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { StatsHeader, StatsHeaderSkeleton } from '@/components/videos/StatsHeader'
import { VideoSearch } from '@/components/videos/VideoSearch'
import { VideoGrid } from '@/components/videos/VideoGrid'
import { EmptyState } from '@/components/videos/EmptyState'
import { SearchResults } from '@/components/search/SearchResults'
import { PersonaPanel } from '@/components/personas/PersonaPanel'
import { PersonaStatus } from '@/components/personas/PersonaStatus'
import { ContentTypeFilter, type KBContentTypeValue } from '@/components/videos/ContentTypeFilter'
import { FilterPillBar, type FilterPill } from '@/components/filters/FilterPillBar'
import { useSearch } from '@/hooks/useSearch'
import { useEnsemble } from '@/hooks/useEnsemble'
import { usePageTitle } from '@/components/layout/PageTitleContext'
import { useFocusArea } from '@/components/providers/FocusAreaProvider'
import { useURLParams } from '@/hooks/useURLParams'
import { buildReturnTo } from '@/lib/navigation'
import type { Video, FocusArea } from '@/lib/db/schema'

interface VideoStats {
  count: number;
  totalHours: number;
  channels: number;
}

type FocusAreaMapEntry = Pick<FocusArea, 'id' | 'name' | 'color'>

interface ApiResponse {
  videos: Video[];
  stats: VideoStats;
  focusAreaMap: Record<number, FocusAreaMapEntry[]>;
}

export function KnowledgeBankContent() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [focusAreaMap, setFocusAreaMap] = useState<Record<number, FocusAreaMapEntry[]>>({});
  const [hasActivePersonas, setHasActivePersonas] = useState(false);

  // Set page title
  const { setPageTitle } = usePageTitle();

  // Focus area filtering
  const { selectedFocusAreaId, focusAreas } = useFocusArea();

  // URL state with validation
  const { searchParams, updateParams } = useURLParams()
  const urlQuery = searchParams.get('q') || ''

  // Validate content type
  const VALID_KB_TYPES = ['all', 'youtube', 'transcript'] as const
  type KBContentType = typeof VALID_KB_TYPES[number]
  const rawType = searchParams.get('type')
  const contentType = (rawType && VALID_KB_TYPES.includes(rawType as KBContentType))
    ? (rawType as KBContentTypeValue)
    : 'all'

  // Compute returnTo for video detail navigation
  const returnTo = buildReturnTo('/', searchParams)

  // Use the search hook with URL query
  const { results, isLoading: isSearching } = useSearch({
    query: urlQuery,
    focusAreaId: selectedFocusAreaId
  })

  // Detect if query is a question (ends with ? and has 3+ words)
  const isQueryQuestion = urlQuery.trim().endsWith('?') && urlQuery.trim().split(/\s+/).filter(Boolean).length >= 3

  // Use ensemble hook when query is a question
  const { state: ensembleState, retry: retryEnsemble } = useEnsemble(isQueryQuestion ? urlQuery : null)

  // Set page title on mount
  useEffect(() => {
    setPageTitle({ title: 'Knowledge Bank' });
  }, [setPageTitle]);

  // Load videos (re-fetches when focus area changes)
  useEffect(() => {
    async function fetchVideos() {
      try {
        setIsLoadingVideos(true);
        const params = new URLSearchParams();
        if (selectedFocusAreaId !== null) {
          params.set('focusAreaId', String(selectedFocusAreaId));
        }
        const url = `/api/videos${params.toString() ? `?${params}` : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to fetch videos');
        }

        const data: ApiResponse = await response.json();

        // Map dates from strings to Date objects
        const mappedVideos = data.videos.map((video) => ({
          ...video,
          createdAt: new Date(video.createdAt),
          updatedAt: new Date(video.updatedAt),
        }));

        setVideos(mappedVideos);
        setStats(data.stats);
        setFocusAreaMap(data.focusAreaMap || {});
      } catch (error) {
        console.error('Error fetching videos:', error);
        setVideos([]);
        setStats({ count: 0, totalHours: 0, channels: 0 });
        setFocusAreaMap({});
      } finally {
        setIsLoadingVideos(false);
      }
    }

    fetchVideos();
  }, [selectedFocusAreaId]);

  // Filter videos by content type
  const filteredVideos = useMemo(() => {
    if (contentType === 'all') return videos
    return videos.filter(v => v.sourceType === contentType)
  }, [videos, contentType])

  // Build filter pills
  const filterPills = useMemo(() => {
    const pills: FilterPill[] = []
    if (contentType !== 'all') {
      const typeLabel = contentType === 'youtube' ? 'YouTube' : 'Transcript'
      pills.push({
        label: 'Type',
        value: typeLabel,
        onDismiss: () => updateParams({ type: null }),
      })
    }
    if (urlQuery.trim()) {
      pills.push({
        label: 'Search',
        value: `"${urlQuery}"`,
        onDismiss: () => updateParams({ q: null }),
      })
    }
    return pills
  }, [contentType, urlQuery, updateParams])

  // Clear all filters handler
  const handleClearAllFilters = useCallback(() => {
    updateParams({ type: null, q: null })
  }, [updateParams])

  // Search handler - updates URL query param
  const handleSearch = useCallback((q: string) => {
    updateParams({ q: q || null })
  }, [updateParams])

  // Type handler - updates URL type param
  const handleTypeChange = useCallback((type: string) => {
    updateParams({ type: type === 'all' ? null : type })
  }, [updateParams])

  // Optimistic toggle handler for focus area assignment
  const handleToggleFocusArea = useCallback(async (videoId: number, focusAreaId: number) => {
    const current = focusAreaMap[videoId] ?? []
    const isAssigned = current.some(fa => fa.id === focusAreaId)
    const area = focusAreas.find(fa => fa.id === focusAreaId)

    // Optimistic update
    if (isAssigned) {
      setFocusAreaMap(prev => ({
        ...prev,
        [videoId]: (prev[videoId] ?? []).filter(fa => fa.id !== focusAreaId),
      }))
    } else if (area) {
      setFocusAreaMap(prev => ({
        ...prev,
        [videoId]: [...(prev[videoId] ?? []), { id: area.id, name: area.name, color: area.color }],
      }))
    }

    try {
      if (isAssigned) {
        const response = await fetch(
          `/api/videos/${videoId}/focus-areas?focusAreaId=${focusAreaId}`,
          { method: 'DELETE' }
        )
        if (!response.ok) throw new Error('Failed to remove')
      } else {
        const response = await fetch(`/api/videos/${videoId}/focus-areas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ focusAreaId }),
        })
        if (!response.ok && response.status !== 201) throw new Error('Failed to assign')
      }
    } catch (error) {
      console.error('Failed to toggle focus area:', error)
      // Revert optimistic update
      if (isAssigned && area) {
        setFocusAreaMap(prev => ({
          ...prev,
          [videoId]: [...(prev[videoId] ?? []), { id: area.id, name: area.name, color: area.color }],
        }))
      } else {
        setFocusAreaMap(prev => ({
          ...prev,
          [videoId]: (prev[videoId] ?? []).filter(fa => fa.id !== focusAreaId),
        }))
      }
    }
  }, [focusAreaMap, focusAreas])

  // Show empty state only when no videos exist at all (not during search)
  const showEmptyState = !isLoadingVideos && stats?.count === 0 && !urlQuery
  const showSearchResults = urlQuery.trim().length > 0
  const showPanel = isQueryQuestion && urlQuery.trim().length > 0

  return (
    <div className="p-4 sm:p-6">
      {/* Stats Header */}
      {isLoadingVideos && !stats ? (
        <StatsHeaderSkeleton />
      ) : stats && stats.count > 0 ? (
        <StatsHeader
          count={stats.count}
          totalHours={stats.totalHours}
          channels={stats.channels}
          className="mb-6"
        />
      ) : null}

      {/* Persona Status */}
      {!showEmptyState && (
        <div className="mb-4">
          <PersonaStatus onActivePersonasChange={setHasActivePersonas} />
        </div>
      )}

      {/* Empty State - only show when no videos exist at all */}
      {showEmptyState ? (
        <EmptyState />
      ) : (
        <>
          {/* Search Bar */}
          <div className="mb-8">
            <VideoSearch onSearch={handleSearch} defaultValue={urlQuery} />
            {hasActivePersonas && (
              <p className="mt-2 text-xs text-muted-foreground">
                Type keywords to search · End with ? to ask your personas
              </p>
            )}
          </div>

          {/* Persona Panel - shows above search results when question detected */}
          {showPanel && (
            <div className="mb-8">
              <PersonaPanel question={urlQuery} state={ensembleState} onRetry={retryEnsemble} />
            </div>
          )}

          {/* Filter Pills */}
          <FilterPillBar
            pills={filterPills}
            onClearAll={handleClearAllFilters}
            className="mb-4"
          />

          {/* Content Type Filter - only visible when browsing grid */}
          {!showSearchResults && videos.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <ContentTypeFilter selected={contentType} onChange={handleTypeChange} />
            </div>
          )}

          {/* Content: either search results or video grid */}
          {showSearchResults ? (
            <SearchResults results={results} isLoading={isSearching} />
          ) : (
            <VideoGrid
              videos={filteredVideos}
              isLoading={isLoadingVideos}
              emptyMessage={selectedFocusAreaId ? 'No videos in this focus area' : undefined}
              emptyHint={selectedFocusAreaId ? 'Assign videos from their detail page or use the tag icon on cards' : undefined}
              focusAreaMap={focusAreaMap}
              allFocusAreas={focusAreas}
              onToggleFocusArea={handleToggleFocusArea}
              returnTo={returnTo || undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
