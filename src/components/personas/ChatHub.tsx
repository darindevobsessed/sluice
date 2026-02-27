'use client'

import { useMemo } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getAllPersonaChatIds,
  loadChatStorage,
  getLastMessage,
  isChatMessage,
  type ChatMessage,
} from '@/lib/personas/chat-storage'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Persona {
  id: number
  name: string
  channelName: string
  expertiseTopics: string[]
}

export interface ConversationSummary {
  persona: Persona
  lastMessage: ChatMessage
}

export interface ChatHubProps {
  personas: Persona[]
  isLoading: boolean
  onSelectPersona: (persona: Persona) => void
  onClose: () => void
}

// ── Helper functions ───────────────────────────────────────────────────────────

/**
 * Formats a timestamp as a relative human-readable string.
 * Returns "just now", "Xm ago", "Xh ago", "Xd ago", or "Mon DD".
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

/**
 * Truncates text to maxLen characters, appending "..." if truncated.
 */
export function truncatePreview(text: string, maxLen = 40): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}...`
}

// ── PersonaInitial component ───────────────────────────────────────────────────

interface PersonaInitialProps {
  name: string
  className?: string
}

export function PersonaInitial({ name, className }: PersonaInitialProps) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <div
      aria-hidden="true"
      className={cn(
        'size-9 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center shrink-0 text-sm',
        className
      )}
    >
      {initial}
    </div>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      data-testid="hub-skeleton-row"
      className="flex items-center gap-3 px-4 py-3"
    >
      <div className="size-9 rounded-full bg-muted animate-pulse shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
        <div className="h-3 w-40 rounded bg-muted animate-pulse" />
      </div>
    </div>
  )
}

// ── ChatHub component ─────────────────────────────────────────────────────────

export function ChatHub({
  personas,
  isLoading,
  onSelectPersona,
  onClose,
}: ChatHubProps) {
  // Build a set of persona IDs for quick lookup
  const personaIdSet = useMemo(
    () => new Set(personas.map((p) => p.id)),
    [personas]
  )

  // Build persona lookup map
  const personaById = useMemo(
    () => new Map(personas.map((p) => [p.id, p])),
    [personas]
  )

  // Compute recent conversations from localStorage
  const recentConversations = useMemo((): ConversationSummary[] => {
    const chatIds = getAllPersonaChatIds()

    const summaries: ConversationSummary[] = []

    for (const id of chatIds) {
      // Skip orphaned conversations (persona no longer in the list)
      if (!personaIdSet.has(id)) continue

      const persona = personaById.get(id)
      if (!persona) continue

      const storage = loadChatStorage(id)
      const realEntries = storage.entries.filter(
        (e) => isChatMessage(e) && !e.isError
      )
      if (realEntries.length === 0) continue

      const lastMessage = getLastMessage(storage.entries)
      if (!lastMessage) continue

      summaries.push({ persona, lastMessage })
    }

    // Sort by timestamp descending (newest first)
    summaries.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp)

    return summaries
  }, [personaIdSet, personaById])

  // IDs of personas that have recent history
  const recentPersonaIds = useMemo(
    () => new Set(recentConversations.map((s) => s.persona.id)),
    [recentConversations]
  )

  // Personas without conversation history
  const availablePersonas = useMemo(
    () => personas.filter((p) => !recentPersonaIds.has(p.id)),
    [personas, recentPersonaIds]
  )

  const hasConversations = recentConversations.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-row items-center justify-between flex px-4 py-3 border-b shrink-0">
        <h2 className="text-base font-semibold leading-none tracking-tight">Chats</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground"
        >
          <X />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col pt-2">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {/* No personas empty state */}
        {!isLoading && personas.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No personas available yet. Follow channels and add 5+ transcripts
              to create personas.
            </p>
          </div>
        )}

        {/* Personas exist but no conversations yet */}
        {!isLoading && personas.length > 0 && !hasConversations && (
          <div className="px-4 pt-4 pb-2">
            <p className="text-sm text-muted-foreground mb-4">
              No conversations yet — pick a creator to start.
            </p>
          </div>
        )}

        {/* Recent conversations */}
        {!isLoading && hasConversations && (
          <div data-testid="recent-section" className="pt-2">
            <p className="px-4 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent
            </p>
            {recentConversations.map(({ persona, lastMessage }) => (
              <button
                key={persona.id}
                type="button"
                onClick={() => onSelectPersona(persona)}
                aria-label={`${persona.name} — ${truncatePreview(lastMessage.question)}`}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
              >
                <PersonaInitial name={persona.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {persona.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeTime(lastMessage.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {truncatePreview(lastMessage.question)}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Available personas (no history) */}
        {!isLoading && personas.length > 0 && availablePersonas.length > 0 && (
          <div
            data-testid="available-section"
            className={cn('pt-2', hasConversations ? 'mt-2' : '')}
          >
            <p className="px-4 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {hasConversations ? 'Start new' : 'Pick a creator'}
            </p>
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              {availablePersonas.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => onSelectPersona(persona)}
                  aria-label={`${persona.name}`}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full border',
                    'bg-background hover:bg-muted/50 transition-colors',
                    'text-sm font-medium'
                  )}
                >
                  <PersonaInitial name={persona.name} className="size-5 text-[10px]" />
                  {persona.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
