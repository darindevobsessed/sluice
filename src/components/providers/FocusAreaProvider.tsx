'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { FocusArea } from '@/lib/db/schema'
import { useSidebarData } from './SidebarDataProvider'

interface FocusAreaContextValue {
  focusAreas: FocusArea[]
  selectedFocusAreaId: number | null
  setSelectedFocusAreaId: (id: number | null) => void
  refetch: () => Promise<void>
  isLoading: boolean
}

const FocusAreaContext = createContext<FocusAreaContextValue | undefined>(undefined)

const STORAGE_KEY = 'sluice-focus-area'

export function FocusAreaProvider({ children }: { children: React.ReactNode }) {
  const { focusAreas, isLoading, refetch: refetchSidebar } = useSidebarData()
  const [selectedFocusAreaId, setSelectedFocusAreaIdState] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const storedId = localStorage.getItem(STORAGE_KEY)
    if (storedId) {
      const parsedId = parseInt(storedId, 10)
      if (!isNaN(parsedId)) return parsedId
    }
    return null
  })

  // Persist selected focus area to localStorage
  const setSelectedFocusAreaId = useCallback((id: number | null) => {
    setSelectedFocusAreaIdState(id)
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, String(id))
    }
  }, [])

  return (
    <FocusAreaContext.Provider
      value={{
        focusAreas,
        selectedFocusAreaId,
        setSelectedFocusAreaId,
        refetch: refetchSidebar,
        isLoading,
      }}
    >
      {children}
    </FocusAreaContext.Provider>
  )
}

export function useFocusArea() {
  const context = useContext(FocusAreaContext)
  if (context === undefined) {
    throw new Error('useFocusArea must be used within a FocusAreaProvider')
  }
  return context
}
