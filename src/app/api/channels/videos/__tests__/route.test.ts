import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GET } from '../route'
import { db } from '@/lib/db'
import { fetchChannelFeed } from '@/lib/automation/rss'
import type { RSSFeedResult } from '@/lib/automation/types'

// Mock dependencies
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual('@/lib/db')
  return {
    ...actual,
    db: {
      select: vi.fn(),
    },
  }
})

vi.mock('@/lib/automation/rss', () => ({
  fetchChannelFeed: vi.fn(),
  getFeedUrl: vi.fn((channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`),
}))

const mockDb = vi.mocked(db)
const mockFetchChannelFeed = vi.mocked(fetchChannelFeed)

describe('GET /api/channels/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns all videos from all followed channels', async () => {
    // Mock channels query
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest1',
        name: 'Channel 1',
        thumbnailUrl: null,
        createdAt: new Date('2026-01-01'),
        feedUrl: 'https://example.com/feed1',
        autoFetch: false,
        lastFetchedAt: null,
        fetchIntervalHours: 12,
      },
      {
        id: 2,
        channelId: 'UCtest2',
        name: 'Channel 2',
        thumbnailUrl: null,
        createdAt: new Date('2026-01-02'),
        feedUrl: 'https://example.com/feed2',
        autoFetch: false,
        lastFetchedAt: null,
        fetchIntervalHours: 12,
      },
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)

    // Mock RSS feed results
    const feed1: RSSFeedResult = {
      channelId: 'UCtest1',
      channelName: 'Channel 1',
      videos: [
        {
          youtubeId: 'vid1',
          title: 'Video 1',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-02-01T10:00:00Z'),
          description: 'Description 1',
        },
      ],
      fetchedAt: new Date(),
    }

    const feed2: RSSFeedResult = {
      channelId: 'UCtest2',
      channelName: 'Channel 2',
      videos: [
        {
          youtubeId: 'vid2',
          title: 'Video 2',
          channelId: 'UCtest2',
          channelName: 'Channel 2',
          publishedAt: new Date('2026-02-02T10:00:00Z'),
          description: 'Description 2',
        },
      ],
      fetchedAt: new Date(),
    }

    mockFetchChannelFeed
      .mockResolvedValueOnce(feed1)
      .mockResolvedValueOnce(feed2)

    // Mock videos query (none in bank)
    const mockVideosQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)
    mockDb.select.mockReturnValueOnce(mockVideosQuery as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]?.youtubeId).toBe('vid2') // Newest first
    expect(data[1]?.youtubeId).toBe('vid1')
    expect(data[0]?.inBank).toBe(false)
    expect(data[1]?.inBank).toBe(false)
  })

  it('filters videos by since timestamp', async () => {
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest1',
        name: 'Channel 1',
        thumbnailUrl: null,
        createdAt: new Date('2026-01-01'),
        feedUrl: 'https://example.com/feed1',
        autoFetch: false,
        lastFetchedAt: null,
        fetchIntervalHours: 12,
      },
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)

    const feed: RSSFeedResult = {
      channelId: 'UCtest1',
      channelName: 'Channel 1',
      videos: [
        {
          youtubeId: 'vid1',
          title: 'Old Video',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-01-01T10:00:00Z'),
          description: 'Old',
        },
        {
          youtubeId: 'vid2',
          title: 'New Video',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-02-01T10:00:00Z'),
          description: 'New',
        },
      ],
      fetchedAt: new Date(),
    }

    mockFetchChannelFeed.mockResolvedValue(feed)

    // Mock videos query
    const mockVideosQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)
    mockDb.select.mockReturnValueOnce(mockVideosQuery as never)

    const request = new Request('http://localhost/api/channels/videos?since=2026-01-15T00:00:00.000Z')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0]?.youtubeId).toBe('vid2')
    expect(data[0]?.title).toBe('New Video')
  })

  it('marks videos as inBank when they exist in database', async () => {
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest1',
        name: 'Channel 1',
        thumbnailUrl: null,
        createdAt: new Date('2026-01-01'),
        feedUrl: 'https://example.com/feed1',
        autoFetch: false,
        lastFetchedAt: null,
        fetchIntervalHours: 12,
      },
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)

    const feed: RSSFeedResult = {
      channelId: 'UCtest1',
      channelName: 'Channel 1',
      videos: [
        {
          youtubeId: 'vid1',
          title: 'Video 1',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-02-01T10:00:00Z'),
          description: 'Description',
        },
        {
          youtubeId: 'vid2',
          title: 'Video 2',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-02-02T10:00:00Z'),
          description: 'Description',
        },
      ],
      fetchedAt: new Date(),
    }

    mockFetchChannelFeed.mockResolvedValue(feed)

    // Mock videos query - vid2 is in bank
    const mockVideosQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ youtubeId: 'vid2' }]),
    }
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)
    mockDb.select.mockReturnValueOnce(mockVideosQuery as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]?.youtubeId).toBe('vid2')
    expect(data[0]?.inBank).toBe(true)
    expect(data[1]?.youtubeId).toBe('vid1')
    expect(data[1]?.inBank).toBe(false)
  })

  it('returns empty array when no channels followed', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  it('handles RSS fetch failures gracefully with Promise.allSettled', async () => {
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest1',
        name: 'Channel 1',
        thumbnailUrl: null,
        createdAt: new Date('2026-01-01'),
        feedUrl: 'https://example.com/feed1',
        autoFetch: false,
        lastFetchedAt: null,
        fetchIntervalHours: 12,
      },
      {
        id: 2,
        channelId: 'UCtest2',
        name: 'Channel 2',
        thumbnailUrl: null,
        createdAt: new Date('2026-01-02'),
        feedUrl: 'https://example.com/feed2',
        autoFetch: false,
        lastFetchedAt: null,
        fetchIntervalHours: 12,
      },
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)

    const successFeed: RSSFeedResult = {
      channelId: 'UCtest1',
      channelName: 'Channel 1',
      videos: [
        {
          youtubeId: 'vid1',
          title: 'Video 1',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-02-01T10:00:00Z'),
          description: 'Description',
        },
      ],
      fetchedAt: new Date(),
    }

    mockFetchChannelFeed
      .mockResolvedValueOnce(successFeed)
      .mockRejectedValueOnce(new Error('Feed fetch failed'))

    // Mock videos query
    const mockVideosQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)
    mockDb.select.mockReturnValueOnce(mockVideosQuery as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0]?.youtubeId).toBe('vid1')
  })

  it('returns 400 for invalid since timestamp', async () => {
    const request = new Request('http://localhost/api/channels/videos?since=invalid-date')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('Invalid since timestamp')
  })

  it('returns 500 on database error', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockRejectedValue(new Error('Database error')),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch videos' })
  })

  it('sorts videos chronologically newest first', async () => {
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest1',
        name: 'Channel 1',
        thumbnailUrl: null,
        createdAt: new Date('2026-01-01'),
        feedUrl: 'https://example.com/feed1',
        autoFetch: false,
        lastFetchedAt: null,
        fetchIntervalHours: 12,
      },
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)

    const feed: RSSFeedResult = {
      channelId: 'UCtest1',
      channelName: 'Channel 1',
      videos: [
        {
          youtubeId: 'vid1',
          title: 'Old Video',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-01-01T10:00:00Z'),
          description: 'Old',
        },
        {
          youtubeId: 'vid2',
          title: 'Middle Video',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-01-15T10:00:00Z'),
          description: 'Middle',
        },
        {
          youtubeId: 'vid3',
          title: 'Newest Video',
          channelId: 'UCtest1',
          channelName: 'Channel 1',
          publishedAt: new Date('2026-02-01T10:00:00Z'),
          description: 'Newest',
        },
      ],
      fetchedAt: new Date(),
    }

    mockFetchChannelFeed.mockResolvedValue(feed)

    // Mock videos query
    const mockVideosQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)
    mockDb.select.mockReturnValueOnce(mockVideosQuery as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(3)
    expect(data[0]?.youtubeId).toBe('vid3') // Newest
    expect(data[1]?.youtubeId).toBe('vid2') // Middle
    expect(data[2]?.youtubeId).toBe('vid1') // Oldest
  })
})
