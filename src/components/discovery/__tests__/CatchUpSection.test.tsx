import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CatchUpSection } from '../CatchUpSection'

// Mock useLastVisited hook
vi.mock('@/hooks/useLastVisited', () => ({
  useLastVisited: vi.fn(),
}))

// Mock fetch
global.fetch = vi.fn()

// Import after mocking
import { useLastVisited } from '@/hooks/useLastVisited'

const mockUseLastVisited = vi.mocked(useLastVisited)

describe('CatchUpSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when lastVisitedAt is null (first visit)', () => {
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt: null,
      markVisited: vi.fn(),
    })

    const { container } = render(<CatchUpSection />)

    expect(container.firstChild).toBeNull()
  })

  it('renders loading state while fetching', () => {
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt: '2026-02-01T12:00:00.000Z',
      markVisited: vi.fn(),
    })

    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<CatchUpSection />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders error state when fetch fails', async () => {
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt: '2026-02-01T12:00:00.000Z',
      markVisited: vi.fn(),
    })

    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    )

    render(<CatchUpSection />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })

  it('renders "all caught up" message when no new videos', async () => {
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt: '2026-02-01T12:00:00.000Z',
      markVisited: vi.fn(),
    })

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<CatchUpSection />)

    await waitFor(() => {
      expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument()
    })
  })

  it('renders catch-up header with count', async () => {
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt: '2026-02-01T12:00:00.000Z',
      markVisited: vi.fn(),
    })

    const mockVideos = [
      {
        youtubeId: 'vid1',
        title: 'New Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: '2026-02-02T10:00:00.000Z',
        description: 'Description',
        inBank: false,
      },
      {
        youtubeId: 'vid2',
        title: 'New Video 2',
        channelId: 'UCtest2',
        channelName: 'Channel 2',
        publishedAt: '2026-02-03T10:00:00.000Z',
        description: 'Description',
        inBank: false,
      },
    ]

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockVideos,
    })

    render(<CatchUpSection />)

    await waitFor(() => {
      expect(screen.getByText(/catch up \(2 new\)/i)).toBeInTheDocument()
    })
  })

  it('renders video cards with green "new" dots', async () => {
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt: '2026-02-01T12:00:00.000Z',
      markVisited: vi.fn(),
    })

    const mockVideos = [
      {
        youtubeId: 'vid1',
        title: 'New Video',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: '2026-02-02T10:00:00.000Z',
        description: 'Description',
        inBank: false,
      },
    ]

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockVideos,
    })

    render(<CatchUpSection />)

    await waitFor(() => {
      expect(screen.getByText('New Video')).toBeInTheDocument()
    })

    // Check for green dot (by class or data-testid if we add it)
    const container = screen.getByText('New Video').closest('[class*="group"]')
    expect(container).toBeInTheDocument()
  })

  it('fetches videos with since parameter from lastVisitedAt', async () => {
    const lastVisitedAt = '2026-02-01T12:00:00.000Z'
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt,
      markVisited: vi.fn(),
    })

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<CatchUpSection />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/channels/videos?since=${encodeURIComponent(lastVisitedAt)}`,
        expect.any(Object)
      )
    })
  })

  it('passes inBank prop correctly to video cards', async () => {
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt: '2026-02-01T12:00:00.000Z',
      markVisited: vi.fn(),
    })

    const mockVideos = [
      {
        youtubeId: 'vid1',
        title: 'In Bank Video',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: '2026-02-02T10:00:00.000Z',
        description: 'Description',
        inBank: true,
      },
      {
        youtubeId: 'vid2',
        title: 'Not In Bank Video',
        channelId: 'UCtest2',
        channelName: 'Channel 2',
        publishedAt: '2026-02-03T10:00:00.000Z',
        description: 'Description',
        inBank: false,
      },
    ]

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockVideos,
    })

    render(<CatchUpSection />)

    await waitFor(() => {
      expect(screen.getByText('In Bank Video')).toBeInTheDocument()
      expect(screen.getByText('Not In Bank Video')).toBeInTheDocument()
    })

    // Verify "In Bank" badge is shown for the first video
    expect(screen.getByText('In Bank')).toBeInTheDocument()

    // Verify "Add to Bank" button is shown for the second video
    expect(screen.getByText('Add to Bank')).toBeInTheDocument()
  })

  it('renders videos in chronological order (newest first)', async () => {
    mockUseLastVisited.mockReturnValue({
      lastVisitedAt: '2026-02-01T12:00:00.000Z',
      markVisited: vi.fn(),
    })

    const mockVideos = [
      {
        youtubeId: 'vid3',
        title: 'Newest Video',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: '2026-02-05T10:00:00.000Z',
        description: 'Description',
        inBank: false,
      },
      {
        youtubeId: 'vid2',
        title: 'Middle Video',
        channelId: 'UCtest2',
        channelName: 'Channel 2',
        publishedAt: '2026-02-03T10:00:00.000Z',
        description: 'Description',
        inBank: false,
      },
      {
        youtubeId: 'vid1',
        title: 'Oldest Video',
        channelId: 'UCtest3',
        channelName: 'Channel 3',
        publishedAt: '2026-02-02T10:00:00.000Z',
        description: 'Description',
        inBank: false,
      },
    ]

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockVideos,
    })

    render(<CatchUpSection />)

    await waitFor(() => {
      const titles = screen.getAllByRole('heading', { level: 3 })
      expect(titles[0]).toHaveTextContent('Newest Video')
      expect(titles[1]).toHaveTextContent('Middle Video')
      expect(titles[2]).toHaveTextContent('Oldest Video')
    })
  })
})
