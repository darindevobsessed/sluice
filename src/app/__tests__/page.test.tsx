import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Home from '../page'

// Create module-level mock functions that vi.mock can use
const mockSetQuery = vi.fn()
const mockRetryEnsemble = vi.fn()

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock PageTitleContext
vi.mock('@/components/layout/PageTitleContext', () => ({
  usePageTitle: () => ({
    setPageTitle: vi.fn(),
  }),
}))

// Mock FocusAreaProvider
vi.mock('@/components/providers/FocusAreaProvider', () => ({
  useFocusArea: () => ({
    selectedFocusAreaId: null,
    focusAreas: [],
    setSelectedFocusAreaId: vi.fn(),
    refetch: vi.fn(),
    isLoading: false,
  }),
}))

// Mock useSearch hook - using module factory
vi.mock('@/hooks/useSearch', () => ({
  useSearch: vi.fn(() => ({
    query: '',
    setQuery: mockSetQuery,
    results: [],
    isLoading: false,
  })),
}))

// Mock useEnsemble hook - using module factory
vi.mock('@/hooks/useEnsemble', () => ({
  useEnsemble: vi.fn(() => ({
    state: {
      isLoading: false,
      personas: new Map(),
      bestMatch: null,
      isAllDone: false,
      error: null,
    },
    retry: mockRetryEnsemble,
  })),
}))

// Import the mocked functions after vi.mock declarations
import { useSearch } from '@/hooks/useSearch'
import { useEnsemble } from '@/hooks/useEnsemble'

const mockUseSearch = useSearch as ReturnType<typeof vi.fn>
const mockUseEnsemble = useEnsemble as ReturnType<typeof vi.fn>

// Mock fetch
global.fetch = vi.fn()

describe('Home Page - Ensemble Trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset to default return values
    mockUseSearch.mockReturnValue({
      query: '',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    mockUseEnsemble.mockReturnValue({
      state: {
        isLoading: false,
        personas: new Map(),
        bestMatch: null,
        isAllDone: false,
        error: null,
      },
      retry: mockRetryEnsemble,
    })

    // Default mock for videos API and persona status
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/personas/status')) {
        return {
          ok: true,
          json: async () => ({
            channels: [
              {
                channelName: 'Test Channel',
                transcriptCount: 50,
                personaId: 1,
                personaCreatedAt: new Date(),
              },
            ],
            threshold: 30,
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          videos: [],
          stats: { count: 0, totalHours: 0, channels: 0 },
          focusAreaMap: {},
        }),
      }
    })
  })

  it('does not trigger ensemble when query lacks question mark', async () => {
    mockUseSearch.mockReturnValue({
      query: 'What is the best approach',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    render(<Home />)

    // Wait for component to settle
    await waitFor(() => {
      expect(mockUseEnsemble).toHaveBeenCalled()
    })

    // useEnsemble should be called with null (no question mark)
    expect(mockUseEnsemble).toHaveBeenCalledWith(null)
  })

  it('triggers ensemble when query ends with question mark and has 3+ words', async () => {
    mockUseSearch.mockReturnValue({
      query: 'What is the best approach?',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    render(<Home />)

    // Wait for component to settle
    await waitFor(() => {
      expect(mockUseEnsemble).toHaveBeenCalled()
    })

    // useEnsemble should be called with the query (has question mark)
    expect(mockUseEnsemble).toHaveBeenCalledWith('What is the best approach?')
  })

  it('does not trigger ensemble when query has question mark but less than 3 words', async () => {
    mockUseSearch.mockReturnValue({
      query: 'What is?',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    render(<Home />)

    // Wait for component to settle
    await waitFor(() => {
      expect(mockUseEnsemble).toHaveBeenCalled()
    })

    // useEnsemble should be called with null (less than 3 words)
    expect(mockUseEnsemble).toHaveBeenCalledWith(null)
  })

  it('triggers ensemble when query has exactly 3 words with question mark', async () => {
    mockUseSearch.mockReturnValue({
      query: 'What is TypeScript?',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    render(<Home />)

    // Wait for component to settle
    await waitFor(() => {
      expect(mockUseEnsemble).toHaveBeenCalled()
    })

    // useEnsemble should be called with the query (3 words + question mark)
    expect(mockUseEnsemble).toHaveBeenCalledWith('What is TypeScript?')
  })

  it('does not trigger ensemble for question words without question mark', async () => {
    mockUseSearch.mockReturnValue({
      query: 'How to learn programming',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    render(<Home />)

    // Wait for component to settle
    await waitFor(() => {
      expect(mockUseEnsemble).toHaveBeenCalled()
    })

    // useEnsemble should be called with null (no question mark)
    expect(mockUseEnsemble).toHaveBeenCalledWith(null)
  })

  it('handles query with trailing whitespace and question mark', async () => {
    mockUseSearch.mockReturnValue({
      query: '  What is the best approach?  ',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    render(<Home />)

    // Wait for component to settle
    await waitFor(() => {
      expect(mockUseEnsemble).toHaveBeenCalled()
    })

    // useEnsemble should be called with the query (the trimming happens in the condition, not the value)
    expect(mockUseEnsemble).toHaveBeenCalledWith('  What is the best approach?  ')
  })

  it('displays updated hint text when personas are active', async () => {
    mockUseSearch.mockReturnValue({
      query: '',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    // Override fetch to return videos so empty state doesn't show
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/personas/status')) {
        return {
          ok: true,
          json: async () => ({
            channels: [
              {
                channelName: 'Test Channel',
                transcriptCount: 50,
                personaId: 1,
                personaCreatedAt: new Date(),
              },
            ],
            threshold: 30,
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          videos: [
            {
              id: 1,
              youtubeId: 'test123',
              title: 'Test Video',
              channelId: 'UCtest',
              channelName: 'Test Channel',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          stats: { count: 1, totalHours: 1, channels: 1 },
          focusAreaMap: {},
        }),
      }
    })

    render(<Home />)

    // Wait for persona status to load
    await waitFor(() => {
      const hint = screen.queryByText(/End with \? to ask your personas/i)
      expect(hint).toBeInTheDocument()
    })

    // Should not show old hint text
    expect(screen.queryByText(/Ask a question \(3\+ words\) to hear from your personas/i)).not.toBeInTheDocument()
  })

  it('shows persona panel when query has question mark', async () => {
    mockUseSearch.mockReturnValue({
      query: 'What is the best approach?',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    // Mock ensemble state with personas
    mockUseEnsemble.mockReturnValue({
      state: {
        isLoading: true,
        personas: new Map(),
        bestMatch: null,
        isAllDone: false,
        error: null,
      },
      retry: mockRetryEnsemble,
    })

    render(<Home />)

    // Wait for component to render
    await waitFor(() => {
      // PersonaPanel should be rendered (it might not have visible text yet)
      // We're checking that useEnsemble was called with a non-null query
      expect(mockUseEnsemble).toHaveBeenCalledWith('What is the best approach?')
    })
  })

  it('does not show persona panel when query lacks question mark', async () => {
    mockUseSearch.mockReturnValue({
      query: 'What is the best approach',
      setQuery: mockSetQuery,
      results: null,
      isLoading: false,
      error: null,
      mode: 'hybrid' as const,
      setMode: vi.fn(),
    })

    render(<Home />)

    // Wait for component to settle
    await waitFor(() => {
      expect(mockUseEnsemble).toHaveBeenCalled()
    })

    // useEnsemble should be called with null, so panel shouldn't render
    expect(mockUseEnsemble).toHaveBeenCalledWith(null)
  })
})
