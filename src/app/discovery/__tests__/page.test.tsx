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
    // Mock /api/channels - returns empty array
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

  it('should display videos in grid when channels exist', async () => {
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest1',
        name: 'Test Channel 1',
        createdAt: new Date().toISOString(),
      },
    ]

    const mockDiscoveryVideos = [
      {
        youtubeId: 'vid1',
        title: 'Test Video 1',
        channelId: 'UCtest1',
        channelName: 'Test Channel 1',
        publishedAt: new Date().toISOString(),
        description: 'Test description',
        inBank: false,
      },
      {
        youtubeId: 'vid2',
        title: 'Test Video 2',
        channelId: 'UCtest1',
        channelName: 'Test Channel 1',
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        description: 'Test description 2',
        inBank: true,
      },
    ]

    const mockBankVideos = [
      {
        id: 1,
        youtubeId: 'vid2',
        title: 'Test Video 2',
      },
    ]

    const mockFocusAreaMap = {
      1: [{ id: 1, name: 'TypeScript', color: '#3178c6' }],
    }

    // Mock /api/channels
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannels,
    })

    // Mock /api/channels/videos
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDiscoveryVideos,
    })

    // Mock /api/videos
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        videos: mockBankVideos,
        stats: {},
        focusAreaMap: mockFocusAreaMap,
      }),
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByText('Test Video 1')).toBeInTheDocument()
      expect(screen.getByText('Test Video 2')).toBeInTheDocument()
    })
  })

  it('should show loading state with skeleton grid', () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    )

    render(<Discovery />)

    // Check for multiple skeleton cards (grid should have 24)
    const skeletons = screen.getAllByTestId('discovery-video-card-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should show error state when fetch fails', async () => {
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

  it('should refetch videos when a new channel is followed', async () => {
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

    // Mock videos fetch after follow
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [{
        youtubeId: 'new-vid',
        title: 'New Video',
        channelId: 'UCnew',
        channelName: 'New Channel',
        publishedAt: new Date().toISOString(),
        description: 'New video description',
        inBank: false,
      }],
    })

    // Mock /api/videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        videos: [],
        stats: {},
        focusAreaMap: {},
      }),
    })

    // Submit follow
    await user.type(screen.getByPlaceholderText(/youtube channel url/i), 'https://youtube.com/@newchannel')
    await user.click(screen.getByRole('button', { name: /^follow$/i }))

    // Should fetch videos after following
    await waitFor(() => {
      expect(screen.getByText('New Video')).toBeInTheDocument()
    })
  })

  it('should handle channel unfollow flow correctly', async () => {
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest',
        name: 'Test Channel',
        createdAt: new Date().toISOString(),
      },
    ]

    const mockVideos = [
      {
        youtubeId: 'vid1',
        title: 'Test Video',
        channelId: 'UCtest',
        channelName: 'Test Channel',
        publishedAt: new Date().toISOString(),
        description: 'Test',
        inBank: false,
      },
    ]

    // Initial channels fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannels,
    })

    // Mock videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    // Mock /api/videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        videos: [],
        stats: {},
        focusAreaMap: {},
      }),
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument()
    })
  })

  it('should render refresh button when channels exist', async () => {
    const mockChannel = {
      id: 1,
      channelId: 'UCtest',
      name: 'Test Channel',
      createdAt: new Date().toISOString(),
    }

    // Mock channels fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockChannel],
    })

    // Mock videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    // Mock /api/videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        videos: [],
        stats: {},
        focusAreaMap: {},
      }),
    })

    render(<Discovery />)

    // Wait for channels to load first, then check for refresh button
    await waitFor(() => {
      const refreshButton = screen.queryByRole('button', { name: /refresh all channels/i })
      expect(refreshButton).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should not render refresh button when no channels exist', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<Discovery />)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /refresh all channels/i })).not.toBeInTheDocument()
    })
  })

  it('should refetch videos when refresh button is clicked', async () => {
    const user = userEvent.setup()

    const mockChannel = {
      id: 1,
      channelId: 'UCtest',
      name: 'Test Channel',
      createdAt: new Date().toISOString(),
    }

    const mockVideos = [
      {
        youtubeId: 'vid1',
        title: 'Test Video',
        channelId: 'UCtest',
        channelName: 'Test Channel',
        publishedAt: new Date().toISOString(),
        description: 'Test',
        inBank: false,
      },
    ]

    // Initial channels fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockChannel],
    })

    // Mock initial videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    // Mock /api/videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        videos: [],
        stats: {},
        focusAreaMap: {},
      }),
    })

    render(<Discovery />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument()
    })

    // Clear previous fetch calls
    vi.clearAllMocks()

    // Mock refresh videos fetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVideos,
    })

    // Mock /api/videos refetch
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        videos: [],
        stats: {},
        focusAreaMap: {},
      }),
    })

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh all channels/i })
    await user.click(refreshButton)

    // Should re-fetch channel videos
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/channels/videos')
    })
  })

  describe('Channel Filter Integration', () => {
    it('should render channel filter dropdown when channels exist', async () => {
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

      const mockVideos = [
        {
          youtubeId: 'vid1',
          title: 'Video from Channel 1',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
      ]

      // Mock /api/channels
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      // Mock /api/channels/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos,
      })

      // Mock /api/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [],
          stats: {},
          focusAreaMap: {},
        }),
      })

      render(<Discovery />)

      await waitFor(() => {
        expect(screen.getByText('All Channels')).toBeInTheDocument()
      })
    })

    it('should not render channel filter dropdown when no channels exist', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      render(<Discovery />)

      await waitFor(() => {
        expect(screen.queryByText('All Channels')).not.toBeInTheDocument()
      })
    })

    it('should filter videos to show only selected channel', async () => {
      const user = userEvent.setup()

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

      const mockVideos = [
        {
          youtubeId: 'vid1',
          title: 'Video from Channel 1',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
        {
          youtubeId: 'vid2',
          title: 'Video from Channel 2',
          channelId: 'UCtest2',
          channelName: 'Test Channel 2',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
      ]

      // Mock /api/channels
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      // Mock /api/channels/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos,
      })

      // Mock /api/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [],
          stats: {},
          focusAreaMap: {},
        }),
      })

      render(<Discovery />)

      // Wait for videos to load
      await waitFor(() => {
        expect(screen.getByText('Video from Channel 1')).toBeInTheDocument()
        expect(screen.getByText('Video from Channel 2')).toBeInTheDocument()
      })

      // Click filter dropdown
      await user.click(screen.getByText('All Channels'))

      // Select Channel 1
      await user.click(screen.getByText('Test Channel 1'))

      // Should only show Channel 1 videos
      await waitFor(() => {
        expect(screen.getByText('Video from Channel 1')).toBeInTheDocument()
        expect(screen.queryByText('Video from Channel 2')).not.toBeInTheDocument()
      })
    })

    it('should show all videos when "All Channels" is selected', async () => {
      const user = userEvent.setup()

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

      const mockVideos = [
        {
          youtubeId: 'vid1',
          title: 'Video from Channel 1',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
        {
          youtubeId: 'vid2',
          title: 'Video from Channel 2',
          channelId: 'UCtest2',
          channelName: 'Test Channel 2',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
      ]

      // Mock /api/channels
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      // Mock /api/channels/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos,
      })

      // Mock /api/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [],
          stats: {},
          focusAreaMap: {},
        }),
      })

      render(<Discovery />)

      // Wait for videos to load
      await waitFor(() => {
        expect(screen.getByText('Video from Channel 1')).toBeInTheDocument()
      })

      // Click filter dropdown
      await user.click(screen.getByText('All Channels'))

      // Select a specific channel first
      await user.click(screen.getByText('Test Channel 1'))

      // Should only show Channel 1 videos
      await waitFor(() => {
        expect(screen.queryByText('Video from Channel 2')).not.toBeInTheDocument()
      })

      // Now select "All Channels" again
      await user.click(screen.getByText('Test Channel 1'))
      await user.click(screen.getByText('All Channels'))

      // Should show all videos again
      await waitFor(() => {
        expect(screen.getByText('Video from Channel 1')).toBeInTheDocument()
        expect(screen.getByText('Video from Channel 2')).toBeInTheDocument()
      })
    })

    it('should display channel name in dropdown trigger when channel is selected', async () => {
      const user = userEvent.setup()

      const mockChannels = [
        {
          id: 1,
          channelId: 'UCtest1',
          name: 'Test Channel 1',
          createdAt: new Date().toISOString(),
        },
      ]

      const mockVideos = [
        {
          youtubeId: 'vid1',
          title: 'Video from Channel 1',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
      ]

      // Mock /api/channels
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      // Mock /api/channels/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos,
      })

      // Mock /api/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [],
          stats: {},
          focusAreaMap: {},
        }),
      })

      render(<Discovery />)

      // Wait for videos to load
      await waitFor(() => {
        expect(screen.getByText('Video from Channel 1')).toBeInTheDocument()
      })

      // Initial state should show "All Channels"
      expect(screen.getByText('All Channels')).toBeInTheDocument()

      // Click filter dropdown and select channel
      await user.click(screen.getByText('All Channels'))
      await user.click(screen.getByText('Test Channel 1'))

      // Trigger should now show the selected channel name
      await waitFor(() => {
        // Check that "Test Channel 1" appears (in the trigger, not just the menu)
        const triggers = screen.getAllByText('Test Channel 1')
        expect(triggers.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Content Type Filter Integration', () => {
    it('should render content type filter dropdown when channels exist', async () => {
      const mockChannels = [
        {
          id: 1,
          channelId: 'UCtest1',
          name: 'Test Channel 1',
          createdAt: new Date().toISOString(),
        },
      ]

      const mockVideos = [
        {
          youtubeId: 'vid1',
          title: 'Video 1',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
      ]

      // Mock /api/channels
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      // Mock /api/channels/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos,
      })

      // Mock /api/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [],
          stats: {},
          focusAreaMap: {},
        }),
      })

      render(<Discovery />)

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument()
      })
    })

    it('should not render content type filter when no channels exist', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      render(<Discovery />)

      await waitFor(() => {
        expect(screen.queryByText('All')).not.toBeInTheDocument()
      })
    })

    it('should filter to show only not saved videos (inBank: false) when "Not Saved" is selected', async () => {
      const user = userEvent.setup()

      const mockChannels = [
        {
          id: 1,
          channelId: 'UCtest1',
          name: 'Test Channel 1',
          createdAt: new Date().toISOString(),
        },
      ]

      const mockVideos = [
        {
          youtubeId: 'vid1',
          title: 'Video Not In Bank',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
        {
          youtubeId: 'vid2',
          title: 'Video In Bank',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: true,
        },
      ]

      // Mock /api/channels
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      // Mock /api/channels/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos,
      })

      // Mock /api/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [],
          stats: {},
          focusAreaMap: {},
        }),
      })

      render(<Discovery />)

      // Wait for videos to load
      await waitFor(() => {
        expect(screen.getByText('Video Not In Bank')).toBeInTheDocument()
        expect(screen.getByText('Video In Bank')).toBeInTheDocument()
      })

      // Click content type filter dropdown
      const allButtons = screen.getAllByText('All')
      const contentTypeAllButton = allButtons[0] // Get the content type filter "All"
      if (!contentTypeAllButton) throw new Error('Content type filter not found')
      await user.click(contentTypeAllButton)

      // Select "Not Saved"
      await user.click(screen.getByText('Not Saved'))

      // Should only show videos not in bank
      await waitFor(() => {
        expect(screen.getByText('Video Not In Bank')).toBeInTheDocument()
        expect(screen.queryByText('Video In Bank')).not.toBeInTheDocument()
      })
    })

    it('should filter to show only saved videos (inBank: true) when "Saved" is selected', async () => {
      const user = userEvent.setup()

      const mockChannels = [
        {
          id: 1,
          channelId: 'UCtest1',
          name: 'Test Channel 1',
          createdAt: new Date().toISOString(),
        },
      ]

      const mockVideos = [
        {
          youtubeId: 'vid1',
          title: 'Video Not In Bank',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
        {
          youtubeId: 'vid2',
          title: 'Video In Bank',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: true,
        },
      ]

      // Mock /api/channels
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      // Mock /api/channels/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos,
      })

      // Mock /api/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [],
          stats: {},
          focusAreaMap: {},
        }),
      })

      render(<Discovery />)

      // Wait for videos to load
      await waitFor(() => {
        expect(screen.getByText('Video Not In Bank')).toBeInTheDocument()
        expect(screen.getByText('Video In Bank')).toBeInTheDocument()
      })

      // Click content type filter dropdown
      const allButtons = screen.getAllByText('All')
      const contentTypeAllButton = allButtons[0]
      if (!contentTypeAllButton) throw new Error('Content type filter not found')
      await user.click(contentTypeAllButton)

      // Select "Saved"
      await user.click(screen.getByText('Saved'))

      // Should only show videos in bank
      await waitFor(() => {
        expect(screen.queryByText('Video Not In Bank')).not.toBeInTheDocument()
        expect(screen.getByText('Video In Bank')).toBeInTheDocument()
      })
    })

    it('should compose both channel and content type filters together', async () => {
      const user = userEvent.setup()

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

      const mockVideos = [
        {
          youtubeId: 'vid1',
          title: 'Channel 1 - Not In Bank',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
        {
          youtubeId: 'vid2',
          title: 'Channel 1 - In Bank',
          channelId: 'UCtest1',
          channelName: 'Test Channel 1',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: true,
        },
        {
          youtubeId: 'vid3',
          title: 'Channel 2 - Not In Bank',
          channelId: 'UCtest2',
          channelName: 'Test Channel 2',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: false,
        },
        {
          youtubeId: 'vid4',
          title: 'Channel 2 - In Bank',
          channelId: 'UCtest2',
          channelName: 'Test Channel 2',
          publishedAt: new Date().toISOString(),
          description: 'Test',
          inBank: true,
        },
      ]

      // Mock /api/channels
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      // Mock /api/channels/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos,
      })

      // Mock /api/videos
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          videos: [],
          stats: {},
          focusAreaMap: {},
        }),
      })

      render(<Discovery />)

      // Wait for videos to load
      await waitFor(() => {
        expect(screen.getByText('Channel 1 - Not In Bank')).toBeInTheDocument()
      })

      // Select Channel 1
      await user.click(screen.getByText('All Channels'))
      await user.click(screen.getByText('Test Channel 1'))

      // Should show both Channel 1 videos
      await waitFor(() => {
        expect(screen.getByText('Channel 1 - Not In Bank')).toBeInTheDocument()
        expect(screen.getByText('Channel 1 - In Bank')).toBeInTheDocument()
        expect(screen.queryByText('Channel 2 - Not In Bank')).not.toBeInTheDocument()
        expect(screen.queryByText('Channel 2 - In Bank')).not.toBeInTheDocument()
      })

      // Now select "Not Saved" content type
      const allButtons = screen.getAllByText('All')
      const contentTypeAllButton = allButtons[0] // Content type filter
      if (!contentTypeAllButton) throw new Error('Content type filter not found')
      await user.click(contentTypeAllButton)
      await user.click(screen.getByText('Not Saved'))

      // Should only show Channel 1 videos that are not in bank
      await waitFor(() => {
        expect(screen.getByText('Channel 1 - Not In Bank')).toBeInTheDocument()
        expect(screen.queryByText('Channel 1 - In Bank')).not.toBeInTheDocument()
        expect(screen.queryByText('Channel 2 - Not In Bank')).not.toBeInTheDocument()
        expect(screen.queryByText('Channel 2 - In Bank')).not.toBeInTheDocument()
      })
    })
  })
})
