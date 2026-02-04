'use client';

import { VideoCard, VideoCardSkeleton } from '@/components/videos/VideoCard';
import type { Video } from '@/lib/db/schema';

interface VideoGridProps {
  videos: Video[];
  isLoading?: boolean;
}

export function VideoGrid({ videos, isLoading = false }: VideoGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          No results found
        </p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search terms
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
