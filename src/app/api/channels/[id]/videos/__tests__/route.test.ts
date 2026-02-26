import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

import { GET } from '../route'
import { db } from '@/lib/db'
import { fetchChannelFeed } from '@/lib/automation/rss'

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
}))

const mockDb = vi.mocked(db)
const mockFetchChannelFeed = vi.mocked(fetchChannelFeed)

describe('GET /api/channels/[id]/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns videos with inBank flag when channel exists', async () => {
    const mockChannel = {
      id: 1,
      channelId: 'UCtest123',
      name: 'Test Channel',
      thumbnailUrl: null,
      createdAt: new Date(),
      feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest123',
      autoFetch: false,
      lastFetchedAt: null,
      fetchIntervalHours: 12,
    }

    const mockRSSVideos = [
      {
        youtubeId: 'video1',
        title: 'Video 1',
        channelId: 'UCtest123',
        channelName: 'Test Channel',
        publishedAt: new Date('2026-01-15'),
        description: 'Description 1',
      },
      {
        youtubeId: 'video2',
        title: 'Video 2',
        channelId: 'UCtest123',
        channelName: 'Test Channel',
        publishedAt: new Date('2026-01-14'),
        description: 'Description 2',
      },
      {
        youtubeId: 'video3',
        title: 'Video 3',
        channelId: 'UCtest123',
        channelName: 'Test Channel',
        publishedAt: new Date('2026-01-13'),
        description: 'Description 3',
      },
    ]

    const mockInBankVideos = [
      { youtubeId: 'video1' },
      { youtubeId: 'video3' },
    ]

    // Mock channel query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockChannel]),
        }),
      }),
    } as never)

    // Mock RSS feed fetch
    mockFetchChannelFeed.mockResolvedValue({
      channelId: 'UCtest123',
      channelName: 'Test Channel',
      videos: mockRSSVideos,
      fetchedAt: new Date(),
    })

    // Mock videos query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue(mockInBankVideos),
    } as never)

    const response = await GET(
      new Request('http://localhost/api/channels/1/videos'),
      { params: Promise.resolve({ id: '1' }) }
    )

    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(3)
    expect(data[0]?.youtubeId).toBe('video1')
    expect(data[0]?.inBank).toBe(true)
    expect(data[1]?.youtubeId).toBe('video2')
    expect(data[1]?.inBank).toBe(false)
    expect(data[2]?.youtubeId).toBe('video3')
    expect(data[2]?.inBank).toBe(true)
  })

  it('returns 404 when channel not found', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    const response = await GET(
      new Request('http://localhost/api/channels/999/videos'),
      { params: Promise.resolve({ id: '999' }) }
    )

    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({ error: 'Channel not found' })
  })

  it('returns 400 for invalid channel ID format', async () => {
    const response = await GET(
      new Request('http://localhost/api/channels/invalid/videos'),
      { params: Promise.resolve({ id: 'invalid' }) }
    )

    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns 400 for negative channel ID', async () => {
    const response = await GET(
      new Request('http://localhost/api/channels/-1/videos'),
      { params: Promise.resolve({ id: '-1' }) }
    )

    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns 400 when RSS feed fetch fails', async () => {
    const mockChannel = {
      id: 1,
      channelId: 'UCtest123',
      name: 'Test Channel',
      thumbnailUrl: null,
      createdAt: new Date(),
      feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest123',
      autoFetch: false,
      lastFetchedAt: null,
      fetchIntervalHours: 12,
    }

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockChannel]),
        }),
      }),
    } as never)

    mockFetchChannelFeed.mockRejectedValue(new Error('RSS fetch failed'))

    const response = await GET(
      new Request('http://localhost/api/channels/1/videos'),
      { params: Promise.resolve({ id: '1' }) }
    )

    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Failed to fetch channel videos: RSS fetch failed' })
  })

  it('returns 500 on database error', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      }),
    } as never)

    const response = await GET(
      new Request('http://localhost/api/channels/1/videos'),
      { params: Promise.resolve({ id: '1' }) }
    )

    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch channel videos' })
  })

  it('returns empty array when channel has no videos', async () => {
    const mockChannel = {
      id: 1,
      channelId: 'UCtest123',
      name: 'Test Channel',
      thumbnailUrl: null,
      createdAt: new Date(),
      feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest123',
      autoFetch: false,
      lastFetchedAt: null,
      fetchIntervalHours: 12,
    }

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockChannel]),
        }),
      }),
    } as never)

    mockFetchChannelFeed.mockResolvedValue({
      channelId: 'UCtest123',
      channelName: 'Test Channel',
      videos: [],
      fetchedAt: new Date(),
    })

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([]),
    } as never)

    const response = await GET(
      new Request('http://localhost/api/channels/1/videos'),
      { params: Promise.resolve({ id: '1' }) }
    )

    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })
})
