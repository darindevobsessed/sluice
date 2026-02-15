'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface SidebarContextValue {
  collapsed: boolean
  toggleSidebar: () => void
  mobileOpen: boolean
  toggleMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

const STORAGE_KEY = 'gold-miner-sidebar-collapsed'

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'true'
    } catch {
      return false
    }
  })

  const [mobileOpen, setMobileOpen] = useState<boolean>(false)

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
