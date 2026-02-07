'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { FocusArea } from '@/lib/db/schema'

interface FocusAreaContextValue {
  focusAreas: FocusArea[]
  selectedFocusAreaId: number | null
  setSelectedFocusAreaId: (id: number | null) => void
  refetch: () => Promise<void>
  isLoading: boolean
}

const FocusAreaContext = createContext<FocusAreaContextValue | undefined>(undefined)

const STORAGE_KEY = 'gold-miner-focus-area'

export function FocusAreaProvider({ children }: { children: React.ReactNode }) {
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([])
  const [selectedFocusAreaId, setSelectedFocusAreaIdState] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load focus areas from API
  const fetchFocusAreas = useCallback(async () => {
    try {
      const response = await fetch('/api/focus-areas')
      if (response.ok) {
        const data = await response.json()
        setFocusAreas(data.focusAreas || [])
      }
    } catch (error) {
      console.error('Failed to fetch focus areas:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load selected focus area from localStorage on mount
  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY)
    if (storedId) {
      const parsedId = parseInt(storedId, 10)
      if (!isNaN(parsedId)) {
        setSelectedFocusAreaIdState(parsedId)
      }
    }
  }, [])

  // Fetch focus areas on mount
  useEffect(() => {
    fetchFocusAreas()
  }, [fetchFocusAreas])

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
        refetch: fetchFocusAreas,
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
