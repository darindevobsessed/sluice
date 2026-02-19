'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarData } from '@/components/providers/SidebarDataProvider'
import { useSidebar } from '@/components/providers/SidebarProvider'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'

const STORAGE_KEY = 'gold-miner-sidebar-channels-open'

export function SidebarChannels() {
  const { channels, isLoading } = useSidebarData()
  const { collapsed, closeMobile } = useSidebar()
  const router = useRouter()
  const searchParams = useSearchParams()

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

  // Don't render when no channels exist (and data has finished loading)
  if (!isLoading && channels.length === 0) return null

  const activeChannel = searchParams.get('channel')

  const handleChannelClick = (channelName: string) => {
    closeMobile()
    if (activeChannel === channelName) {
      // Toggle off — clicking the active channel clears the filter
      router.push('/')
    } else {
      router.push(`/?channel=${encodeURIComponent(channelName)}`)
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          Channels
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
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-md"
                >
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-6 bg-muted animate-pulse rounded ml-auto" />
                </div>
              ))}
            </>
          ) : (
            channels.map((channel) => (
              <button
                key={channel.name}
                onClick={() => handleChannelClick(channel.name)}
                className={cn(
                  'flex items-center justify-between gap-2 w-full text-left rounded-md px-3 py-1.5 text-sm transition-colors',
                  activeChannel === channel.name
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <span className="truncate">{channel.name}</span>
                <span className="text-xs tabular-nums shrink-0 opacity-60">
                  {channel.videoCount}
                </span>
              </button>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
