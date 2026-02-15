'use client';

import { VideoCard, VideoCardSkeleton } from '@/components/videos/VideoCard';
import type { Video, FocusArea } from '@/lib/db/schema';

interface VideoGridProps {
  videos: Video[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
  focusAreaMap?: Record<number, Pick<FocusArea, 'id' | 'name' | 'color'>[]>;
  allFocusAreas?: FocusArea[];
  onToggleFocusArea?: (videoId: number, focusAreaId: number) => void;
  returnTo?: string;
}

export function VideoGrid({
  videos,
  isLoading = false,
  emptyMessage,
  emptyHint,
  focusAreaMap,
  allFocusAreas,
  onToggleFocusArea,
  returnTo,
}: VideoGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">
          {emptyMessage || 'No results found'}
        </p>
        <p className="text-sm text-muted-foreground">
          {emptyHint || 'Try adjusting your search terms'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <div
          key={video.id}
          className="animate-in fade-in duration-300"
        >
          <VideoCard
            video={video}
            focusAreas={focusAreaMap?.[video.id]}
            allFocusAreas={allFocusAreas}
            onToggleFocusArea={onToggleFocusArea ? (faId) => onToggleFocusArea(video.id, faId) : undefined}
            returnTo={returnTo}
          />
        </div>
      ))}
    </div>
  )
}
