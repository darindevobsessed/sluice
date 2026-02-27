'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatFabProps {
  visible: boolean
  hasPersonas: boolean
  onClick: () => void
}

export function ChatFab({ visible, hasPersonas, onClick }: ChatFabProps) {
  if (!hasPersonas) return null

  return (
    <Button
      onClick={onClick}
      aria-label="Open chat hub"
      size="icon"
      className={cn(
        'fixed bottom-6 right-6 z-40 size-14 rounded-full shadow-lg',
        'pb-[max(0px,env(safe-area-inset-bottom))]',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
        !visible && 'invisible opacity-0 pointer-events-none'
      )}
    >
      <MessageCircle className="size-6" />
    </Button>
  )
}
