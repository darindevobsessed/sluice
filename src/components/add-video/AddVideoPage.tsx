"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { VideoPreviewCard } from "./VideoPreviewCard";
import { TranscriptSection } from "./TranscriptSection";
import { OptionalFields } from "./OptionalFields";
import { parseYouTubeUrl, fetchVideoMetadata } from "@/lib/youtube";
import type { VideoMetadata } from "@/lib/youtube";

export function AddVideoPage() {
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualChannel, setManualChannel] = useState("");
  const [transcript, setTranscript] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  const handleUrlChange = useCallback(async (value: string) => {
    setUrl(value);
    setError(null);
    setMetadata(null);
    setShowManualFallback(false);

    if (!value.trim()) {
      return;
    }

    const parsed = parseYouTubeUrl(value);

    if (!parsed?.isValid) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setLoading(true);

    const data = await fetchVideoMetadata(parsed.videoId);
    setLoading(false);

    if (data) {
      setMetadata(data);
    } else {
      setShowManualFallback(true);
      setError("Could not fetch video details. Please enter them manually.");
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    handleUrlChange(value);
  };

  const handleSubmit = () => {
    // TODO: Implement submission logic
    console.log("Submitting:", { url, metadata, transcript, tags, notes });
  };

  const hasValidMetadata = metadata || (manualTitle && manualChannel);
  const canSubmit = hasValidMetadata && transcript.length >= 50;

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-semibold">Add a Video</h1>
      <p className="mb-8 text-muted-foreground">
        Extract knowledge from YouTube videos and generate plugin ideas.
      </p>

      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-3">
          <Label htmlFor="youtube-url" className="text-base">
            What video would you like to add?
          </Label>
          <Input
            id="youtube-url"
            type="url"
            placeholder="Paste a YouTube URL here..."
            value={url}
            onChange={handleInputChange}
            aria-invalid={error ? true : undefined}
            className="text-base"
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {metadata && !loading && (
          <VideoPreviewCard metadata={metadata} />
        )}

        {showManualFallback && !loading && (
          <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium">Enter video details manually</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="manual-title">Video Title</Label>
                <Input
                  id="manual-title"
                  type="text"
                  placeholder="Enter video title"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-channel">Channel Name</Label>
                <Input
                  id="manual-channel"
                  type="text"
                  placeholder="Enter channel name"
                  value={manualChannel}
                  onChange={(e) => setManualChannel(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {hasValidMetadata && !loading && (
          <>
            <TranscriptSection
              value={transcript}
              onChange={setTranscript}
            />

            <OptionalFields
              tags={tags}
              notes={notes}
              onTagsChange={setTags}
              onNotesChange={setNotes}
            />

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                size="lg"
                className="min-w-[200px]"
              >
                Add to Knowledge Bank
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
