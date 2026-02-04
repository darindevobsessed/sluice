'use client';

import { parseTranscript } from '@/lib/transcript/parse';
import { Button } from '@/components/ui/button';

interface TranscriptViewProps {
  transcript: string;
  onSeek: (seconds: number) => void;
  className?: string;
}

/**
 * Transcript viewer with clickable timestamps.
 * Parses transcript into segments and allows seeking to specific times.
 *
 * @example
 * <TranscriptView
 *   transcript="0:00\nIntro\n1:30\nMain content"
 *   onSeek={(seconds) => console.log(`Seek to ${seconds}s`)}
 * />
 */
export function TranscriptView({ transcript, onSeek, className }: TranscriptViewProps) {
  const segments = parseTranscript(transcript);

  // Handle empty transcript
  if (segments.length === 0) {
    return (
      <div className={className}>
        <div className="rounded-lg border bg-muted/30 p-8 text-center">
          <p className="text-muted-foreground">No transcript available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4 rounded-lg border bg-card p-6 max-h-[600px] overflow-y-auto">
        {segments.map((segment, index) => (
          <div key={`${segment.timestamp}-${index}`} className="group flex gap-4">
            {/* Timestamp button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSeek(segment.seconds)}
              className="shrink-0 rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {segment.timestamp}
            </Button>

            {/* Segment text */}
            <p className="flex-1 text-sm leading-relaxed text-foreground">
              {segment.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
