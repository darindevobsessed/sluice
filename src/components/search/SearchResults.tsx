'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, FileText } from 'lucide-react';
import type { SearchResponse } from '@/hooks/useSearch';
import type { SearchResult } from '@/lib/search/types';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChunkResult } from './ChunkResult';
import { VideoResultGroup } from './VideoResultGroup';

interface SearchResultsProps {
  results: SearchResponse | null;
  isLoading?: boolean;
  className?: string;
}

/**
 * Displays search results with tabs for "By Video" and "By Chunk" views.
 * Shows timing information and handles empty states.
 */
export function SearchResults({
  results,
  isLoading = false,
  className,
}: SearchResultsProps) {
  const [view, setView] = useState<'video' | 'chunk'>('video');

  // Loading state
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading search results"
        className={cn('space-y-4', className)}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border rounded-lg p-4 animate-pulse"
          >
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2 mb-2" />
            <div className="h-3 bg-muted rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  // No results yet
  if (!results) {
    return null;
  }

  const hasResults = results.videos.length > 0 || results.chunks.length > 0;

  // No embeddings message
  if (!results.hasEmbeddings && !hasResults) {
    return (
      <div className={cn('text-center py-12', className)}>
        <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No embeddings generated yet</h3>
        <p className="text-muted-foreground mb-4">
          Generate embeddings to enable semantic search
        </p>
        <Link
          href="/videos"
          className="text-sm text-primary hover:underline"
        >
          Go to videos to generate embeddings
        </Link>
      </div>
    );
  }

  // No results found
  if (!hasResults) {
    return (
      <div className={cn('text-center py-12', className)}>
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-muted-foreground">
          No results found for &quot;{results.query}&quot;
        </p>
      </div>
    );
  }

  const resultCount = view === 'video' ? results.videos.length : results.chunks.length;
  const resultLabel = resultCount === 1 ? 'result' : 'results';

  // Group chunks by video for expanded view
  const chunksByVideo = results.chunks.reduce((acc, chunk) => {
    if (!acc[chunk.videoId]) {
      acc[chunk.videoId] = [];
    }
    acc[chunk.videoId]?.push(chunk);
    return acc;
  }, {} as Record<number, SearchResult[]>);

  return (
    <div className={className}>
      {/* Header with timing */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Found {resultCount} {resultLabel} in {results.timing}ms
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'video' | 'chunk')}>
        <TabsList className="mb-4">
          <TabsTrigger value="video">
            By Video ({results.videos.length})
          </TabsTrigger>
          <TabsTrigger value="chunk">
            By Chunk ({results.chunks.length})
          </TabsTrigger>
        </TabsList>

        {/* By Video View */}
        <TabsContent value="video" className="space-y-4">
          {results.videos.map((video) => (
            <VideoResultGroup
              key={video.videoId}
              video={video}
              chunks={chunksByVideo[video.videoId] || []}
            />
          ))}
        </TabsContent>

        {/* By Chunk View */}
        <TabsContent value="chunk" className="space-y-4">
          {results.chunks.map((chunk) => (
            <ChunkResult key={chunk.chunkId} chunk={chunk} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
