'use client'

import { createContext, useContext, useState, useRef, useCallback } from 'react'
import { useAgent } from '@/lib/agent/AgentProvider'
import { parsePartialJSON } from '@/lib/claude/prompts/parser'
import { buildExtractionPrompt } from '@/lib/claude/prompts/extract'
import type { ExtractionResult } from '@/lib/claude/prompts/types'

type SectionStatus = 'pending' | 'working' | 'done'

interface ExtractionState {
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

interface ExtractionEntry extends ExtractionState {
  insightId: string | null
  accumulatedText: string
}

interface VideoData {
  title: string
  channel: string
  transcript: string
}

interface ExtractionContextValue {
  startExtraction: (videoId: number, video: VideoData) => void
  cancelExtraction: (videoId: number) => void
  getState: (videoId: number) => ExtractionEntry | undefined
}

const ExtractionContext = createContext<ExtractionContextValue | undefined>(undefined)

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

export function ExtractionProvider({ children }: { children: React.ReactNode }) {
  const { agent } = useAgent()
  const [stateMap, setStateMap] = useState<Map<number, ExtractionEntry>>(new Map())

  // Use ref for stable dispatch to avoid stale closures in callbacks
  const stateMapRef = useRef(stateMap)
  // eslint-disable-next-line react-hooks/refs
  stateMapRef.current = stateMap

  const updateEntry = useCallback((videoId: number, updater: (prev: ExtractionEntry) => ExtractionEntry) => {
    setStateMap(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(videoId)
      if (current) {
        newMap.set(videoId, updater(current))
      }
      return newMap
    })
  }, [])

  const calculateSectionStatuses = useCallback((parsed: Partial<ExtractionResult> | null) => {
    const sections = { ...initialState.sections }

    if (!parsed) return sections

    // Summary: done if present, working if contentType exists
    if (parsed.summary) {
      sections.summary = 'done'
      sections.insights = 'working'
    } else if (parsed.contentType) {
      sections.summary = 'working'
    }

    // Insights: done if present
    if (parsed.insights) {
      sections.insights = 'done'
      sections.actions = 'working'
    }

    // Actions: done if present
    if (parsed.actionItems) {
      sections.actions = 'done'
      sections.claudeCode = 'working'
    }

    // Claude Code: done if present
    if (parsed.claudeCode) {
      sections.claudeCode = 'done'
    }

    return sections
  }, [])

  const startExtraction = useCallback((videoId: number, video: VideoData) => {
    if (!agent) return

    // Duplicate extraction guard
    const existing = stateMapRef.current.get(videoId)
    if (existing && existing.overall === 'extracting') {
      return
    }

    // Initialize entry - update both ref and state
    const newMap = new Map(stateMapRef.current)
    newMap.set(videoId, {
      ...initialState,
      overall: 'extracting',
      insightId: null,
      accumulatedText: '',
    })
    stateMapRef.current = newMap
    setStateMap(newMap)

    const prompt = buildExtractionPrompt(video)
    const systemPrompt = 'You are an expert at extracting actionable knowledge from video transcripts. Always respond with valid JSON only.'

    const insightId = agent.generateInsight(
      {
        insightType: 'extraction',
        prompt,
        systemPrompt,
      },
      {
        onStart: () => {
          // Already set to extracting
        },
        onText: (text) => {
          updateEntry(videoId, (prev) => {
            const newAccumulated = prev.accumulatedText + text
            const parsed = parsePartialJSON(newAccumulated)
            const sections = calculateSectionStatuses(parsed)

            return {
              ...prev,
              accumulatedText: newAccumulated,
              partial: parsed || prev.partial,
              sections,
            }
          })
        },
        onDone: async (fullContent) => {
          const parsed = parsePartialJSON(fullContent)

          if (parsed && isCompleteExtraction(parsed)) {
            // Persist to DB
            try {
              await fetch(`/api/videos/${videoId}/insights`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extraction: parsed }),
              })

              // Evict from store on successful persist
              setStateMap(prev => {
                const newMap = new Map(prev)
                newMap.delete(videoId)
                return newMap
              })
            } catch (error) {
              console.error('Failed to persist extraction:', error)
              // Update state to error but don't evict
              updateEntry(videoId, (prev) => ({
                ...prev,
                overall: 'error',
                error: 'Failed to persist extraction',
                insightId: null,
              }))
            }
          } else if (parsed) {
            // Partial success
            updateEntry(videoId, (prev) => ({
              ...prev,
              overall: 'done',
              sections: {
                summary: parsed.summary ? 'done' : 'pending',
                insights: parsed.insights ? 'done' : 'pending',
                actions: parsed.actionItems ? 'done' : 'pending',
                claudeCode: parsed.claudeCode?.applicable ? 'done' : 'pending',
              },
              partial: parsed,
              error: null,
              insightId: null,
            }))
          } else {
            // Complete failure
            updateEntry(videoId, (prev) => ({
              ...prev,
              overall: 'error',
              error: 'Failed to parse extraction response',
              insightId: null,
            }))
          }
        },
        onError: (error) => {
          updateEntry(videoId, (prev) => ({
            ...prev,
            overall: 'error',
            error,
            insightId: null,
          }))
        },
        onCancel: () => {
          updateEntry(videoId, () => ({
            ...initialState,
            insightId: null,
            accumulatedText: '',
          }))
        },
      }
    )

    // Update with insightId
    updateEntry(videoId, (prev) => ({
      ...prev,
      insightId,
    }))
  }, [agent, updateEntry, calculateSectionStatuses])

  const cancelExtraction = useCallback((videoId: number) => {
    const entry = stateMapRef.current.get(videoId)
    if (entry?.insightId && agent) {
      agent.cancelInsight(entry.insightId)
      updateEntry(videoId, () => ({
        ...initialState,
        insightId: null,
        accumulatedText: '',
      }))
    }
  }, [agent, updateEntry])

  const getState = useCallback((videoId: number): ExtractionEntry | undefined => {
    return stateMapRef.current.get(videoId)
  }, [])

  return (
    <ExtractionContext.Provider
      value={{
        startExtraction,
        cancelExtraction,
        getState,
      }}
    >
      {children}
    </ExtractionContext.Provider>
  )
}

export function useExtractionStore() {
  const context = useContext(ExtractionContext)
  if (context === undefined) {
    throw new Error('useExtractionStore must be used within an ExtractionProvider')
  }
  return context
}

/**
 * Type guard to check if extraction has minimum required sections.
 */
function isCompleteExtraction(
  partial: Partial<ExtractionResult>
): partial is ExtractionResult {
  const hasCoreSection = !!(
    partial.contentType &&
    partial.summary &&
    partial.insights &&
    partial.actionItems
  )

  // If core sections exist but claudeCode is missing, add a default
  if (hasCoreSection && !partial.claudeCode) {
    partial.claudeCode = {
      applicable: false,
      skills: [],
      commands: [],
      agents: [],
      hooks: [],
      rules: [],
    }
  }

  return hasCoreSection
}
