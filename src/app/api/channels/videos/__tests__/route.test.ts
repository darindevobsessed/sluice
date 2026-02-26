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

  it('returns all videos from discovery_videos table with bankVideoId and focusAreas fields', async () => {
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

    // Second call: select youtubeId + id from videos (inBank check)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as never)

    // No third call — bankVideoIds is empty, focus area query is skipped

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]?.youtubeId).toBe('vid2') // Newest first (ordered by DB)
    expect(data[1]?.youtubeId).toBe('vid1')
    expect(data[0]?.inBank).toBe(false)
    expect(data[1]?.inBank).toBe(false)
    // New fields
    expect(data[0]?.bankVideoId).toBeNull()
    expect(data[1]?.bankVideoId).toBeNull()
    expect(data[0]?.focusAreas).toEqual([])
    expect(data[1]?.focusAreas).toEqual([])
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

    // First call: select from discoveryVideos
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    // Second call: select youtubeId + id — vid2 is in bank with DB id 42
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ youtubeId: 'vid2', id: 42 }]),
    } as never)

    // Third call: focus area query — no focus areas for video 42
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
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

  it('includes bankVideoId for in-bank videos', async () => {
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid1',
        title: 'Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-01T10:00:00Z'),
        description: 'Desc',
        cachedAt: new Date(),
      },
    ]

    // First call: discoveryVideos
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    // Second call: videos in bank — vid1 has DB id 7
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ youtubeId: 'vid1', id: 7 }]),
    } as never)

    // Third call: focus areas — none
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0]?.bankVideoId).toBe(7)
    expect(data[0]?.inBank).toBe(true)
  })

  it('includes focusAreas for in-bank videos that have assignments', async () => {
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid1',
        title: 'Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-01T10:00:00Z'),
        description: 'Desc',
        cachedAt: new Date(),
      },
    ]

    // First call: discoveryVideos
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    // Second call: videos in bank — vid1 is bank video id 10
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ youtubeId: 'vid1', id: 10 }]),
    } as never)

    // Third call: focus area assignments for video 10
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { videoId: 10, id: 1, name: 'Engineering', color: '#3b82f6' },
        { videoId: 10, id: 2, name: 'Architecture', color: '#10b981' },
      ]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0]?.focusAreas).toHaveLength(2)
    expect(data[0]?.focusAreas[0]).toEqual({ id: 1, name: 'Engineering', color: '#3b82f6' })
    expect(data[0]?.focusAreas[1]).toEqual({ id: 2, name: 'Architecture', color: '#10b981' })
  })

  it('returns empty focusAreas for out-of-bank videos', async () => {
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid1',
        title: 'Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-01T10:00:00Z'),
        description: 'Desc',
        cachedAt: new Date(),
      },
    ]

    // First call: discoveryVideos
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    // Second call: not in bank
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as never)

    // No third call — no bank video ids

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0]?.focusAreas).toEqual([])
    expect(data[0]?.bankVideoId).toBeNull()
  })

  it('skips focus area query when no videos are in bank', async () => {
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid1',
        title: 'Video 1',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-01T10:00:00Z'),
        description: 'Desc',
        cachedAt: new Date(),
      },
    ]

    // First call: discoveryVideos
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    // Second call: none in bank
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)

    expect(response.status).toBe(200)
    // db.select should only have been called twice (no focus area query)
    expect(mockDb.select).toHaveBeenCalledTimes(2)
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

  it('handles multiple in-bank videos with different focus areas', async () => {
    const mockDiscoveryVideos = [
      {
        id: 1,
        youtubeId: 'vid-a',
        title: 'Video A',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-02T10:00:00Z'),
        description: 'Desc A',
        cachedAt: new Date(),
      },
      {
        id: 2,
        youtubeId: 'vid-b',
        title: 'Video B',
        channelId: 'UCtest1',
        channelName: 'Channel 1',
        publishedAt: new Date('2026-02-01T10:00:00Z'),
        description: 'Desc B',
        cachedAt: new Date(),
      },
    ]

    // First call: discoveryVideos
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockDiscoveryVideos),
    } as never)

    // Second call: both videos in bank
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { youtubeId: 'vid-a', id: 20 },
        { youtubeId: 'vid-b', id: 21 },
      ]),
    } as never)

    // Third call: focus area assignments — vid-a has one, vid-b has none
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { videoId: 20, id: 5, name: 'AI', color: '#8b5cf6' },
      ]),
    } as never)

    const request = new Request('http://localhost/api/channels/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0]?.youtubeId).toBe('vid-a')
    expect(data[0]?.bankVideoId).toBe(20)
    expect(data[0]?.focusAreas).toEqual([{ id: 5, name: 'AI', color: '#8b5cf6' }])
    expect(data[1]?.youtubeId).toBe('vid-b')
    expect(data[1]?.bankVideoId).toBe(21)
    expect(data[1]?.focusAreas).toEqual([])
  })
})
