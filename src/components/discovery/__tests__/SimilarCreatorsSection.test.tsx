import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SimilarCreatorsSection } from '../SimilarCreatorsSection'

// Mock fetch
global.fetch = vi.fn()

const mockSimilarChannels = [
  {
    channelName: 'Similar Channel 1',
    similarity: 0.92,
    videoCount: 5,
    sampleTitles: ['Video 1', 'Video 2', 'Video 3'],
  },
  {
    channelName: 'Similar Channel 2',
    similarity: 0.85,
    videoCount: 3,
    sampleTitles: ['Video A', 'Video B'],
  },
]

describe('SimilarCreatorsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders section header', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: mockSimilarChannels }),
    })

    render(<SimilarCreatorsSection />)

    await waitFor(() => {
      expect(screen.getByText('Discover Similar Creators')).toBeInTheDocument()
    })
  })

  it('fetches from /api/channels/similar on mount', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    })

    render(<SimilarCreatorsSection />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/channels/similar',
        expect.any(Object)
      )
    })
  })

  it('renders loading state while fetching', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<SimilarCreatorsSection />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders skeleton cards during loading', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    const { container } = render(<SimilarCreatorsSection />)

    // Look for skeleton cards (with animate-pulse class)
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders error state when fetch fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    )

    render(<SimilarCreatorsSection />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load suggestions')).toBeInTheDocument()
    })
  })

  it('renders error state when API returns error', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Internal server error' }),
    })

    render(<SimilarCreatorsSection />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load suggestions')).toBeInTheDocument()
    })
  })

  it('renders empty state when no suggestions available', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [] }),
    })

    render(<SimilarCreatorsSection />)

    await waitFor(() => {
      expect(
        screen.getByText(/follow more channels and add videos to get personalized suggestions/i)
      ).toBeInTheDocument()
    })
  })

  it('renders channel recommendation cards when suggestions available', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: mockSimilarChannels }),
    })

    render(<SimilarCreatorsSection />)

    await waitFor(() => {
      expect(screen.getByText('Similar Channel 1')).toBeInTheDocument()
      expect(screen.getByText('Similar Channel 2')).toBeInTheDocument()
    })
  })

  it('renders channels in horizontal scroll container', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: mockSimilarChannels }),
    })

    const { container } = render(<SimilarCreatorsSection />)

    await waitFor(() => {
      expect(screen.getByText('Similar Channel 1')).toBeInTheDocument()
    })

    // Check for horizontal scroll container (overflow-x-auto, flex)
    const scrollContainer = container.querySelector('[class*="overflow-x-auto"]')
    expect(scrollContainer).toBeInTheDocument()
  })

  it('passes channel data correctly to ChannelRecommendationCard', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: mockSimilarChannels }),
    })

    render(<SimilarCreatorsSection />)

    await waitFor(() => {
      // Check that channel details are rendered
      expect(screen.getByText('Similar Channel 1')).toBeInTheDocument()
      expect(screen.getByText('92% match')).toBeInTheDocument()
      expect(screen.getByText('5 videos in bank')).toBeInTheDocument()
    })
  })

  it('aborts fetch on unmount', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    const { unmount } = render(<SimilarCreatorsSection />)

    unmount()

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })

  it('handles AbortError silently', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError)

    render(<SimilarCreatorsSection />)

    await waitFor(() => {
      // Should not show error message for abort
      expect(screen.queryByText('Failed to load suggestions')).not.toBeInTheDocument()
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
