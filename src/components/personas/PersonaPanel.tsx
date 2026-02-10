'use client'

import type { EnsembleState } from '@/hooks/useEnsemble'
import { PersonaColumn } from './PersonaColumn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Users } from 'lucide-react'

interface PersonaPanelProps {
  question: string
  state: EnsembleState
  onRetry?: () => void
}

function PanelSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          data-testid="persona-skeleton"
          className="flex flex-col gap-3 rounded-lg border bg-card p-4"
        >
          {/* Name shimmer */}
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          {/* Text shimmer lines */}
          <div className="space-y-2 flex-1">
            <div className="h-3 w-full rounded bg-muted animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
            <div className="h-3 w-4/6 rounded bg-muted animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
          </div>
          {/* Source shimmer */}
          <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function PersonaPanel({ question, state, onRetry }: PersonaPanelProps) {
  const personaArray = Array.from(state.personas.values())
  const hasNoPersonas = state.isAllDone && personaArray.length === 0 && !state.error

  return (
    <div className="bg-card border rounded-lg p-6">
      {/* Question Title */}
      <h2 className="text-lg font-semibold mb-4">{question}</h2>

      {/* Best Match Badge */}
      {state.bestMatch && (
        <div className="mb-4 animate-in fade-in duration-500">
          <Badge variant="secondary" className="text-yellow-600 dark:text-yellow-400">
            ★ Best: @{state.bestMatch.personaName}
          </Badge>
        </div>
      )}

      {/* Error State */}
      {state.error !== null && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {state.error || 'An error occurred while fetching persona responses.'}
          </p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}

      {/* No Personas Empty State */}
      {hasNoPersonas && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No personas available yet. Follow channels and add 5+ transcripts to create personas.
          </p>
        </div>
      )}

      {/* Loading Skeleton */}
      {state.isLoading && personaArray.length === 0 && !state.error && (
        <PanelSkeleton />
      )}

      {/* Persona Columns */}
      {personaArray.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personaArray.map((persona) => (
            <PersonaColumn
              key={persona.personaId}
              persona={persona}
              isBestMatch={state.bestMatch?.personaId === persona.personaId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
