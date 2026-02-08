'use client'

import { useState, useEffect, useCallback } from 'react'
import { useExtractionStore } from '@/components/providers/ExtractionProvider'
import type { ExtractionResult } from '@/lib/claude/prompts/types'

export type SectionStatus = 'pending' | 'working' | 'done'

export interface ExtractionState {
  overall: 'idle' | 'extracting' | 'done' | 'error'
  sections: {
    summary: SectionStatus
    insights: SectionStatus
    actions: SectionStatus
    claudeCode: SectionStatus
  }
  partial: Partial<ExtractionResult>
  error: string | null
}

interface UseExtractionOptions {
  videoId: number
  video: {
    title: string
    channel: string
    transcript: string
  }
}

interface UseExtractionReturn {
  state: ExtractionState
  extract: () => void
  cancel: () => void
  insightId: string | null
}

const initialState: ExtractionState = {
  overall: 'idle',
  sections: {
    summary: 'pending',
    insights: 'pending',
    actions: 'pending',
    claudeCode: 'pending',
  },
  partial: {},
  error: null,
}

/**
 * Hook for managing extraction state.
 * Thin wrapper around ExtractionProvider's global store.
 * Falls back to API for existing extractions not in the store.
 */
export function useExtraction({
  videoId,
  video,
}: UseExtractionOptions): UseExtractionReturn {
  const { stateMap, startExtraction, cancelExtraction } = useExtractionStore()
  const [apiState, setApiState] = useState<ExtractionState | null>(null)

  // Load existing extraction from API on mount (if not in store)
  useEffect(() => {
    let cancelled = false

    async function loadExisting() {
      // Check if store already has this extraction
      const storeEntry = stateMap.get(videoId)
      if (storeEntry) {
        return
      }

      try {
        const res = await fetch(`/api/videos/${videoId}/insights`)
        if (!res.ok || cancelled) {
          return
        }

        const data = await res.json()
        if (data.extraction && !cancelled) {
          setApiState({
            overall: 'done',
            sections: {
              summary: 'done',
              insights: 'done',
              actions: 'done',
              claudeCode: 'done',
            },
            partial: data.extraction,
            error: null,
          })
        }
      } catch (error) {
        console.error('Failed to load existing extraction:', error)
      }
    }

    loadExisting()
    return () => {
      cancelled = true
    }
  }, [videoId, stateMap])

  // Get current state: prioritize store, fall back to API state, then initial
  const state = (() => {
    const storeEntry = stateMap.get(videoId)
    if (storeEntry) {
      // Active or recent extraction in global store
      return {
        overall: storeEntry.overall,
        sections: storeEntry.sections,
        partial: storeEntry.partial,
        error: storeEntry.error,
      }
    }

    // No store entry - use API state if loaded
    if (apiState) {
      return apiState
    }

    // Nothing yet
    return initialState
  })()

  const insightId = stateMap.get(videoId)?.insightId ?? null

  const extract = useCallback(() => {
    startExtraction(videoId, video)
  }, [startExtraction, videoId, video])

  const cancel = useCallback(() => {
    cancelExtraction(videoId)
  }, [cancelExtraction, videoId])

  return {
    state,
    extract,
    cancel,
    insightId,
  }
}
