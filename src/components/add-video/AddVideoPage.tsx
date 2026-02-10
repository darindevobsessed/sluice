"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { VideoPreviewCard } from "./VideoPreviewCard"
import { TranscriptSection } from "./TranscriptSection"
import { OptionalFields } from "./OptionalFields"
import { SuccessState } from "./SuccessState"
import { parseYouTubeUrl, fetchVideoMetadata } from "@/lib/youtube"
import type { VideoMetadata } from "@/lib/youtube"

export function AddVideoPage() {
  const searchParams = useSearchParams()
  const [url, setUrl] = useState("")
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showManualFallback, setShowManualFallback] = useState(false)
  const [manualTitle, setManualTitle] = useState("")
  const [manualChannel, setManualChannel] = useState("")
  const [transcript, setTranscript] = useState("")
  const [tags, setTags] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdVideoId, setCreatedVideoId] = useState<number | null>(null)

  // Transcript auto-fetch state
  const [transcriptFetching, setTranscriptFetching] = useState(false)
  const [transcriptFetchError, setTranscriptFetchError] = useState<string | null>(null)
  const [transcriptSource, setTranscriptSource] = useState<"auto" | "manual" | null>(null)

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const fetchTranscript = useCallback(async (videoId: string, forceRefresh = false) => {
    // Cancel any pending fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setTranscriptFetching(true);
    setTranscriptFetchError(null);

    try {
      const response = await fetch('/api/youtube/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, forceRefresh: forceRefresh || undefined }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch transcript');
      }

      setTranscript(data.transcript);
      setTranscriptSource("auto");
      setTranscriptFetchError(null);
    } catch (err) {
      // Check for AbortError from DOMException or Error
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        // Request was cancelled, ignore
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transcript';
      setTranscriptFetchError(errorMessage);
      setTranscriptSource("manual");
    } finally {
      setTranscriptFetching(false);
      abortControllerRef.current = null;
    }
  }, []);

  const handleRetryTranscript = useCallback(() => {
    const parsed = parseYouTubeUrl(url);
    if (parsed?.videoId) {
      fetchTranscript(parsed.videoId, true);
    }
  }, [url, fetchTranscript]);

  const handleUrlChange = useCallback(async (value: string) => {
    setUrl(value);
    setError(null);
    setMetadata(null);
    setShowManualFallback(false);
    setTranscript("");
    setTranscriptSource(null);
    setTranscriptFetchError(null);

    // Cancel pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Cancel in-flight transcript requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!value.trim()) {
      return;
    }

    const parsed = parseYouTubeUrl(value);

    if (!parsed?.isValid) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    // Debounce the metadata fetch
    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);

      const data = await fetchVideoMetadata(parsed.videoId);
      setLoading(false);

      if (data) {
        setMetadata(data);
        // Auto-fetch transcript after metadata loads
        fetchTranscript(parsed.videoId);
      } else {
        setShowManualFallback(true);
        setError("Could not fetch video details. Please enter them manually.");
      }
    }, 500);
  }, [fetchTranscript]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    handleUrlChange(value)
  }

  // Prefill URL from query param on mount
  useEffect(() => {
    const urlParam = searchParams.get('url')
    if (urlParam) {
      handleUrlChange(urlParam)
    }
  }, [searchParams, handleUrlChange])

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitting(true);

    try {
      // Parse video ID from URL
      const parsed = parseYouTubeUrl(url);
      if (!parsed?.videoId) {
        setSubmitError("Invalid YouTube URL");
        setSubmitting(false);
        return;
      }

      // Get title and channel from metadata or manual input
      const title = metadata?.title || manualTitle;
      const channel = metadata?.author_name || manualChannel;

      if (!title || !channel) {
        setSubmitError("Title and channel are required");
        setSubmitting(false);
        return;
      }

      // Prepare tags array
      const tagsArray = tags
        ? tags.split(",").map(tag => tag.trim()).filter(Boolean)
        : [];

      // Submit to API
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          youtubeId: parsed.videoId,
          title,
          channel,
          thumbnail: metadata?.thumbnail_url || null,
          transcript,
          tags: tagsArray,
          notes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error || "Failed to save video");
        setSubmitting(false);
        return;
      }

      // Success!
      setCreatedVideoId(data.video.id);
      setSubmitted(true);
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setUrl("");
    setMetadata(null);
    setError(null);
    setShowManualFallback(false);
    setManualTitle("");
    setManualChannel("");
    setTranscript("");
    setTags("");
    setNotes("");
    setSubmitting(false);
    setSubmitted(false);
    setSubmitError(null);
    setCreatedVideoId(null);
    setTranscriptFetching(false);
    setTranscriptFetchError(null);
    setTranscriptSource(null);
  };

  const hasValidMetadata = metadata || (manualTitle && manualChannel);
  const canSubmit = hasValidMetadata && transcript.length >= 50;

  // Show success state if submitted
  if (submitted) {
    const title = metadata?.title || manualTitle;
    const thumbnail = metadata?.thumbnail_url || null;

    return (
      <div className="p-6">
        <h1 className="mb-2 text-2xl font-semibold">Add a Video</h1>
        <p className="mb-8 text-muted-foreground">
          Extract knowledge from YouTube videos and generate plugin ideas.
        </p>
        <SuccessState
          title={title}
          thumbnail={thumbnail}
          onReset={handleReset}
          videoId={createdVideoId}
        />
      </div>
    );
  }

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
              onChange={(value) => {
                setTranscript(value);
                // If user manually edits, mark as manual
                if (transcriptSource === "auto" && value !== transcript) {
                  setTranscriptSource("manual");
                }
              }}
              isFetching={transcriptFetching}
              fetchError={transcriptFetchError}
              source={transcriptSource}
              onRetryFetch={handleRetryTranscript}
            />

            <OptionalFields
              tags={tags}
              notes={notes}
              onTagsChange={setTags}
              onNotesChange={setNotes}
            />

            {submitError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{submitError}</p>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                size="lg"
                className="min-w-[200px]"
              >
                {submitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  "Add to Knowledge Bank"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
