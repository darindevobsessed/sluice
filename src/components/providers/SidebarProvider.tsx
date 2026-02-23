'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface SidebarContextValue {
  collapsed: boolean
  toggleSidebar: () => void
  mobileOpen: boolean
  toggleMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

const STORAGE_KEY = 'sluice-sidebar-collapsed'

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Initialize to false to avoid SSR hydration mismatch
  const [collapsed, setCollapsed] = useState<boolean>(false)

  const [mobileOpen, setMobileOpen] = useState<boolean>(false)

  // Read from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsed(true)
      }
    } catch {
      // Silently fail if localStorage is not available
    }
  }, [])

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const newValue = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(newValue))
      } catch {
        // Silently fail if localStorage is not available
      }
      return newValue
    })
  }, [])

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev)
  }, [])

  const closeMobile = useCallback(() => {
    setMobileOpen(false)
  }, [])

  return (
    <SidebarContext.Provider value={{ collapsed, toggleSidebar, mobileOpen, toggleMobile, closeMobile }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
