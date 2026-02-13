import { Check, Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { TranscriptIcon } from "@/components/icons/TranscriptIcon";

interface SuccessStateProps {
  title: string;
  thumbnail?: string | null;
  onReset: () => void;
  description?: string;
  videoId?: number | null;
  sourceType?: 'youtube' | 'transcript';
  milestones?: {
    totalVideos: number;
    channelVideoCount: number;
    isNewChannel: boolean;
  };
}

function getMilestoneMessage(
  milestones: SuccessStateProps['milestones'],
): string | null {
  if (!milestones) return null
  if (milestones.totalVideos === 1)
    return 'Your first video — welcome to your knowledge bank'
  if (milestones.isNewChannel)
    return 'A new creator in your knowledge bank'
  if (milestones.totalVideos === 5)
    return '5 videos strong — your collection is taking shape'
  if (milestones.totalVideos === 10)
    return '10 videos and counting — building something valuable'
  if (milestones.totalVideos === 25)
    return '25 videos — your knowledge bank is a real resource'
  if (milestones.totalVideos === 50)
    return '50 videos — impressive dedication'
  if (milestones.totalVideos === 100)
    return '100 videos — a serious knowledge base'
  return null
}

export function SuccessState({ title, thumbnail, onReset, description, videoId, sourceType, milestones }: SuccessStateProps) {
  const milestoneMessage = getMilestoneMessage(milestones)

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in duration-200">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-8 w-8 text-primary" strokeWidth={3} />
        </div>

        {/* Success message */}
        <h2 className="mb-2 text-2xl font-semibold">
          Added to your Knowledge Bank!
        </h2>
        {milestoneMessage && (
          <p className="mb-6 text-sm text-primary animate-in fade-in duration-300">
            {milestoneMessage}
          </p>
        )}
        <p className="mb-8 text-muted-foreground">
          {description || 'Your video is ready to explore and generate plugin ideas.'}
        </p>

        {/* Content preview */}
        {thumbnail ? (
          <div className="mb-8 flex items-center justify-center gap-4">
            <Image
              src={thumbnail}
              alt={title}
              width={112}
              height={64}
              className="h-16 w-28 rounded-md object-cover"
            />
            <p className="max-w-md text-left text-sm font-medium">{title}</p>
          </div>
        ) : (
          <div className="mb-8 flex items-center justify-center gap-4">
            {sourceType === 'transcript' && (
              <div className="flex h-16 w-28 items-center justify-center rounded-md bg-muted">
                <TranscriptIcon className="h-8 w-8" />
              </div>
            )}
            <p className="max-w-md text-left text-sm font-medium">{title}</p>
          </div>
        )}

        {/* What's next section */}
        <div className="space-y-3 text-left">
          <p className="text-sm font-medium text-muted-foreground">What&apos;s next?</p>
          {videoId && (
            <Link href={`/videos/${videoId}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">View video details</p>
                <p className="text-muted-foreground">Explore the transcript, extract insights, and more</p>
              </div>
            </Link>
          )}
          <button onClick={onReset}
            className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-sm text-left transition-colors hover:bg-accent">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Add another video</p>
              <p className="text-muted-foreground">Keep building your knowledge bank</p>
            </div>
          </button>
          <Link href="/"
            className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent">
            <Search className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Browse Knowledge Bank</p>
              <p className="text-muted-foreground">Search across everything you&apos;ve collected</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
