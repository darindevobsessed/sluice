'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { FocusArea } from '@/lib/db/schema'

export interface SidebarChannel {
  name: string
  videoCount: number
}

interface SidebarDataContextValue {
  channels: SidebarChannel[]
  focusAreas: FocusArea[]
  isLoading: boolean
  refetch: () => Promise<void>
}

const SidebarDataContext = createContext<SidebarDataContextValue | undefined>(undefined)

export function SidebarDataProvider({ children }: { children: React.ReactNode }) {
  const [channels, setChannels] = useState<SidebarChannel[]>([])
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchSidebarData = useCallback(async () => {
    try {
      const response = await fetch('/api/sidebar')
      if (response.ok) {
        const data = await response.json()
        setChannels(data.channels || [])
        setFocusAreas(data.focusAreas || [])
      }
    } catch (error) {
      console.error('Failed to fetch sidebar data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSidebarData()
  }, [fetchSidebarData])

  return (
    <SidebarDataContext.Provider value={{ channels, focusAreas, isLoading, refetch: fetchSidebarData }}>
      {children}
    </SidebarDataContext.Provider>
  )
}

export function useSidebarData() {
  const context = useContext(SidebarDataContext)
  if (context === undefined) {
    throw new Error('useSidebarData must be used within a SidebarDataProvider')
  }
  return context
}
