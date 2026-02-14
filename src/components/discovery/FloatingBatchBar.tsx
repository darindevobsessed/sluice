'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FloatingBatchBarProps {
  selectedCount: number
  onAdd: () => void
  onClear: () => void
  isAdding?: boolean
}

export function FloatingBatchBar({
  selectedCount,
  onAdd,
  onClear,
  isAdding = false,
}: FloatingBatchBarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-card border rounded-xl shadow-xl',
        'px-6 py-3',
        'flex items-center gap-4',
        'animate-in slide-in-from-bottom-4 duration-200'
      )}
    >
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={isAdding}
      >
        Clear
      </Button>
      <Button
        size="sm"
        onClick={onAdd}
        disabled={isAdding}
      >
        Add {selectedCount} to Bank
      </Button>
    </div>
  )
}
