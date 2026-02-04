"use client";

import { useState } from "react";

export function TranscriptInstructions() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-primary hover:text-primary-hover transition-colors"
      >
        How do I get this?
      </button>

      {isOpen && (
        <div className="rounded-md border border-border bg-muted/50 p-4 text-sm space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
            <li>Open the video on YouTube</li>
            <li>Click the ⋯ (three dots) below the video</li>
            <li>Select &quot;Show transcript&quot;</li>
            <li>Click anywhere in the transcript panel</li>
            <li>Press Ctrl+A (Cmd+A on Mac) to select all</li>
            <li>Press Ctrl+C (Cmd+C on Mac) to copy</li>
            <li>Paste here!</li>
          </ol>
        </div>
      )}
    </div>
  );
}
