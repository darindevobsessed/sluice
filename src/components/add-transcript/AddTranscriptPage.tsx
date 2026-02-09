'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { OptionalFields } from '@/components/add-video/OptionalFields'
import { SuccessState } from '@/components/add-video/SuccessState'

export function AddTranscriptPage() {
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [transcript, setTranscript] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitError(null)
    setSubmitting(true)

    try {
      // Prepare tags array
      const tagsArray = tags
        ? tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : []

      // Submit to API
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceType: 'transcript',
          title,
          channel: source,
          transcript,
          tags: tagsArray,
          notes: notes || '',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setSubmitError(data.error || 'Failed to save transcript')
        setSubmitting(false)
        return
      }

      // Success!
      setSubmitted(true)
    } catch (err) {
      console.error('Submission error:', err)
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setTitle('')
    setSource('')
    setTranscript('')
    setTags('')
    setNotes('')
    setSubmitting(false)
    setSubmitted(false)
    setSubmitError(null)
  }

  const canSubmit = title.trim() && source.trim() && transcript.length >= 50

  // Show success state if submitted
  if (submitted) {
    return (
      <div className="p-6">
        <h1 className="mb-2 text-2xl font-semibold">Add a Transcript</h1>
        <p className="mb-8 text-muted-foreground">
          Import meeting notes, podcast transcripts, or any text content.
        </p>
        <SuccessState
          title={title}
          thumbnail={null}
          onReset={handleReset}
          description="Your transcript is ready to explore and generate plugin ideas."
        />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-semibold">Add a Transcript</h1>
      <p className="mb-8 text-muted-foreground">
        Import meeting notes, podcast transcripts, or any text content.
      </p>

      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-3">
          <Label htmlFor="title" className="text-base">
            Title
          </Label>
          <Input
            id="title"
            type="text"
            placeholder="Enter title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="source" className="text-base">
            Source
          </Label>
          <Input
            id="source"
            type="text"
            placeholder="e.g., Team Meeting, Podcast Name, Document..."
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="text-base"
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="transcript" className="text-base">
            Transcript
          </Label>
          <Textarea
            id="transcript"
            placeholder="Paste your transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="min-h-[300px] max-h-[500px] overflow-y-auto text-base leading-relaxed"
          />
          <p className="text-sm text-muted-foreground">
            {transcript.length} characters
          </p>
        </div>

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
              'Add to Knowledge Bank'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
