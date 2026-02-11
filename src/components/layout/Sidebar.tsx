'use client'

import { useSidebar } from '@/components/providers/SidebarProvider'
import { SidebarLogo } from './SidebarLogo'
import { SidebarNav } from './SidebarNav'

export function Sidebar() {
  const { collapsed } = useSidebar()

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
    </aside>
  )
}
