import { Card, CardContent } from "@/components/ui/card";
import type { VideoMetadata } from "@/lib/youtube";
import Image from "next/image";

interface VideoPreviewCardProps {
  metadata: VideoMetadata;
  onEdit?: () => void;
}

export function VideoPreviewCard({ metadata }: VideoPreviewCardProps) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <div className="flex items-start gap-4">
          <div className="relative h-[90px] w-[120px] flex-shrink-0 overflow-hidden rounded-md">
            <Image
              src={metadata.thumbnail_url}
              alt={metadata.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <span>✓</span>
              <span>Looks good</span>
            </div>
            <h3 className="mb-1 font-semibold leading-tight">{metadata.title}</h3>
            <p className="text-sm text-muted-foreground">{metadata.author_name}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
