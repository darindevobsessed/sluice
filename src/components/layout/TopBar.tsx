'use client'

import Link from 'next/link'
import { ArrowLeft, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/providers/SidebarProvider'

interface TopBarProps {
  title?: string
  backHref?: string
  backLabel?: string
  children?: React.ReactNode
  className?: string
}

export function TopBar({ title, backHref, backLabel, children, className }: TopBarProps) {
  const { toggleMobile } = useSidebar()

  return (
    <header
      className={cn(
        'h-14 bg-card border-b flex justify-between items-center px-3 sm:px-6',
        className
      )}
    >
      {/* Left side: hamburger (mobile only) + back button (if provided) + page title */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMobile}
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {backHref && (
          <Link href={backHref}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel || 'Back'}
            </Button>
          </Link>
        )}
        <h1
          key={title}
          data-testid="page-title"
          className="text-base sm:text-lg font-semibold animate-in fade-in duration-200 truncate"
        >
          {title}
        </h1>
      </div>

      {/* Right side: slot for focus area dropdown or other content */}
      {children && <div className="flex items-center">{children}</div>}
    </header>
  )
}
