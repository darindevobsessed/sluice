'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface Chip {
  id: string
  label: string
  group?: string
}

interface ChipBarProps {
  chips: Chip[]
  activeIds: Set<string>
  onToggle: (chipId: string) => void
  className?: string
}

export function ChipBar({ chips, activeIds, onToggle, className }: ChipBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollIndicators()
    el.addEventListener('scroll', updateScrollIndicators, { passive: true })
    const observer = new ResizeObserver(updateScrollIndicators)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollIndicators)
      observer.disconnect()
    }
  }, [updateScrollIndicators])

  if (chips.length === 0) {
    return null
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={scrollRef}
        className="[&::-webkit-scrollbar]:hidden flex gap-2 overflow-x-auto scroll-smooth py-1 px-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {chips.map((chip) => {
          const isActive = activeIds.has(chip.id)
          return (
            <button
              key={chip.id}
              onClick={() => onToggle(chip.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
              aria-pressed={isActive}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
      <div
        className={cn(
          'pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 transition-opacity',
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 transition-opacity',
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
