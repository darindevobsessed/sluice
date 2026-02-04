'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/videos/VideoPlayer';
import { TranscriptView } from '@/components/videos/TranscriptView';
import { VideoMetadata } from '@/components/videos/VideoMetadata';
import type { Video } from '@/lib/db/schema';

interface VideoDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function VideoDetailPage({ params }: VideoDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seekTime, setSeekTime] = useState<number | undefined>(undefined);

  // Fetch video data
  useEffect(() => {
    async function fetchVideo() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/videos/${id}`);

        if (response.status === 404) {
          setError('Video not found');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch video');
        }

        const data = await response.json();

        // Map dates from strings to Date objects
        const mappedVideo: Video = {
          ...data.video,
          createdAt: new Date(data.video.createdAt),
          updatedAt: new Date(data.video.updatedAt),
        };

        setVideo(mappedVideo);
      } catch (err) {
        console.error('Error fetching video:', err);
        setError('Failed to load video. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchVideo();
  }, [id]);

  // Handle seek from transcript
  const handleSeek = (seconds: number) => {
    setSeekTime(seconds);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-8 h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mb-4 h-10 w-full max-w-2xl animate-pulse rounded bg-muted" />
        <div className="mb-6 h-6 w-96 animate-pulse rounded bg-muted" />
        <div className="mx-auto mb-8 aspect-video w-full max-w-[800px] animate-pulse rounded-lg bg-muted" />
        <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  // Error state (404 or other errors)
  if (error || !video) {
    return (
      <div className="p-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Bank
          </Button>
        </Link>
        <div className="mx-auto max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-destructive">
            {error || 'Video not found'}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The video you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button onClick={() => router.push('/')} variant="outline">
            Return to Knowledge Bank
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Knowledge Bank
        </Button>
      </Link>

      {/* Video title */}
      <h1 className="mb-4 text-3xl font-semibold leading-tight">{video.title}</h1>

      {/* Metadata row */}
      <VideoMetadata video={video} className="mb-6" />

      {/* Video player */}
      <VideoPlayer
        youtubeId={video.youtubeId}
        seekTime={seekTime}
        className="mb-8"
      />

      {/* Extract Insights button (placeholder for Story 4) */}
      <div className="mb-8 flex justify-center">
        <Button
          disabled
          size="lg"
          className="opacity-50"
        >
          <Sparkles className="mr-2 h-5 w-5" />
          Extract Insights
          <span className="ml-2 text-xs">(Coming Soon)</span>
        </Button>
      </div>

      {/* Transcript section */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Transcript</h2>
        <p className="text-sm text-muted-foreground">
          Click any timestamp to jump to that moment in the video
        </p>
      </div>

      <TranscriptView
        transcript={video.transcript || ''}
        onSeek={handleSeek}
      />
    </div>
  );
}
