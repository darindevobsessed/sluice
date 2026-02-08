"use client";

import { useCallback, useState } from "react";

interface TranscriptInstructionsProps {
  collapsed?: boolean;
}

export function TranscriptInstructions({ collapsed = false }: TranscriptInstructionsProps) {
  // Track whether the user has manually toggled (overrides the collapsed prop)
  const [userToggled, setUserToggled] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  // Effective open state: user toggle takes precedence, otherwise derive from prop
  const isOpen = userToggled ? userOpen : !collapsed;

  const handleToggle = useCallback((open: boolean) => {
    setUserToggled(true);
    setUserOpen(open);
  }, []);

  if (collapsed && !isOpen) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleToggle(true)}
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
        onClick={() => handleToggle(!isOpen)}
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
