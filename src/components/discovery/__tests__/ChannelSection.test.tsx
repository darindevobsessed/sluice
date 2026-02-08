import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChannelSection } from '../ChannelSection'

// Mock fetch
global.fetch = vi.fn()

describe('ChannelSection', () => {
  const mockChannel = {
    id: 1,
    channelId: 'UCtest',
    name: 'Test Channel',
    createdAt: new Date('2024-01-10T12:00:00Z'),
  }

  const mockVideos = [
    {
      youtubeId: 'video1',
      title: 'Video 1',
      channelId: 'UCtest',
      channelName: 'Test Channel',
      publishedAt: new Date('2024-01-15T12:00:00Z').toISOString(),
      description: 'Description 1',
      inBank: false,
    },
    {
      youtubeId: 'video2',
      title: 'Video 2',
      channelId: 'UCtest',
      channelName: 'Test Channel',
      publishedAt: new Date('2024-01-14T12:00:00Z').toISOString(),
      description: 'Description 2',
      inBank: true,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render channel name and handle', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    expect(screen.getByText('Test Channel')).toBeInTheDocument()
    expect(screen.getByText('@UCtest')).toBeInTheDocument()
  })

  it('should render unfollow button', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    expect(screen.getByRole('button', { name: /unfollow/i })).toBeInTheDocument()
  })

  it('should fetch and render videos in horizontal scroll', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Video 1')).toBeInTheDocument()
      expect(screen.getByText('Video 2')).toBeInTheDocument()
    })
  })

  it('should show loading skeletons while fetching videos', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    )

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    // Should show skeleton cards
    const container = screen.getByTestId('channel-videos-container')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('should show error message when fetch fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load videos/i)).toBeInTheDocument()
    })
  })

  it('should call onUnfollow when unfollow button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnUnfollow = vi.fn()

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={mockOnUnfollow} />)

    const unfollowButton = screen.getByRole('button', { name: /unfollow/i })
    await user.click(unfollowButton)

    expect(mockOnUnfollow).toHaveBeenCalledWith(mockChannel.id)
  })

  it('should have horizontal scroll container with snap', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    const container = screen.getByTestId('channel-videos-container')
    expect(container).toHaveClass('overflow-x-auto')
    expect(container).toHaveClass('scroll-smooth')
    expect(container).toHaveStyle({ scrollSnapType: 'x mandatory' })
  })

  it('should show empty state when channel has no videos', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/no videos found/i)).toBeInTheDocument()
    })
  })

  it('should re-fetch videos when refreshTrigger changes', async () => {
    // Initial fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    const { rerender } = render(
      <ChannelSection channel={mockChannel} onUnfollow={vi.fn()} refreshTrigger={0} />
    )

    await waitFor(() => {
      expect(screen.getByText('Video 1')).toBeInTheDocument()
    })

    // Clear mocks to track new calls
    vi.clearAllMocks()

    // Mock second fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    // Trigger refresh by changing refreshTrigger prop
    rerender(
      <ChannelSection channel={mockChannel} onUnfollow={vi.fn()} refreshTrigger={1} />
    )

    // Should re-fetch videos
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/channels/${mockChannel.id}/videos`)
    })
  })

  it('should render per-channel refresh button', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    // Should have a refresh button in the channel header
    const refreshButtons = screen.getAllByRole('button', { name: /refresh/i })
    expect(refreshButtons.length).toBeGreaterThan(0)
  })

  it('should re-fetch videos when per-channel refresh button is clicked', async () => {
    const user = userEvent.setup()

    // Initial fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    render(<ChannelSection channel={mockChannel} onUnfollow={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Video 1')).toBeInTheDocument()
    })

    // Clear mocks
    vi.clearAllMocks()

    // Mock refresh fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    // Click per-channel refresh button
    const refreshButtons = screen.getAllByRole('button', { name: /refresh/i })
    await user.click(refreshButtons[0]!)

    // Should re-fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/channels/${mockChannel.id}/videos`)
    })
  })
})
