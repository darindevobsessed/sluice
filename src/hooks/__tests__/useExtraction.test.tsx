import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { ExtractionResult } from '@/lib/claude/prompts/types'
import { type ReactNode } from 'react'

// Use vi.hoisted so mockAgent is available when vi.mock factory runs
const { mockAgent, mockFetch } = vi.hoisted(() => {
  const agent = {
    generateInsight: vi.fn(),
    cancelInsight: vi.fn(),
  }
  const fetch = vi.fn()
  return { mockAgent: agent, mockFetch: fetch }
})

// Mock AgentProvider — must mock BEFORE imports that use it
vi.mock('@/lib/agent/AgentProvider', () => ({
  AgentProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAgent: () => ({
    agent: mockAgent,
    status: 'connected' as const,
    error: null,
  }),
}))

// Set global fetch
global.fetch = mockFetch

// Import modules AFTER mocking
import { useExtraction } from '../useExtraction'
import { ExtractionProvider } from '@/components/providers/ExtractionProvider'

// Create wrapper with ExtractionProvider
const createWrapper = () => {
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: ReactNode }) => (
    <ExtractionProvider>
      {children}
    </ExtractionProvider>
  )
}

describe('useExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockAgent.generateInsight.mockReset()
    mockAgent.cancelInsight.mockReset()
  })

  describe('initial state', () => {
    it('should start in idle state with no existing data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test transcript' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      expect(result.current.state.partial).toEqual({})
      expect(result.current.state.error).toBeNull()
    })

    it('should load existing extraction on mount', async () => {
      const existingExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: {
          tldr: 'Existing summary',
          overview: 'Existing overview',
          keyPoints: ['Point 1'],
        },
        insights: [],
        actionItems: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
          resources: [],
        },
        claudeCode: {
          applicable: false,
          skills: [],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extraction: existingExtraction, generatedAt: '2024-01-01T00:00:00Z' }),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('done')
      })

      expect(result.current.state.partial.contentType).toBe('dev')
      expect(result.current.state.partial.summary?.tldr).toBe('Existing summary')
    })
  })

  describe('extraction flow', () => {
    it('should initiate extraction and update state on text events', async () => {
      let onTextCallback: ((text: string) => void) | undefined

      mockAgent.generateInsight.mockImplementation((_opts: unknown, callbacks: Record<string, (...args: unknown[]) => unknown>) => {
        onTextCallback = callbacks.onText as (text: string) => void
        callbacks.onStart?.()
        return 'test-id'
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      act(() => {
        result.current.extract()
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('extracting')
      })

      expect(result.current.insightId).toBe('test-id')

      act(() => {
        onTextCallback?.('{"contentType": "dev"')
      })

      await waitFor(() => {
        expect(result.current.state.sections.summary).toBe('working')
      })
    })

    it('should update section statuses progressively as sections complete', async () => {
      let onTextCallback: ((text: string) => void) | undefined

      mockAgent.generateInsight.mockImplementation((_opts: unknown, callbacks: Record<string, (...args: unknown[]) => unknown>) => {
        onTextCallback = callbacks.onText as (text: string) => void
        callbacks.onStart?.()
        return 'test-id'
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      act(() => {
        result.current.extract()
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('extracting')
      })

      act(() => {
        onTextCallback?.(JSON.stringify({
          contentType: 'dev',
          summary: {
            tldr: 'Summary',
            overview: 'Overview',
            keyPoints: ['Key 1'],
          },
        }))
      })

      await waitFor(() => {
        expect(result.current.state.sections.summary).toBe('done')
      })
      expect(result.current.state.sections.insights).toBe('working')
    })

    it('should persist extraction on done event', async () => {
      let onDoneCallback: ((fullContent: string) => void) | undefined

      mockAgent.generateInsight.mockImplementation((_opts: unknown, callbacks: Record<string, (...args: unknown[]) => unknown>) => {
        onDoneCallback = callbacks.onDone as (fullContent: string) => void
        callbacks.onStart?.()
        return 'test-id'
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extraction: {}, generatedAt: '2024-01-01T00:00:00Z' }),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      act(() => {
        result.current.extract()
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('extracting')
      })

      const fullExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: { tldr: 'Test', overview: 'Test', keyPoints: [] },
        insights: [],
        actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
        claudeCode: { applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] },
      }

      await act(async () => {
        onDoneCallback?.(JSON.stringify(fullExtraction))
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // After successful persist, store evicts so hook returns idle
      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/videos/1/insights',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ extraction: fullExtraction }),
        })
      )
    })

    it('should handle errors during extraction', async () => {
      let onErrorCallback: ((error: string) => void) | undefined

      mockAgent.generateInsight.mockImplementation((_opts: unknown, callbacks: Record<string, (...args: unknown[]) => unknown>) => {
        onErrorCallback = callbacks.onError as (error: string) => void
        callbacks.onStart?.()
        return 'test-id'
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      act(() => {
        result.current.extract()
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('extracting')
      })

      act(() => {
        onErrorCallback?.('Test error')
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('error')
      })
      expect(result.current.state.error).toBe('Test error')
    })

    it('should handle cancel', async () => {
      let onCancelCallback: (() => void) | undefined

      mockAgent.generateInsight.mockImplementation((_opts: unknown, callbacks: Record<string, (...args: unknown[]) => unknown>) => {
        onCancelCallback = callbacks.onCancel as () => void
        callbacks.onStart?.()
        return 'test-id'
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      act(() => {
        result.current.extract()
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('extracting')
      })

      act(() => {
        result.current.cancel()
      })

      expect(mockAgent.cancelInsight).toHaveBeenCalledWith('test-id')

      act(() => {
        onCancelCallback?.()
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })
    })
  })

  describe('edge cases', () => {
    it('should not extract when already extracting', async () => {
      mockAgent.generateInsight.mockImplementation((_opts: unknown, callbacks: Record<string, (...args: unknown[]) => unknown>) => {
        callbacks.onStart?.()
        return 'test-id'
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      act(() => {
        result.current.extract()
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('extracting')
      })

      const firstId = result.current.insightId

      act(() => {
        result.current.extract()
      })

      expect(result.current.insightId).toBe(firstId)
      expect(mockAgent.generateInsight).toHaveBeenCalledTimes(1)
    })

    it('should handle failed API persistence gracefully', async () => {
      let onDoneCallback: ((fullContent: string) => void) | undefined

      mockAgent.generateInsight.mockImplementation((_opts: unknown, callbacks: Record<string, (...args: unknown[]) => unknown>) => {
        onDoneCallback = callbacks.onDone as (fullContent: string) => void
        callbacks.onStart?.()
        return 'test-id'
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('idle')
      })

      act(() => {
        result.current.extract()
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('extracting')
      })

      const fullExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: { tldr: 'Test', overview: 'Test', keyPoints: [] },
        insights: [],
        actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
        claudeCode: { applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] },
      }

      await act(async () => {
        onDoneCallback?.(JSON.stringify(fullExtraction))
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('error')
      })

      expect(result.current.state.error).toBe('Failed to persist extraction')
    })
  })

  describe('store integration', () => {
    it('should share extraction state between two hooks for the same video', async () => {
      let onTextCallback: ((text: string) => void) | undefined

      mockAgent.generateInsight.mockImplementation((_opts: unknown, callbacks: Record<string, (...args: unknown[]) => unknown>) => {
        onTextCallback = callbacks.onText as (text: string) => void
        callbacks.onStart?.()
        return 'test-id'
      })

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })

      // Use a composite hook so both share the same ExtractionProvider tree
      const useComposite = () => {
        const hook1 = useExtraction({ videoId: 1, video: { title: 'Test', channel: 'Test', transcript: 'Test' } })
        const hook2 = useExtraction({ videoId: 1, video: { title: 'Test', channel: 'Test', transcript: 'Test' } })
        return { hook1, hook2 }
      }

      const { result } = renderHook(() => useComposite(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.hook1.state.overall).toBe('idle')
      })

      act(() => {
        result.current.hook1.extract()
      })

      await waitFor(() => {
        expect(result.current.hook1.state.overall).toBe('extracting')
      })

      // Stream some text via hook1's extraction
      act(() => {
        onTextCallback?.(JSON.stringify({ contentType: 'dev', summary: { tldr: 'Test', overview: 'Test', keyPoints: [] } }))
      })

      await waitFor(() => {
        expect(result.current.hook1.state.sections.summary).toBe('done')
      })

      // hook2 should see the same state from the shared store
      expect(result.current.hook2.state.overall).toBe('extracting')
      expect(result.current.hook2.state.sections.summary).toBe('done')
      expect(result.current.hook2.state.partial.contentType).toBe('dev')
    })

    it('should fall back to API when store is empty', async () => {
      const existingExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: {
          tldr: 'From API',
          overview: 'Overview',
          keyPoints: [],
        },
        insights: [],
        actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
        claudeCode: { applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extraction: existingExtraction }),
      })

      const { result } = renderHook(() => useExtraction({
        videoId: 999,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
      }), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.state.overall).toBe('done')
      })

      expect(result.current.state.partial.summary?.tldr).toBe('From API')
    })
  })
})
