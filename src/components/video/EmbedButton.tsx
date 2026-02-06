'use client';

import { Button } from '@/components/ui/button';
import { useEmbedding } from '@/hooks/useEmbedding';
import { Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';

interface EmbedButtonProps {
  videoId: number;
  hasTranscript: boolean;
}

/**
 * Button component for triggering and displaying embedding generation status
 */
export function EmbedButton({ videoId, hasTranscript }: EmbedButtonProps) {
  const { state, hasEmbeddings, chunkCount, error, embed } = useEmbedding(videoId);

  // Disabled if no transcript or currently loading
  const isDisabled = !hasTranscript || state === 'loading';

  // No transcript - show disabled state
  if (!hasTranscript) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/50 p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              No transcript available
            </p>
            <p className="text-xs text-muted-foreground/75">
              Transcript required to generate embeddings
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error' && error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">
              Embedding generation failed
            </p>
            <p className="text-xs text-destructive/75">{error}</p>
          </div>
        </div>
        <Button onClick={embed} size="sm" variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Loading state
  if (state === 'loading') {
    return (
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">Generating embeddings...</p>
            <p className="text-xs text-muted-foreground">
              This may take a minute for longer videos
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state or already embedded
  if (hasEmbeddings && chunkCount > 0) {
    return (
      <div className="rounded-lg border border-green-500/25 bg-green-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium">
                Embedded ({chunkCount} chunks)
              </p>
              <p className="text-xs text-muted-foreground">
                Vector embeddings ready for semantic search
              </p>
            </div>
          </div>
          <Button onClick={embed} size="sm" variant="outline">
            Re-embed
          </Button>
        </div>
      </div>
    );
  }

  // Idle state - not yet embedded
  return (
    <div className="rounded-lg border border-muted-foreground/25 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Generate Embeddings</p>
            <p className="text-xs text-muted-foreground">
              Enable semantic search for this video
            </p>
          </div>
        </div>
        <Button
          onClick={embed}
          disabled={isDisabled}
          size="sm"
          variant="default"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Embeddings
        </Button>
      </div>
    </div>
  );
}
