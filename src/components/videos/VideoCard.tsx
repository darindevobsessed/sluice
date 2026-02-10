'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Tag } from 'lucide-react';
import { TranscriptIcon } from '@/components/icons/TranscriptIcon';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Video, FocusArea } from '@/lib/db/schema';

interface VideoCardProps {
  video: Video;
  className?: string;
  focusAreas?: Pick<FocusArea, 'id' | 'name' | 'color'>[];
  allFocusAreas?: FocusArea[];
  onToggleFocusArea?: (focusAreaId: number) => void;
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

export function VideoCard({ video, className, focusAreas, allFocusAreas, onToggleFocusArea }: VideoCardProps) {
  const duration = formatDuration(video.duration);
  const dateAdded = formatDate(video.createdAt);
  const assignedIds = new Set(focusAreas?.map(fa => fa.id) ?? []);
  const showDropdown = allFocusAreas && allFocusAreas.length > 0 && onToggleFocusArea;

  return (
    <Card
      className={cn(
        'group relative overflow-hidden p-0 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]',
        className
      )}
    >
      {/* Overlay link — click-anywhere-to-navigate */}
      <Link href={`/videos/${video.id}`} className="absolute inset-0 z-0" />

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
            <TranscriptIcon className="h-10 w-10" />
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
        {video.channel && (
          <p className="mb-1 text-sm text-muted-foreground">
            {video.channel}
          </p>
        )}
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {dateAdded}
          </p>
          {showDropdown && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative z-10 inline-flex items-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Assign focus areas"
                >
                  <Tag className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {allFocusAreas.map((area) => (
                  <DropdownMenuCheckboxItem
                    key={area.id}
                    checked={assignedIds.has(area.id)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => onToggleFocusArea(area.id)}
                  >
                    {area.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {focusAreas && focusAreas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {focusAreas.map((fa) => (
              <Badge key={fa.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                {fa.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
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
