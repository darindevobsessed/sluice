'use client'

import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SORT_OPTIONS, type SortOptionId } from '@/hooks/useVideoSort'
import { cn } from '@/lib/utils'

interface SortDropdownProps {
  value: SortOptionId
  onChange: (id: SortOptionId) => void
  className?: string
}

export function SortDropdown({ value, onChange, className }: SortDropdownProps) {
  const currentLabel = SORT_OPTIONS.find(o => o.id === value)?.label ?? 'Date Added'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'flex items-center gap-1.5',
          className,
        )}
      >
        {currentLabel}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => onChange(option.id)}
            className="flex items-center justify-between"
          >
            {option.label}
            {value === option.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
