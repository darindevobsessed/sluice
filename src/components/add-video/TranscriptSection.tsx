"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TranscriptInstructions } from "./TranscriptInstructions";

interface TranscriptSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function TranscriptSection({ value, onChange }: TranscriptSectionProps) {
  const charCount = value.length;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="transcript" className="text-base">
          Now paste the transcript:
        </Label>
        <TranscriptInstructions />
      </div>

      <Textarea
        id="transcript"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the full video transcript here..."
        className="min-h-[300px] text-base leading-relaxed"
      />

      <p className="text-sm text-muted-foreground">
        {charCount.toLocaleString()} character{charCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
