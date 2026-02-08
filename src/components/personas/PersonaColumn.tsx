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
  const isStreaming = !persona.isDone && !persona.isError && persona.text.length > 0
  const isWaiting = !persona.isDone && !persona.isError && persona.text.length === 0

  return (
    <div
      data-testid="persona-column"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      {/* Header: Name + Best Match Badge */}
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-base">{persona.personaName}</h3>
        {isBestMatch && (
          <Badge
            variant="secondary"
            className="text-yellow-600 dark:text-yellow-400 animate-in fade-in duration-500"
          >
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
        ) : isWaiting ? (
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <p className="whitespace-pre-wrap">
            {persona.text}
            {isStreaming && (
              <span
                className={cn(
                  'inline-block text-primary ml-0.5',
                  'motion-safe:animate-pulse'
                )}
                aria-hidden="true"
              >
                ▌
              </span>
            )}
          </p>
        )}
      </div>

      {/* Footer: Source Citations */}
      {persona.sources.length > 0 && persona.isDone && (
        <SourceCitation sources={persona.sources} />
      )}
    </div>
  )
}
