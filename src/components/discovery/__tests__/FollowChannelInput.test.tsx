import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FollowChannelInput } from '../FollowChannelInput'

// Mock fetch
global.fetch = vi.fn()

describe('FollowChannelInput', () => {
  const mockOnChannelFollowed = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render collapsed by default with follow button', () => {
    render(<FollowChannelInput onChannelFollowed={mockOnChannelFollowed} />)
    expect(screen.getByRole('button', { name: /follow a channel/i })).toBeInTheDocument()
  })

  it('should expand input when follow button is clicked', async () => {
    const user = userEvent.setup()
    render(<FollowChannelInput onChannelFollowed={mockOnChannelFollowed} />)

    const followButton = screen.getByRole('button', { name: /follow a channel/i })
    await user.click(followButton)

    expect(screen.getByPlaceholderText(/youtube channel url/i)).toBeInTheDocument()
  })

  it('should show error for invalid URL', async () => {
    const user = userEvent.setup()
    render(<FollowChannelInput onChannelFollowed={mockOnChannelFollowed} />)

    // Expand input
    await user.click(screen.getByRole('button', { name: /follow a channel/i }))

    // Enter invalid URL
    const input = screen.getByPlaceholderText(/youtube channel url/i)
    await user.type(input, 'not a url')

    // Submit
    const submitButton = screen.getByRole('button', { name: /follow/i })
    await user.click(submitButton)

    expect(screen.getByText(/enter a valid youtube url/i)).toBeInTheDocument()
  })

  it('should call API with valid URL', async () => {
    const user = userEvent.setup()
    const mockChannel = {
      id: 1,
      channelId: 'UCtest',
      name: 'Test Channel',
      createdAt: new Date().toISOString(),
    }

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ channel: mockChannel }),
    })

    render(<FollowChannelInput onChannelFollowed={mockOnChannelFollowed} />)

    // Expand input
    await user.click(screen.getByRole('button', { name: /follow a channel/i }))

    // Enter valid URL
    const input = screen.getByPlaceholderText(/youtube channel url/i)
    await user.type(input, 'https://youtube.com/@testchannel')

    // Submit
    const submitButton = screen.getByRole('button', { name: /follow/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://youtube.com/@testchannel' }),
      })
    })
  })

  it('should show loading state while submitting', async () => {
    const user = userEvent.setup()

    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 100))
    )

    render(<FollowChannelInput onChannelFollowed={mockOnChannelFollowed} />)

    // Expand and submit
    await user.click(screen.getByRole('button', { name: /follow a channel/i }))
    await user.type(screen.getByPlaceholderText(/youtube channel url/i), 'https://youtube.com/@test')
    await user.click(screen.getByRole('button', { name: /follow/i }))

    expect(screen.getByRole('button', { name: /following/i })).toBeDisabled()
  })

  it('should display API error message', async () => {
    const user = userEvent.setup()

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Channel already followed' }),
    })

    render(<FollowChannelInput onChannelFollowed={mockOnChannelFollowed} />)

    await user.click(screen.getByRole('button', { name: /follow a channel/i }))
    await user.type(screen.getByPlaceholderText(/youtube channel url/i), 'https://youtube.com/@test')
    await user.click(screen.getByRole('button', { name: /follow/i }))

    await waitFor(() => {
      expect(screen.getByText('Channel already followed')).toBeInTheDocument()
    })
  })

  it('should call onChannelFollowed callback on success', async () => {
    const user = userEvent.setup()
    const mockChannel = {
      id: 1,
      channelId: 'UCtest',
      name: 'Test Channel',
      createdAt: new Date().toISOString(),
    }

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ channel: mockChannel }),
    })

    render(<FollowChannelInput onChannelFollowed={mockOnChannelFollowed} />)

    await user.click(screen.getByRole('button', { name: /follow a channel/i }))
    await user.type(screen.getByPlaceholderText(/youtube channel url/i), 'https://youtube.com/@test')
    await user.click(screen.getByRole('button', { name: /follow/i }))

    await waitFor(() => {
      expect(mockOnChannelFollowed).toHaveBeenCalledWith(mockChannel)
    })
  })

  it('should reset input and collapse after successful follow', async () => {
    const user = userEvent.setup()
    const mockChannel = {
      id: 1,
      channelId: 'UCtest',
      name: 'Test Channel',
      createdAt: new Date().toISOString(),
    }

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ channel: mockChannel }),
    })

    render(<FollowChannelInput onChannelFollowed={mockOnChannelFollowed} />)

    await user.click(screen.getByRole('button', { name: /follow a channel/i }))
    await user.type(screen.getByPlaceholderText(/youtube channel url/i), 'https://youtube.com/@test')
    await user.click(screen.getByRole('button', { name: /follow/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /follow a channel/i })).toBeInTheDocument()
      expect(screen.queryByPlaceholderText(/youtube channel url/i)).not.toBeInTheDocument()
    })
  })
})
