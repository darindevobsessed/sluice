'use client'

import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type KBContentTypeValue = 'all' | 'youtube' | 'transcript'

interface ContentTypeFilterProps {
  selected: KBContentTypeValue
  onChange: (value: KBContentTypeValue) => void
}

const DISPLAY_LABELS: Record<KBContentTypeValue, string> = {
  all: 'All',
  youtube: 'Videos',
  transcript: 'Transcripts',
}

export function ContentTypeFilter({ selected, onChange }: ContentTypeFilterProps) {
  const displayName = DISPLAY_LABELS[selected]

  const handleSelect = (value: KBContentTypeValue) => {
    onChange(value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full px-4 py-1.5 text-sm bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {displayName}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => handleSelect('all')}>All</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSelect('youtube')}>Videos</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSelect('transcript')}>
          Transcripts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
