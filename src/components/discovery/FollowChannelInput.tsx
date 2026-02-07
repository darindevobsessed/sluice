'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface Channel {
  id: number
  channelId: string
  name: string
  thumbnailUrl?: string | null
  feedUrl?: string | null
  autoFetch?: boolean | null
  lastFetchedAt?: Date | null
  fetchIntervalHours?: number | null
  createdAt: Date
}

interface FollowChannelInputProps {
  onChannelFollowed: (channel: Channel) => void
}

export function FollowChannelInput({ onChannelFollowed }: FollowChannelInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateUrl = (input: string): boolean => {
    if (!input.trim()) {
      setError('Enter a valid YouTube URL')
      return false
    }

    // Basic YouTube URL validation
    const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
    if (!youtubePattern.test(input)) {
      setError('Enter a valid YouTube URL')
      return false
    }

    setError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateUrl(url)) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to follow channel')
        return
      }

      // Success: reset form and notify parent
      onChannelFollowed(data.channel)
      setUrl('')
      setIsOpen(false)
      setError(null)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-2">
        {!isOpen && (
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Follow a Channel
            </Button>
          </CollapsibleTrigger>
        )}

        <CollapsibleContent>
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="YouTube channel URL..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError(null)
                }}
                disabled={isLoading}
                className="flex-1"
                aria-invalid={error ? 'true' : 'false'}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Following...' : 'Follow'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsOpen(false)
                  setUrl('')
                  setError(null)
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </form>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
