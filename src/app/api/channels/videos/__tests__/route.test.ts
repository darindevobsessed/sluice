import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GET } from '../route'
import { db } from '@/lib/db'

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

// Note: fetchChannelFeed is no longer used by the GET route
// The GET route now reads from the discoveryVideos DB table

const mockDb = vi.mocked(db)

describe('GET /api/channels/videos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns all videos from discovery_videos table', async () => {
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid2',
        title: 'Video 2',
        channelId: 'UCtest2',
        channelName: 'Channel 2',
        publishedAt: new Date('2026-02-02T10:00:00Z'),
        description: 'Description 2',
        cachedAt: new Date(),
      },
      {
        id: 2,
        youtubeId: 'vid1',
        title: 'Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-01T10:00:00Z'),
        description: 'Description 1',
        cachedAt: new Date(),
      },
    ]

    // First call: select from discoveryVideos (ordered by publishedAt desc)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    // Second call: select youtubeId from videos (inBank check)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]?.youtubeId).toBe('vid2') // Newest first (ordered by DB)
    expect(data[1]?.youtubeId).toBe('vid1')
    expect(data[0]?.inBank).toBe(false)
    expect(data[1]?.inBank).toBe(false)
  })

  it('marks videos as inBank when they exist in videos table', async () => {
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid2',
        title: 'Video 2',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-02T10:00:00Z'),
        description: 'Description',
        cachedAt: new Date(),
      },
      {
        id: 2,
        youtubeId: 'vid1',
        title: 'Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-01T10:00:00Z'),
        description: 'Description',
        cachedAt: new Date(),
      },
    ]

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    // vid2 is in bank
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ youtubeId: 'vid2' }]),
    } as never)

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

  it('returns empty array when discovery_videos table is empty', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  it('returns 500 on database error', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch videos' })
  })

  it('returns ISO string for publishedAt', async () => {
    const publishedAt = new Date('2026-02-01T10:00:00Z')
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid1',
        title: 'Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt,
        description: 'Desc',
        cachedAt: new Date(),
      },
    ]

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0]?.publishedAt).toBe(publishedAt.toISOString())
  })

  it('handles null publishedAt gracefully', async () => {
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid1',
        title: 'Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: null,
        description: 'Desc',
        cachedAt: new Date(),
      },
    ]

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0]?.publishedAt).toBeNull()
  })
})
