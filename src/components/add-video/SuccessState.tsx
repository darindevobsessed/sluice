import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function SuccessState({ title, thumbnail, onReset, description, videoId, sourceType }: SuccessStateProps) {
  // Determine the navigation link - if we have a videoId, link to the detail page; otherwise fallback to the list
  const primaryLink = videoId ? `/videos/${videoId}` : "/";
  return (
    <div className="mx-auto max-w-2xl animate-fadeIn">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-8 w-8 text-primary" strokeWidth={3} />
        </div>

        {/* Success message */}
        <h2 className="mb-2 text-2xl font-semibold">
          Added to your Knowledge Bank!
        </h2>
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

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href={primaryLink}>
              {videoId ? "View Video Details" : "View in Knowledge Bank"}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onReset}
            className="min-w-[200px]"
          >
            Add Another
          </Button>
        </div>
      </div>
    </div>
  );
}
