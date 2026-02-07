"use client";

import { useState, useEffect } from "react";

interface TranscriptInstructionsProps {
  collapsed?: boolean;
}

export function TranscriptInstructions({ collapsed = false }: TranscriptInstructionsProps) {
  // When collapsed=true: start closed, show small link
  // When collapsed=false: start open, show normal toggle
  const [isOpen, setIsOpen] = useState(!collapsed);

  // Close instructions when collapsed prop changes to true (e.g. auto-fetch completes)
  useEffect(() => {
    if (collapsed) {
      setIsOpen(false);
    }
  }, [collapsed]);

  if (collapsed && !isOpen) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline decoration-dotted"
        >
          How to get a transcript manually
        </button>
      </div>
    );
  }

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
