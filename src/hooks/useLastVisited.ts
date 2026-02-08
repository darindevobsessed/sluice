import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'gold-miner-last-visited'
const AUTO_MARK_DELAY_MS = 100

interface UseLastVisitedReturn {
  lastVisitedAt: string | null
  markVisited: () => void
}

function loadFromStorage(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate it's a string (ISO timestamp)
      if (typeof parsed === 'string') {
        // Validate it's a valid timestamp
        const date = new Date(parsed)
        if (!isNaN(date.getTime())) {
          return parsed
        }
      }
    }
  } catch {
    // Ignore errors (malformed JSON, etc.)
  }
  return null
}

export function useLastVisited(): UseLastVisitedReturn {
  // Initialize state from localStorage synchronously
  const [lastVisitedAt, setLastVisitedAt] = useState<string | null>(() => loadFromStorage())
  const hasMarkedManually = useRef(false)

  // Mark visited function
  const markVisited = useCallback(() => {
    const timestamp = new Date().toISOString()
    setLastVisitedAt(timestamp)
    hasMarkedManually.current = true

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamp))
    } catch {
      // Ignore quota exceeded errors
    }
  }, [])

  // Auto-mark visited on mount after delay (only if not manually marked)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasMarkedManually.current) {
        markVisited()
      }
    }, AUTO_MARK_DELAY_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [markVisited])

  return {
    lastVisitedAt,
    markVisited,
  }
}
