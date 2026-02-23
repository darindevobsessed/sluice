'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusArea } from '@/components/providers/FocusAreaProvider'
import { useSidebar } from '@/components/providers/SidebarProvider'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'

const STORAGE_KEY = 'sluice-sidebar-focus-areas-open'

export function SidebarFocusAreas() {
  const { focusAreas, selectedFocusAreaId, setSelectedFocusAreaId, isLoading } = useFocusArea()
  const { collapsed, closeMobile } = useSidebar()
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(true)

  // Read persisted collapse state after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'false') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOpen(false)
      }
    } catch {
      // Silently fail if localStorage is not available
    }
  }, [])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    try {
      localStorage.setItem(STORAGE_KEY, String(open))
    } catch {
      // Silently fail if localStorage is not available
    }
  }

  // Don't render when sidebar is collapsed to icon-only mode
  if (collapsed) return null

  // Don't render when no focus areas exist (and data has finished loading)
  if (!isLoading && focusAreas.length === 0) return null

  const handleFocusAreaClick = (id: number) => {
    closeMobile()
    if (selectedFocusAreaId === id) {
      // Toggle off — clicking the active focus area clears the filter
      setSelectedFocusAreaId(null)
    } else {
      setSelectedFocusAreaId(id)
    }
    router.push('/')
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5" />
          Focus Areas
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200',
            !isOpen && '-rotate-90',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {isLoading ? (
            <>
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-md"
                >
                  <div className="h-2.5 w-2.5 bg-muted animate-pulse rounded-full shrink-0" />
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </>
          ) : (
            focusAreas.map((area) => (
              <button
                key={area.id}
                onClick={() => handleFocusAreaClick(area.id)}
                className={cn(
                  'flex items-center gap-2 w-full text-left rounded-md px-3 py-1.5 text-sm transition-colors',
                  selectedFocusAreaId === area.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: area.color || 'var(--muted-foreground)' }}
                  aria-hidden="true"
                />
                <span className="truncate">{area.name}</span>
              </button>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
