'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, ArrowLeft, Trash2, AlertCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePersonaChat } from '@/hooks/usePersonaChat'
import { cn } from '@/lib/utils'

interface PersonaChatDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personaId: number
  personaName: string
  expertiseTopics?: string[]
}

interface PersonaAvatarProps {
  name: string
  className?: string
}

function PersonaAvatar({ name, className }: PersonaAvatarProps) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <div
      aria-hidden="true"
      className={cn(
        'size-10 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center shrink-0',
        className
      )}
    >
      {initial}
    </div>
  )
}

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function PersonaChatDrawer({
  open,
  onOpenChange,
  personaId,
  personaName,
  expertiseTopics,
}: PersonaChatDrawerProps) {
  const { state, sendMessage, clearHistory } = usePersonaChat(personaId)
  const [inputValue, setInputValue] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const topicLabel =
    expertiseTopics && expertiseTopics.length > 0
      ? expertiseTopics.slice(0, 3).join(', ')
      : undefined

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [state.messages])

  // Focus input when drawer opens
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [open])

  // Auto-scroll thread when virtual keyboard opens/closes on mobile
  useEffect(() => {
    if (!open) return

    function handleResize() {
      if (threadRef.current) {
        threadRef.current.scrollTop = threadRef.current.scrollHeight
      }
    }

    if (!window.visualViewport) return

    window.visualViewport.addEventListener('resize', handleResize)
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize)
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed || state.isStreaming) return
    setInputValue('')
    void sendMessage(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      // Always prevent default for Enter to stop form submit from bubbling
      e.preventDefault()
      // Only send on plain Enter (not Shift+Enter)
      if (e.shiftKey) return
      const trimmed = inputValue.trim()
      if (!trimmed || state.isStreaming) return
      setInputValue('')
      void sendMessage(trimmed)
    }
  }

  function handleRetry(question: string) {
    void sendMessage(question)
  }

  const hasMessages = state.messages.length > 0

  // Find the last error message question for the error banner retry
  const lastErrorMessage = state.error
    ? state.messages.findLast((m) => m.isError === true)
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          'flex flex-col p-0 gap-0',
          'md:w-[400px] md:max-w-[400px]',
          'max-md:w-screen max-md:max-w-none max-md:border-l-0'
        )}
      >
        {/* Header */}
        <SheetHeader className="flex-row items-center gap-3 px-4 py-3 border-b shrink-0">
          {/* Mobile back arrow */}
          <Button
            variant="ghost"
            size="icon-xs"
            className="md:hidden -ml-1"
            onClick={() => onOpenChange(false)}
            aria-label="Close chat"
          >
            <ArrowLeft />
          </Button>

          <PersonaAvatar name={personaName} />

          <div className="flex flex-col min-w-0 flex-1">
            <SheetTitle className="text-base leading-tight">{personaName}</SheetTitle>
            {topicLabel && (
              <SheetDescription className="truncate text-xs leading-tight mt-0.5">
                {topicLabel}
              </SheetDescription>
            )}
          </div>

          {/* Clear history button — only when messages exist */}
          {hasMessages && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={clearHistory}
              aria-label="Clear history"
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          )}
        </SheetHeader>

        {/* Message Thread */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4"
        >
          {/* Empty state */}
          {!hasMessages && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Ask {personaName} anything...
            </div>
          )}

          {/* Messages */}
          {state.messages.map((msg, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-150"
            >
              {/* Timestamp */}
              <p className="text-[11px] text-muted-foreground text-center">
                {formatTimestamp(msg.timestamp)}
              </p>

              {/* User question bubble */}
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-sm">
                  {msg.question}
                </div>
              </div>

              {/* Persona answer bubble */}
              <div className="flex items-end gap-2">
                <PersonaAvatar name={personaName} className="size-6 text-xs" />
                <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-bl-md bg-muted text-sm">
                  {msg.isError ? (
                    <span className="flex items-center gap-1.5 text-destructive">
                      <AlertCircle className="size-4 shrink-0" />
                      Something went wrong, try again
                    </span>
                  ) : msg.isStreaming && !msg.answer ? (
                    // Loading skeleton — streaming but no text yet
                    <div className="flex flex-col gap-1.5 py-0.5">
                      <div
                        data-testid="streaming-skeleton"
                        className="h-3 w-32 rounded bg-muted-foreground/20 animate-pulse"
                      />
                      <div
                        data-testid="streaming-skeleton"
                        className="h-3 w-24 rounded bg-muted-foreground/20 animate-pulse"
                      />
                    </div>
                  ) : (
                    <span>
                      {msg.answer}
                      {msg.isStreaming && (
                        <span className="motion-safe:animate-pulse">▌</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {state.error && lastErrorMessage && (
          <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center justify-between gap-2 shrink-0">
            <p className="text-sm text-destructive">{state.error}</p>
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleRetry(lastErrorMessage.question)}
              aria-label="Retry"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Independence disclaimer */}
        <p className="text-[11px] text-muted-foreground text-center py-1 px-4 shrink-0">
          Each question is independent — no conversation memory
        </p>

        {/* Input bar */}
        <form
          onSubmit={handleSubmit}
          className={cn(
            'flex items-center gap-2 px-4 pt-2 shrink-0 border-t',
            'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
          )}
        >
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${personaName} anything...`}
            disabled={state.isStreaming}
            className="rounded-full"
            aria-label={`Ask ${personaName} a question`}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || state.isStreaming}
            aria-label="Send message"
          >
            <Send />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
