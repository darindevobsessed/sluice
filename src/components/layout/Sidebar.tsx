'use client'

import { useSidebar } from '@/components/providers/SidebarProvider'
import { SidebarLogo } from './SidebarLogo'
import { SidebarNav } from './SidebarNav'

export function Sidebar() {
  const { collapsed, mobileOpen, closeMobile } = useSidebar()

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <aside
        className="sidebar-container fixed left-0 top-0 z-40 h-screen border-r bg-background overflow-hidden hidden md:flex flex-col"
        style={{
          width: collapsed ? '64px' : '240px',
        }}
        role="complementary"
      >
        <SidebarLogo collapsed={collapsed} />
        <SidebarNav />
      </aside>

      {/* Mobile Sidebar - slide-in overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 h-screen border-r bg-background overflow-hidden flex flex-col transform transition-transform duration-300 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="complementary"
      >
        <SidebarLogo collapsed={false} />
        <SidebarNav />
      </aside>

      {/* Backdrop for mobile sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}
    </>
  )
}
