import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Discovery from '../page'

// Mock Next.js navigation
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

// Mock fetch
global.fetch = vi.fn()

describe('Discovery Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show empty state when no channels are followed', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByText(/no channels followed yet/i)).toBeInTheDocument()
    })
  })

  it('should render follow channel input', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /follow a channel/i })).toBeInTheDocument()
    })
  })

  it('should fetch and display followed channels', async () => {
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest1',
        name: 'Test Channel 1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        channelId: 'UCtest2',
        name: 'Test Channel 2',
        createdAt: new Date().toISOString(),
      },
    ]

    // Mock channels fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannels,
    })

    // Mock videos fetch for each channel
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByText('Test Channel 1')).toBeInTheDocument()
      expect(screen.getByText('Test Channel 2')).toBeInTheDocument()
    })
  })

  it('should show loading state while fetching channels', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    )

    render(<Discovery />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should show error state when channel fetch fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load channels/i)).toBeInTheDocument()
    })
  })

  it('should add new channel when followed', async () => {
    const user = userEvent.setup()

    // Initial empty channels
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /follow a channel/i })).toBeInTheDocument()
    })

    // Expand follow input
    await user.click(screen.getByRole('button', { name: /follow a channel/i }))

    // Mock follow channel API
    const mockNewChannel = {
      id: 1,
      channelId: 'UCnew',
      name: 'New Channel',
      createdAt: new Date().toISOString(),
    }

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ channel: mockNewChannel }),
    })

    // Mock videos fetch for new channel
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    // Submit follow
    await user.type(screen.getByPlaceholderText(/youtube channel url/i), 'https://youtube.com/@newchannel')
    await user.click(screen.getByRole('button', { name: /^follow$/i }))

    await waitFor(() => {
      expect(screen.getByText('New Channel')).toBeInTheDocument()
    })
  })

  it('should remove channel when unfollowed', async () => {
    const user = userEvent.setup()

    const mockChannel = {
      id: 1,
      channelId: 'UCtest',
      name: 'Test Channel',
      createdAt: new Date().toISOString(),
    }

    // Initial channels fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockChannel],
    })

    // Mock videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    // Mock unfollow API
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    // Click unfollow
    const unfollowButton = screen.getByRole('button', { name: /unfollow/i })
    await user.click(unfollowButton)

    await waitFor(() => {
      expect(screen.queryByText('Test Channel')).not.toBeInTheDocument()
    })
  })
})
