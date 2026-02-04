import { formatDuration } from '@/lib/transcript/parse';
import type { Video } from '@/lib/db/schema';

interface VideoMetadataProps {
  video: Video;
  className?: string;
}

/**
 * Format date to "Added Month Day, Year" format
 */
function formatDateAdded(date: Date): string {
  return `Added ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

/**
 * Video metadata display component.
 * Shows channel name, date added, and duration.
 *
 * @example
 * <VideoMetadata video={videoData} />
 */
export function VideoMetadata({ video, className }: VideoMetadataProps) {
  const dateAdded = formatDateAdded(video.createdAt);
  const duration = video.duration ? formatDuration(video.duration) : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {/* Channel name */}
        <span className="font-medium">{video.channel}</span>

        {/* Separator */}
        <span className="text-muted-foreground/50">•</span>

        {/* Date added */}
        <span>{dateAdded}</span>

        {/* Duration (if available) */}
        {duration && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <span>{duration}</span>
          </>
        )}
      </div>
    </div>
  );
}
