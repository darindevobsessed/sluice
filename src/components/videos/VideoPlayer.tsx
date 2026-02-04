'use client';

import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  youtubeId: string;
  seekTime?: number;
  className?: string;
}

/**
 * YouTube video player component with embedded iframe.
 * Supports seeking to specific timestamps via seekTime prop.
 *
 * @example
 * <VideoPlayer youtubeId="dQw4w9WgXcQ" seekTime={90} />
 */
export function VideoPlayer({ youtubeId, seekTime, className }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Update iframe src when seekTime changes
  useEffect(() => {
    if (iframeRef.current && seekTime !== undefined) {
      const baseUrl = `https://www.youtube.com/embed/${youtubeId}`;
      const urlWithTime = `${baseUrl}?start=${Math.floor(seekTime)}&autoplay=1`;

      // Only update if the URL has actually changed
      if (iframeRef.current.src !== urlWithTime) {
        iframeRef.current.src = urlWithTime;
      }
    }
  }, [youtubeId, seekTime]);

  const baseUrl = `https://www.youtube.com/embed/${youtubeId}`;
  const initialSrc = seekTime !== undefined
    ? `${baseUrl}?start=${Math.floor(seekTime)}&autoplay=1`
    : baseUrl;

  return (
    <div className={className}>
      <div className="relative mx-auto w-full max-w-[800px] overflow-hidden rounded-lg shadow-lg" style={{ aspectRatio: '16/9' }}>
        <iframe
          ref={iframeRef}
          src={initialSrc}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute left-0 top-0 h-full w-full"
        />
      </div>
    </div>
  );
}
