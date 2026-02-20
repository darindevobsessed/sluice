import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the DB module
const mockInsert = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
  },
  discoveryVideos: { youtubeId: 'youtube_id' },
  channels: {},
}))

// Mock global fetch so fetchChannelFeed doesn't make real HTTP calls
global.fetch = vi.fn()
const mockFetch = vi.mocked(global.fetch)

// Import after mocking
const { refreshDiscoveryVideos } = await import('../rss')

const VALID_RSS_XML = (channelName: string, youtubeId: string, title: string) => `<?xml version="1.0"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>${channelName}</title>
  <entry>
    <yt:videoId>${youtubeId}</yt:videoId>
    <title>${title}</title>
    <published>2026-02-01T10:00:00Z</published>
    <media:group><media:description>Desc</media:description></media:group>
    <author><name>${channelName}</name></author>
  </entry>
</feed>`

const EMPTY_RSS_XML = (channelName: string) => `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${channelName}</title>
</feed>`

describe('refreshDiscoveryVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero counts when no channels exist', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    })

    const result = await refreshDiscoveryVideos()

    expect(result.videoCount).toBe(0)
    expect(result.channelCount).toBe(0)
    expect(result.errors).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches feeds for all channels and upserts videos', async () => {
    const mockChannels = [
      { id: 1, channelId: 'UCtest1', name: 'Channel 1' },
      { id: 2, channelId: 'UCtest2', name: 'Channel 2' },
    ]

    mockSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => VALID_RSS_XML('Channel 1', 'vid1', 'Video 1'),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => VALID_RSS_XML('Channel 2', 'vid2', 'Video 2'),
      } as Response)

    const mockOnConflict = vi.fn().mockResolvedValue([])
    const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict })
    mockInsert.mockReturnValue({ values: mockValues })

    const result = await refreshDiscoveryVideos()

    expect(result.videoCount).toBe(2)
    expect(result.channelCount).toBe(2)
    expect(result.errors).toEqual([])
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ youtubeId: 'vid1', title: 'Video 1' }),
        expect.objectContaining({ youtubeId: 'vid2', title: 'Video 2' }),
      ])
    )
  })

  it('collects errors for failed feeds but continues processing', async () => {
    const mockChannels = [
      { id: 1, channelId: 'UCtest1', name: 'Channel 1' },
      { id: 2, channelId: 'UCbad', name: 'Bad Channel' },
    ]

    mockSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => VALID_RSS_XML('Channel 1', 'vid1', 'Video 1'),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response)

    const mockOnConflict = vi.fn().mockResolvedValue([])
    const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict })
    mockInsert.mockReturnValue({ values: mockValues })

    const result = await refreshDiscoveryVideos()

    expect(result.videoCount).toBe(1)
    expect(result.channelCount).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('UCbad')
  })

  it('skips upsert when no videos were collected', async () => {
    const mockChannels = [
      { id: 1, channelId: 'UCtest1', name: 'Channel 1' },
    ]

    mockSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => EMPTY_RSS_XML('Channel 1'),
    } as Response)

    const result = await refreshDiscoveryVideos()

    expect(result.videoCount).toBe(0)
    expect(result.channelCount).toBe(1)
    expect(result.errors).toEqual([])
    // No insert when no videos
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('uses ON CONFLICT DO UPDATE to upsert cached videos', async () => {
    const mockChannels = [
      { id: 1, channelId: 'UCtest1', name: 'Channel 1' },
    ]

    mockSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => VALID_RSS_XML('Channel 1', 'vid1', 'Video 1'),
    } as Response)

    const mockOnConflict = vi.fn().mockResolvedValue([])
    const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict })
    mockInsert.mockReturnValue({ values: mockValues })

    await refreshDiscoveryVideos()

    expect(mockOnConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.anything(),
        set: expect.objectContaining({
          title: expect.anything(),
          cachedAt: expect.anything(),
        }),
      })
    )
  })
})
