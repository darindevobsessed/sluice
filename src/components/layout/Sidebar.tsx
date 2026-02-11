'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSidebar } from '@/components/providers/SidebarProvider'
import { Button } from '@/components/ui/button'
import { SidebarLogo } from './SidebarLogo'
import { SidebarNav } from './SidebarNav'

export function Sidebar() {
  const { collapsed, toggleSidebar } = useSidebar()

  return (
    <aside
      className="sidebar-container fixed left-0 top-0 z-40 h-screen border-r bg-background overflow-hidden flex flex-col"
      style={{
        width: collapsed ? '64px' : '240px',
      }}
      role="complementary"
    >
      <SidebarLogo collapsed={collapsed} />
      <SidebarNav />

      <div className={`mt-auto p-2 flex ${collapsed ? 'justify-center' : 'justify-start'}`}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="transition-all"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" data-lucide="chevron-right" />
          ) : (
            <ChevronLeft className="h-4 w-4" data-lucide="chevron-left" />
          )}
        </Button>
      </div>
    </aside>
  )
}
