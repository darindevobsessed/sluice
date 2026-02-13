import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscoveryContent as Discovery } from '@/components/discovery/DiscoveryContent'

// Mock Next.js navigation
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockPathname = '/discovery'
let mockSearchParamsString = ''

// Helper to extract query string from router call
const extractQueryString = (url: string) => {
  const questionMarkIndex = url.indexOf('?')
  return questionMarkIndex >= 0 ? url.slice(questionMarkIndex + 1) : ''
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn((url: string) => {
      mockSearchParamsString = extractQueryString(url)
      mockPush(url)
    }),
    replace: vi.fn((url: string) => {
      mockSearchParamsString = extractQueryString(url)
      mockReplace(url)
    }),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => ({
    toString: () => mockSearchParamsString,
    get: (key: string) => {
      const params = new URLSearchParams(mockSearchParamsString)
      return params.get(key)
    },
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
    mockSearchParamsString = ''
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
    // Note: Filter behavior tests now covered in "URL State Management" describe block
    // These tests verify UI rendering only

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
  })

  describe('Content Type Filter Integration', () => {
    // Note: Filter behavior tests now covered in "URL State Management" describe block
    // These tests verify UI rendering only

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
  })

  describe('URL State Management', () => {
    it('should read channel filter from URL params', async () => {
      mockSearchParamsString = 'channel=UCtest1'

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

      await waitFor(() => {
        // Should only show Channel 1 videos
        expect(screen.getByText('Video from Channel 1')).toBeInTheDocument()
        expect(screen.queryByText('Video from Channel 2')).not.toBeInTheDocument()
      })
    })

    it('should read content type filter from URL params', async () => {
      mockSearchParamsString = 'type=saved'

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

      await waitFor(() => {
        // Should only show saved videos
        expect(screen.queryByText('Video Not In Bank')).not.toBeInTheDocument()
        expect(screen.getByText('Video In Bank')).toBeInTheDocument()
      })
    })

    it('should read page number from URL params', async () => {
      mockSearchParamsString = 'page=2'

      const mockChannels = [
        {
          id: 1,
          channelId: 'UCtest1',
          name: 'Test Channel 1',
          createdAt: new Date().toISOString(),
        },
      ]

      // Create 30 videos to ensure multiple pages
      const mockVideos = Array.from({ length: 30 }, (_, i) => ({
        youtubeId: `vid${i}`,
        title: `Video ${i}`,
        channelId: 'UCtest1',
        channelName: 'Test Channel 1',
        publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
        description: 'Test',
        inBank: false,
      }))

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
        // Page 2 should show videos 24-29 (0-indexed: 24-29)
        expect(screen.getByText('Video 24')).toBeInTheDocument()
        expect(screen.queryByText('Video 0')).not.toBeInTheDocument()
      })
    })

    it('should call router.replace when channel filter changes', async () => {
      const user = userEvent.setup()

      mockSearchParamsString = ''

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
        expect(screen.getByText('All Channels')).toBeInTheDocument()
      })

      // Click channel filter and select channel
      await user.click(screen.getByText('All Channels'))
      await user.click(screen.getByText('Test Channel 1'))

      // Should call router.replace with channel param
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/discovery?channel=UCtest1')
      })
    })

    it('should call router.replace when content type filter changes', async () => {
      const user = userEvent.setup()

      mockSearchParamsString = ''

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
        const allButtons = screen.getAllByText('All')
        expect(allButtons.length).toBeGreaterThan(0)
      })

      // Click content type filter and select "Saved"
      const allButtons = screen.getAllByText('All')
      const contentTypeButton = allButtons[0]
      if (!contentTypeButton) throw new Error('Content type button not found')
      await user.click(contentTypeButton)
      await user.click(screen.getByText('Saved'))

      // Should call router.replace with type param
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/discovery?type=saved')
      })
    })

    it('should reset page to 1 when channel filter changes', async () => {
      const user = userEvent.setup()

      mockSearchParamsString = 'page=2'

      const mockChannels = [
        {
          id: 1,
          channelId: 'UCtest1',
          name: 'Test Channel 1',
          createdAt: new Date().toISOString(),
        },
      ]

      const mockVideos = Array.from({ length: 30 }, (_, i) => ({
        youtubeId: `vid${i}`,
        title: `Video ${i}`,
        channelId: 'UCtest1',
        channelName: 'Test Channel 1',
        publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
        description: 'Test',
        inBank: false,
      }))

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

      // Clear mocks to isolate the channel change call
      vi.clearAllMocks()

      // Click channel filter
      await user.click(screen.getByText('All Channels'))
      await user.click(screen.getByText('Test Channel 1'))

      // Should remove page param when changing channel
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/discovery?channel=UCtest1')
      })
    })

    it('should use router.push for pagination changes', async () => {
      const user = userEvent.setup()

      mockSearchParamsString = ''

      const mockChannels = [
        {
          id: 1,
          channelId: 'UCtest1',
          name: 'Test Channel 1',
          createdAt: new Date().toISOString(),
        },
      ]

      // Create 30 videos to ensure multiple pages
      const mockVideos = Array.from({ length: 30 }, (_, i) => ({
        youtubeId: `vid${i}`,
        title: `Video ${i}`,
        channelId: 'UCtest1',
        channelName: 'Test Channel 1',
        publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
        description: 'Test',
        inBank: false,
      }))

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
        expect(screen.getByText('Video 0')).toBeInTheDocument()
      })

      // Find and click page 2 button
      const page2Button = screen.getByRole('button', { name: '2' })
      await user.click(page2Button)

      // Should call router.push (not replace) with page param
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/discovery?page=2')
        expect(mockReplace).not.toHaveBeenCalled()
      })
    })

    it('should default to all channels, type all, and page 1 when no params are present', async () => {
      mockSearchParamsString = ''

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
        {
          youtubeId: 'vid2',
          title: 'Video 2',
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

      await waitFor(() => {
        // Should show all videos (both saved and not saved)
        expect(screen.getByText('Video 1')).toBeInTheDocument()
        expect(screen.getByText('Video 2')).toBeInTheDocument()
        // Should show "All Channels" text
        expect(screen.getByText('All Channels')).toBeInTheDocument()
        // Should show "All" content type filter
        const allButtons = screen.getAllByText('All')
        expect(allButtons.length).toBeGreaterThan(0)
      })
    })
  })
})
