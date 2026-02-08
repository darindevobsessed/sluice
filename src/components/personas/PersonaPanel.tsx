'use client'

import type { EnsembleState } from '@/hooks/useEnsemble'
import { PersonaColumn } from './PersonaColumn'
import { Badge } from '@/components/ui/badge'

interface PersonaPanelProps {
  question: string
  state: EnsembleState
}

export function PersonaPanel({ question, state }: PersonaPanelProps) {
  const personaArray = Array.from(state.personas.values())

  return (
    <div className="bg-card border rounded-lg p-6">
      {/* Question Title */}
      <h2 className="text-lg font-semibold mb-4">{question}</h2>

      {/* Best Match Badge */}
      {state.bestMatch && (
        <div className="mb-4">
          <Badge variant="secondary" className="text-yellow-600 dark:text-yellow-400">
            ★ Best: @{state.bestMatch.personaName}
          </Badge>
        </div>
      )}

      {/* Loading Skeleton */}
      {state.isLoading && personaArray.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              data-testid="persona-skeleton"
              className="h-48 rounded-lg border bg-muted animate-pulse"
            />
          ))}
        </div>
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
