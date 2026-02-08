'use client'

import { useState } from 'react'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Source {
  chunkId: number
  content: string
  videoTitle: string
}

interface SourceCitationProps {
  sources: Source[]
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (sources.length === 0) {
    return null
  }

  const sourceText = sources.length === 1 ? '1 source' : `${sources.length} sources`

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs text-muted-foreground"
          aria-label={`${sourceText} - click to ${isOpen ? 'collapse' : 'expand'}`}
        >
          <span>{sourceText}</span>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 space-y-2">
          {sources.map((source) => (
            <div
              key={source.chunkId}
              className="rounded border bg-muted/50 p-2 text-xs"
            >
              <p className="line-clamp-3 text-foreground">{source.content}</p>
              <p className="mt-1 text-muted-foreground">{source.videoTitle}</p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
