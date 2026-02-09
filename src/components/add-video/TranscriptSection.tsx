"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TranscriptInstructions } from "./TranscriptInstructions";
import { Check, RefreshCw, AlertCircle } from "lucide-react";

interface TranscriptSectionProps {
  value: string;
  onChange: (value: string) => void;
  isFetching?: boolean;
  fetchError?: string | null;
  source?: "auto" | "manual" | null;
  onRetryFetch?: () => void;
}

export function TranscriptSection({
  value,
  onChange,
  isFetching = false,
  fetchError = null,
  source = null,
  onRetryFetch,
}: TranscriptSectionProps) {
  const charCount = value.length;
  const isCollapsed = source === "auto";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="transcript" className="text-base">
            {source === "auto" ? "Transcript:" : "Now paste the transcript:"}
          </Label>
          {isFetching && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Fetching transcript...
            </span>
          )}
          {source === "auto" && !isFetching && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Auto-fetched from YouTube
            </span>
          )}
        </div>
        <TranscriptInstructions collapsed={isCollapsed} />
      </div>

      {fetchError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="text-sm text-destructive">{fetchError}</p>
            {onRetryFetch && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetryFetch}
                className="h-8"
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      <Textarea
        id="transcript"
        name="transcript"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the full video transcript here..."
        className="min-h-[300px] max-h-[500px] overflow-y-auto text-base leading-relaxed"
        disabled={isFetching}
      />

      <p className="text-sm text-muted-foreground">
        {charCount.toLocaleString()} character{charCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
