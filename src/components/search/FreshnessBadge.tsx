import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FreshnessBadgeProps {
  publishedAt: Date | null | undefined
  className?: string
}

/**
 * Displays a freshness indicator badge based on content age
 *
 * Color coding:
 * - Green "Fresh": < 90 days (3 months)
 * - Amber "Xmo": 90-364 days (3-12 months)
 * - Gray "Xy old": >= 365 days (1+ years)
 *
 * @param publishedAt - Video publication date
 * @param className - Additional CSS classes
 */
export function FreshnessBadge({ publishedAt, className }: FreshnessBadgeProps) {
  // Capture "now" once per mount to avoid impure Date.now() calls during render
  const [now] = useState(() => Date.now())

  if (!publishedAt) return null

  const ageInDays = Math.floor(
    (now - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Fresh: < 90 days
  if (ageInDays < 90) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          'bg-emerald-500/10 text-emerald-600 border-emerald-200 transition-opacity duration-150',
          className
        )}
      >
        Fresh
      </Badge>
    )
  }

  // Recent: 90-364 days (show months)
  if (ageInDays < 365) {
    const months = Math.floor(ageInDays / 30)
    return (
      <Badge
        variant="secondary"
        className={cn(
          'bg-amber-500/10 text-amber-600 border-amber-200 transition-opacity duration-150',
          className
        )}
      >
        {months}mo
      </Badge>
    )
  }

  // Old: >= 365 days (show years)
  const years = Math.floor(ageInDays / 365)
  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-muted-foreground transition-opacity duration-150',
        className
      )}
    >
      {years}y old
    </Badge>
  )
}
