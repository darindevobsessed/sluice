import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChannelRecommendationCard } from '../ChannelRecommendationCard'

// Mock fetch
global.fetch = vi.fn()

const mockChannel = {
  channelName: 'Test Channel',
  similarity: 0.92,
  videoCount: 5,
  sampleTitles: [
    'First Sample Video',
    'Second Sample Video',
    'Third Sample Video',
  ],
}

describe('ChannelRecommendationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders channel name', () => {
    render(<ChannelRecommendationCard channel={mockChannel} />)

    expect(screen.getByText('Test Channel')).toBeInTheDocument()
  })

  it('renders similarity percentage as badge', () => {
    render(<ChannelRecommendationCard channel={mockChannel} />)

    expect(screen.getByText('92% match')).toBeInTheDocument()
  })

  it('renders video count', () => {
    render(<ChannelRecommendationCard channel={mockChannel} />)

    expect(screen.getByText('5 videos in bank')).toBeInTheDocument()
  })

  it('renders sample video titles', () => {
    render(<ChannelRecommendationCard channel={mockChannel} />)

    expect(screen.getByText('First Sample Video')).toBeInTheDocument()
    expect(screen.getByText('Second Sample Video')).toBeInTheDocument()
    expect(screen.getByText('Third Sample Video')).toBeInTheDocument()
  })

  it('renders only 2-3 sample titles when provided', () => {
    const channelWithTwoTitles = {
      ...mockChannel,
      sampleTitles: ['Title 1', 'Title 2'],
    }

    render(<ChannelRecommendationCard channel={channelWithTwoTitles} />)

    expect(screen.getByText('Title 1')).toBeInTheDocument()
    expect(screen.getByText('Title 2')).toBeInTheDocument()
  })

  it('renders Follow button initially', () => {
    render(<ChannelRecommendationCard channel={mockChannel} />)

    const followButton = screen.getByRole('button', { name: /follow/i })
    expect(followButton).toBeInTheDocument()
    expect(followButton).not.toBeDisabled()
  })

  it('does not render Add to Cron button initially', () => {
    render(<ChannelRecommendationCard channel={mockChannel} />)

    expect(screen.queryByRole('button', { name: /add to cron/i })).not.toBeInTheDocument()
  })

  it('calls follow endpoint when Follow button is clicked', async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ channel: { id: 1, name: 'Test Channel' } }),
    })

    render(<ChannelRecommendationCard channel={mockChannel} />)

    const followButton = screen.getByRole('button', { name: /follow/i })
    await user.click(followButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/channels/similar/follow',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName: 'Test Channel' }),
        })
      )
    })
  })

  it('shows Following badge after successful follow', async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ channel: { id: 1, name: 'Test Channel' } }),
    })

    render(<ChannelRecommendationCard channel={mockChannel} />)

    const followButton = screen.getByRole('button', { name: /follow/i })
    await user.click(followButton)

    await waitFor(() => {
      expect(screen.getByText(/following/i)).toBeInTheDocument()
    })
  })

  it('disables Follow button after successful follow', async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ channel: { id: 1, name: 'Test Channel' } }),
    })

    render(<ChannelRecommendationCard channel={mockChannel} />)

    const followButton = screen.getByRole('button', { name: /follow/i })
    await user.click(followButton)

    await waitFor(() => {
      expect(followButton).toBeDisabled()
    })
  })

  it('shows Add to Cron button after successful follow', async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ channel: { id: 1, name: 'Test Channel' } }),
    })

    render(<ChannelRecommendationCard channel={mockChannel} />)

    const followButton = screen.getByRole('button', { name: /follow/i })
    await user.click(followButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to cron/i })).toBeInTheDocument()
    })
  })

  it('calls automation endpoint when Add to Cron is clicked', async () => {
    const user = userEvent.setup()
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>

    // First call: follow
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channel: { id: 1, name: 'Test Channel' } }),
    })

    render(<ChannelRecommendationCard channel={mockChannel} />)

    // Follow the channel first
    const followButton = screen.getByRole('button', { name: /follow/i })
    await user.click(followButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to cron/i })).toBeInTheDocument()
    })

    // Second call: add to cron
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ autoFetch: true }),
    })

    const cronButton = screen.getByRole('button', { name: /add to cron/i })
    await user.click(cronButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/channels/1/automation',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoFetch: true }),
        })
      )
    })
  })

  it('shows error message when follow fails', async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to follow channel' }),
    })

    render(<ChannelRecommendationCard channel={mockChannel} />)

    const followButton = screen.getByRole('button', { name: /follow/i })
    await user.click(followButton)

    await waitFor(() => {
      expect(screen.getByText(/failed to follow/i)).toBeInTheDocument()
    })
  })

  it('handles network error gracefully', async () => {
    const user = userEvent.setup()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    )

    render(<ChannelRecommendationCard channel={mockChannel} />)

    const followButton = screen.getByRole('button', { name: /follow/i })
    await user.click(followButton)

    await waitFor(() => {
      expect(screen.getByText(/failed to follow/i)).toBeInTheDocument()
    })
  })

  it('has correct min-width for horizontal scroll', () => {
    const { container } = render(<ChannelRecommendationCard channel={mockChannel} />)

    const card = container.querySelector('[class*="min-w-"]')
    expect(card).toBeInTheDocument()
  })
})
