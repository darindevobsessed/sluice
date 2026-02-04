'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatsHeader, StatsHeaderSkeleton } from '@/components/videos/StatsHeader';
import { VideoSearch } from '@/components/videos/VideoSearch';
import { VideoGrid } from '@/components/videos/VideoGrid';
import { EmptyState } from '@/components/videos/EmptyState';
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
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch videos with optional search query
  const fetchVideos = useCallback(async (query: string) => {
    try {
      setIsLoading(true);
      const url = query
        ? `/api/videos?q=${encodeURIComponent(query)}`
        : '/api/videos';

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
      // On error, show empty state
      setVideos([]);
      setStats({ count: 0, totalHours: 0, channels: 0 });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchVideos('');
  }, [fetchVideos]);

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      fetchVideos(query);
    },
    [fetchVideos]
  );

  // Show empty state only when no videos exist at all (not during search)
  const showEmptyState = !isLoading && stats?.count === 0 && !searchQuery;

  return (
    <div className="p-6">
      <h1 className="mb-8 text-3xl font-semibold">Knowledge Bank</h1>

      {/* Stats Header */}
      {isLoading && !stats ? (
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
            <VideoSearch onSearch={handleSearch} />
          </div>

          {/* Video Grid */}
          <VideoGrid videos={videos} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
