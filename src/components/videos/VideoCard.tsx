'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Video } from '@/lib/db/schema';

interface VideoCardProps {
  video: Video;
  className?: string;
}

/**
 * Format duration in seconds to display string (H:MM:SS or M:SS)
 */
function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function VideoCard({ video, className }: VideoCardProps) {
  const duration = formatDuration(video.duration);
  const dateAdded = formatDate(video.createdAt);

  return (
    <Link href={`/videos/${video.id}`}>
      <Card
        className={cn(
          'group overflow-hidden p-0 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]',
          className
        )}
      >
        {/* Thumbnail with duration badge */}
        <div className="relative aspect-video w-full overflow-hidden">
          {video.thumbnail ? (
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-muted-foreground">No thumbnail</span>
            </div>
          )}
          {duration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
              {duration}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="mb-1 line-clamp-2 font-semibold leading-tight">
            {video.title}
          </h3>
          <p className="mb-1 text-sm text-muted-foreground">
            {video.channel}
          </p>
          <p className="text-xs text-muted-foreground">
            {dateAdded}
          </p>
        </div>
      </Card>
    </Link>
  );
}

export function VideoCardSkeleton() {
  return (
    <div data-testid="video-card-skeleton" className="overflow-hidden rounded-xl border bg-card">
      {/* Thumbnail skeleton */}
      <div className="aspect-video w-full animate-pulse bg-muted" />

      {/* Content skeleton */}
      <div className="p-4 space-y-2">
        <div className="h-5 w-full animate-pulse rounded bg-muted" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
