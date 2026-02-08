'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, X } from 'lucide-react'

interface Suggestion {
  channelName: string
  videoCount: number
}

const DISMISS_KEY_PREFIX = 'persona-suggestion-dismissed:'

function isDismissed(channelName: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY_PREFIX + channelName) === 'true'
  } catch {
    return false
  }
}

function setDismissed(channelName: string): void {
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + channelName, 'true')
  } catch {
    // localStorage unavailable
  }
}

export function PersonaSuggestion() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [creating, setCreating] = useState<string | null>(null)
  const [created, setCreated] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const response = await fetch('/api/personas/suggest')
        if (!response.ok) return
        const data = await response.json()
        const filtered = (data.suggestions as Suggestion[]).filter(
          s => !isDismissed(s.channelName)
        )
        setSuggestions(filtered)
      } catch {
        // Silently fail — banner is non-critical
      }
    }
    fetchSuggestions()
  }, [])

  const handleCreate = useCallback(async (channelName: string) => {
    setCreating(channelName)
    setError(null)
    try {
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channelName }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create persona')
      }
      setCreated(prev => new Set(prev).add(channelName))
      // Remove from suggestions after short delay to show success
      setTimeout(() => {
        setSuggestions(prev => prev.filter(s => s.channelName !== channelName))
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create persona')
    } finally {
      setCreating(null)
    }
  }, [])

  const handleDismiss = useCallback((channelName: string) => {
    setDismissed(channelName)
    setSuggestions(prev => prev.filter(s => s.channelName !== channelName))
  }, [])

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-2">
      {suggestions.map(suggestion => (
        <div
          key={suggestion.channelName}
          className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm"
        >
          <Sparkles className="size-4 shrink-0 text-amber-500" />
          <span className="flex-1">
            {created.has(suggestion.channelName) ? (
              <span className="text-green-600 dark:text-green-400">
                Persona created for @{suggestion.channelName}!
              </span>
            ) : (
              <>
                <strong>@{suggestion.channelName}</strong> has {suggestion.videoCount} transcripts
                &mdash; Create a persona agent?
              </>
            )}
          </span>
          {!created.has(suggestion.channelName) && (
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                onClick={() => handleCreate(suggestion.channelName)}
                disabled={creating !== null}
              >
                {creating === suggestion.channelName ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => handleDismiss(suggestion.channelName)}
                disabled={creating === suggestion.channelName}
              >
                <X className="size-3" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </div>
          )}
        </div>
      ))}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
