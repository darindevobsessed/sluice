'use client'

import type { PersonaState } from '@/hooks/useEnsemble'
import { Badge } from '@/components/ui/badge'
import { SourceCitation } from './SourceCitation'
import { cn } from '@/lib/utils'

interface PersonaColumnProps {
  persona: PersonaState
  isBestMatch: boolean
}

export function PersonaColumn({ persona, isBestMatch }: PersonaColumnProps) {
  const isLoading = !persona.isDone && !persona.isError

  return (
    <div
      data-testid="persona-column"
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4',
        isLoading && 'animate-pulse'
      )}
    >
      {/* Header: Name + Best Match Badge */}
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-base">{persona.personaName}</h3>
        {isBestMatch && (
          <Badge variant="secondary" className="text-yellow-600 dark:text-yellow-400">
            ★ Best
          </Badge>
        )}
      </div>

      {/* Body: Response Text or Error */}
      <div data-testid="persona-text" className="flex-1 text-sm text-muted-foreground">
        {persona.isError ? (
          <div className="text-destructive">
            <p className="font-semibold">Error</p>
            <p>{persona.errorMessage || 'Something went wrong'}</p>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{persona.text}</p>
        )}
      </div>

      {/* Footer: Source Citations */}
      {persona.sources.length > 0 && (
        <SourceCitation sources={persona.sources} />
      )}
    </div>
  )
}
