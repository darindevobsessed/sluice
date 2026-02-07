'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Video as VideoIcon } from 'lucide-react';
import type { VideoResult } from '@/lib/search/aggregate';
import type { SearchResult } from '@/lib/search/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChunkResult } from './ChunkResult';
import { FreshnessBadge } from './FreshnessBadge';

interface VideoResultGroupProps {
  video: VideoResult;
  chunks?: SearchResult[];
  className?: string;
}

/**
 * Displays a video search result with aggregated chunk information.
 * Can expand to show individual matching chunks.
 */
export function VideoResultGroup({
  video,
  chunks = [],
  className,
}: VideoResultGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const similarityPercent = Math.round(video.score * 100);
  const hasChunks = chunks.length > 0;

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Video card header */}
      <div className="p-4 hover:bg-accent/50 transition-colors">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-32 h-20 bg-muted rounded overflow-hidden relative">
            {video.thumbnail ? (
              <Image
                src={video.thumbnail}
                alt={video.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <VideoIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Video info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <Link
                href={`/videos/${video.videoId}`}
                className="text-base font-medium hover:underline line-clamp-2"
              >
                {video.title}
              </Link>

              {/* Similarity score */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  role="progressbar"
                  aria-valuenow={similarityPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-12 h-2 bg-muted rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${similarityPercent}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{similarityPercent}%</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-2">{video.channel}</p>

            {/* Best chunk preview */}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {video.bestChunk.content}
            </p>

            {/* Footer with match count, freshness badge, and expand button */}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">
                {video.matchedChunks} {video.matchedChunks === 1 ? 'match' : 'matches'}
              </Badge>

              <FreshnessBadge publishedAt={video.publishedAt} />

              {hasChunks && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs"
                >
                  {isExpanded ? (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded chunks */}
      {isExpanded && hasChunks && (
        <div className="border-t bg-accent/20 p-4 space-y-2">
          {chunks.map((chunk) => (
            <ChunkResult key={chunk.chunkId} chunk={chunk} />
          ))}
        </div>
      )}
    </div>
  );
}
