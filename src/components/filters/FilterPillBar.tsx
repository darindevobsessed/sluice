import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FilterPill {
  label: string
  value: string
  onDismiss: () => void
}

interface FilterPillBarProps {
  pills: FilterPill[]
  onClearAll?: () => void
  className?: string
}

export function FilterPillBar({ pills, onClearAll, className }: FilterPillBarProps) {
  if (pills.length === 0) {
    return null
  }

  const showClearAll = pills.length >= 2 && onClearAll

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {pills.map((pill, index) => (
        <Badge
          key={`${pill.label}-${pill.value}-${index}`}
          variant="secondary"
          className="gap-1.5 pr-1.5 text-sm"
        >
          {pill.label}: {pill.value}
          <button
            onClick={pill.onDismiss}
            aria-label={`Remove ${pill.label}: ${pill.value} filter`}
            className="inline-flex"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {showClearAll && (
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          Clear all
        </Button>
      )}
    </div>
  )
}
