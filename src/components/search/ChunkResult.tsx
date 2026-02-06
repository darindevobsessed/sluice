'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock, Video } from 'lucide-react';
import type { SearchResult } from '@/lib/search/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChunkResultProps {
  chunk: SearchResult;
  highlightTerms?: string[];
  className?: string;
}

/**
 * Format seconds to HH:MM:SS or MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Highlight matching terms in content
 */
function highlightContent(content: string, terms?: string[]): React.ReactNode {
  if (!terms || terms.length === 0) {
    return content;
  }

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = content.split(regex);

  return parts.map((part, i) => {
    const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
    return isMatch ? (
      <mark key={i} className="bg-yellow-200 font-semibold">
        {part}
      </mark>
    ) : (
      part
    );
  });
}

/**
 * Displays a single chunk search result with video metadata,
 * timestamp link, and similarity score.
 */
export function ChunkResult({ chunk, highlightTerms, className }: ChunkResultProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const TRUNCATE_LENGTH = 200;
  const shouldTruncate = chunk.content.length > TRUNCATE_LENGTH;
  const displayContent =
    shouldTruncate && !isExpanded
      ? chunk.content.slice(0, TRUNCATE_LENGTH) + '...'
      : chunk.content;

  const similarityPercent = Math.round(chunk.similarity * 100);

  return (
    <div
      className={cn(
        'border rounded-lg p-4 hover:bg-accent/50 transition-colors',
        className
      )}
    >
      {/* Video metadata */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <Link
            href={`/videos/${chunk.videoId}`}
            className="text-sm font-medium hover:underline line-clamp-1"
          >
            {chunk.videoTitle}
          </Link>
          <p className="text-sm text-muted-foreground">{chunk.channel}</p>
        </div>

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

      {/* Chunk content */}
      <div className="text-sm mb-2">
        {highlightContent(displayContent, highlightTerms)}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {chunk.startTime !== null && (
            <Link
              href={`/videos/${chunk.videoId}?t=${chunk.startTime}`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="h-3 w-3" />
              <span>{formatTimestamp(chunk.startTime)}</span>
            </Link>
          )}
        </div>

        {shouldTruncate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </div>
    </div>
  );
}
