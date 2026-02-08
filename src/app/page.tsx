'use client'

import { useEffect, useState } from 'react'
import { StatsHeader, StatsHeaderSkeleton } from '@/components/videos/StatsHeader'
import { VideoSearch } from '@/components/videos/VideoSearch'
import { VideoGrid } from '@/components/videos/VideoGrid'
import { EmptyState } from '@/components/videos/EmptyState'
import { SearchResults } from '@/components/search/SearchResults'
import { PersonaPanel } from '@/components/personas/PersonaPanel'
import { useSearch } from '@/hooks/useSearch'
import { useEnsemble } from '@/hooks/useEnsemble'
import { usePageTitle } from '@/components/layout/PageTitleContext'
import { useFocusArea } from '@/components/providers/FocusAreaProvider'
import type { Video } from '@/lib/db/schema'

/**
 * Detects if a query string looks like a question
 */
function isQuestion(query: string): boolean {
  const trimmed = query.trim()
  if (trimmed.endsWith('?')) return true
  return /^(how|what|why|when|where|who|which|can|should|is|are|do|does)\b/i.test(trimmed)
}

interface VideoStats {
  count: number;
  totalHours: number;
  channels: number;
}

interface ApiResponse {
  videos: Video[];
  stats: VideoStats;
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);

  // Set page title
  const { setPageTitle } = usePageTitle();

  // Focus area filtering
  const { selectedFocusAreaId } = useFocusArea();

  // Use the new search hook
  const { query, setQuery, results, isLoading: isSearching } = useSearch({ focusAreaId: selectedFocusAreaId })

  // Detect if query is a question (with 3+ words)
  const wordCount = query.trim().split(/\s+/).filter(Boolean).length
  const isQueryQuestion = isQuestion(query) && wordCount >= 3

  // Use ensemble hook when query is a question
  const { state: ensembleState } = useEnsemble(isQueryQuestion ? query : null)

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
      } catch (error) {
        console.error('Error fetching videos:', error);
        setVideos([]);
        setStats({ count: 0, totalHours: 0, channels: 0 });
      } finally {
        setIsLoadingVideos(false);
      }
    }

    fetchVideos();
  }, [selectedFocusAreaId]);

  // Show empty state only when no videos exist at all (not during search)
  const showEmptyState = !isLoadingVideos && stats?.count === 0 && !query
  const showSearchResults = query.trim().length > 0
  const showPanel = isQueryQuestion && query.trim().length > 0

  return (
    <div className="p-6">
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

      {/* Empty State - only show when no videos exist at all */}
      {showEmptyState ? (
        <EmptyState />
      ) : (
        <>
          {/* Search Bar */}
          <div className="mb-8">
            <VideoSearch onSearch={setQuery} />
          </div>

          {/* Persona Panel - shows above search results when question detected */}
          {showPanel && (
            <div className="mb-8">
              <PersonaPanel question={query} state={ensembleState} />
            </div>
          )}

          {/* Content: either search results or video grid */}
          {showSearchResults ? (
            <SearchResults results={results} isLoading={isSearching} />
          ) : (
            <VideoGrid videos={videos} isLoading={isLoadingVideos} />
          )}
        </>
      )}
    </div>
  );
}
