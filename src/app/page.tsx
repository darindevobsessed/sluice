'use client';

import { useEffect, useState } from 'react';
import { StatsHeader, StatsHeaderSkeleton } from '@/components/videos/StatsHeader';
import { VideoSearch } from '@/components/videos/VideoSearch';
import { VideoGrid } from '@/components/videos/VideoGrid';
import { EmptyState } from '@/components/videos/EmptyState';
import { SearchResults } from '@/components/search/SearchResults';
import { useSearch } from '@/hooks/useSearch';
import { usePageTitle } from '@/components/layout/PageTitleContext';
import { useFocusArea } from '@/components/providers/FocusAreaProvider';
import type { Video } from '@/lib/db/schema';

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
  const { query, setQuery, results, isLoading: isSearching } = useSearch({ focusAreaId: selectedFocusAreaId });

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
  const showEmptyState = !isLoadingVideos && stats?.count === 0 && !query;
  const showSearchResults = query.trim().length > 0;

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
            <VideoSearch
              onSearch={setQuery}
              placeholder="Search videos and transcripts..."
            />
          </div>

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
