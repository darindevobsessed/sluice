'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { VideoPlayer } from '@/components/videos/VideoPlayer'
import { VideoMetadata } from '@/components/videos/VideoMetadata'
import { InsightsTabs } from '@/components/insights/InsightsTabs'
import { EmbedButton } from '@/components/video/EmbedButton'
import { FocusAreaAssignment } from '@/components/video/FocusAreaAssignment'
import { usePageTitle } from '@/components/layout/PageTitleContext'
import { Button } from '@/components/ui/button'
import { parseReturnTo } from '@/lib/navigation'
import type { Video } from '@/lib/db/schema'

interface VideoDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function VideoDetailPage({ params }: VideoDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [video, setVideo] = useState<Video | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seekTime, setSeekTime] = useState<number | undefined>(undefined)

  // Parse returnTo parameter
  const returnTo = parseReturnTo(searchParams.get('returnTo'))

  // Set page title
  const { setPageTitle } = usePageTitle()

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

  // Set page title when video loads or on error
  useEffect(() => {
    const backHref = returnTo || '/'
    const backLabel = returnTo?.startsWith('/discovery') ? 'Discovery' : 'Knowledge Bank'

    if (video) {
      setPageTitle({
        title: video.title,
        backHref,
        backLabel,
      })
    } else if (error) {
      setPageTitle({
        title: 'Video Not Found',
        backHref,
        backLabel,
      })
    }
  }, [video, error, setPageTitle, returnTo])

  // Handle seek from transcript
  const handleSeek = (seconds: number) => {
    setSeekTime(seconds);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 h-6 w-96 animate-pulse rounded bg-muted" />
        <div className="mx-auto mb-8 aspect-video w-full max-w-[800px] animate-pulse rounded-lg bg-muted" />
        <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  // Error state (404 or other errors)
  if (error || !video) {
    const backHref = returnTo || '/'
    const backLabel = returnTo?.startsWith('/discovery') ? 'Discovery' : 'Knowledge Bank'

    return (
      <div className="p-6">
        <div className="mx-auto max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-destructive">
            {error || 'Video not found'}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The video you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button onClick={() => router.push(backHref)} variant="outline">
            Return to {backLabel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Metadata row */}
      <VideoMetadata video={video} className="mb-6" />

      {/* Focus area assignment */}
      <FocusAreaAssignment videoId={video.id} />

      {/* Video player - only for YouTube videos */}
      {video.sourceType === 'youtube' && video.youtubeId && (
        <VideoPlayer
          youtubeId={video.youtubeId}
          seekTime={seekTime}
          className="mb-8"
        />
      )}

      {/* Embedding status and generation */}
      <EmbedButton
        videoId={video.id}
        hasTranscript={!!video.transcript}
      />

      {/* Tabs with Transcript and Insights */}
      <InsightsTabs video={video} onSeek={handleSeek} className="mt-8" />
    </div>
  );
}
