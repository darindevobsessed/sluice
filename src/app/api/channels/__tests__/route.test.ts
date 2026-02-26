import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

import { GET, POST } from '../route'
import { db } from '@/lib/db'
import { fetchChannelFeed } from '@/lib/automation/rss'
import { parseChannelUrl } from '@/lib/youtube/channel-parser'

// Mock dependencies
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual('@/lib/db')
  return {
    ...actual,
    db: {
      select: vi.fn(),
      insert: vi.fn(),
    },
  }
})

vi.mock('@/lib/automation/rss', () => ({
  fetchChannelFeed: vi.fn(),
  getFeedUrl: vi.fn((channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`),
}))

vi.mock('@/lib/youtube/channel-parser', () => ({
  parseChannelUrl: vi.fn(),
}))

const mockDb = vi.mocked(db)
const mockFetchChannelFeed = vi.mocked(fetchChannelFeed)
const mockParseChannelUrl = vi.mocked(parseChannelUrl)

describe('GET /api/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns all followed channels', async () => {
    const mockChannels = [
      {
        id: 1,
        channelId: 'UCtest123',
        name: 'Test Channel 1',
        thumbnailUrl: 'https://example.com/thumb1.jpg',
        createdAt: new Date('2026-01-01'),
        feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest123',
        autoFetch: true,
        lastFetchedAt: new Date('2026-01-15'),
        fetchIntervalHours: 12,
      },
      {
        id: 2,
        channelId: 'UCtest456',
        name: 'Test Channel 2',
        thumbnailUrl: null,
        createdAt: new Date('2026-01-02'),
        feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtest456',
        autoFetch: false,
        lastFetchedAt: null,
        fetchIntervalHours: 12,
      },
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockChannels),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(2)
    expect(data[0]?.channelId).toBe('UCtest123')
    expect(data[0]?.name).toBe('Test Channel 1')
    expect(data[1]?.channelId).toBe('UCtest456')
    expect(data[1]?.name).toBe('Test Channel 2')
  })

  it('returns empty array when no channels followed', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual([])
  })

  it('returns 500 on database error', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockRejectedValue(new Error('Database error')),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch channels' })
  })
})

describe('POST /api/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a new channel from valid URL', async () => {
    const mockRequest = new Request('http://localhost/api/channels', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/@testhandle' }),
      headers: { 'Content-Type': 'application/json' },
    })

    mockParseChannelUrl.mockResolvedValue('UCtest123')
    mockFetchChannelFeed.mockResolvedValue({
      channelId: 'UCtest123',
      channelName: 'Test Channel',
      videos: [],
      fetchedAt: new Date(),
    })

    const mockInserted = {
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

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockInserted]),
      }),
    } as never)

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.channel).toBeDefined()
    expect(data.channel.channelId).toBe('UCtest123')
    expect(data.channel.name).toBe('Test Channel')
    expect(mockParseChannelUrl).toHaveBeenCalledWith('https://www.youtube.com/@testhandle')
    expect(mockFetchChannelFeed).toHaveBeenCalledWith('UCtest123')
  })

  it('returns 400 for invalid request body', async () => {
    const mockRequest = new Request('http://localhost/api/channels', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns 400 for missing url field', async () => {
    const mockRequest = new Request('http://localhost/api/channels', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns 400 for empty url string', async () => {
    const mockRequest = new Request('http://localhost/api/channels', {
      method: 'POST',
      body: JSON.stringify({ url: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns 400 for invalid URL format', async () => {
    const mockRequest = new Request('http://localhost/api/channels', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/@testhandle' }),
      headers: { 'Content-Type': 'application/json' },
    })

    mockParseChannelUrl.mockRejectedValue(new Error('Invalid channel URL'))

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Invalid channel URL' })
  })

  it('returns 400 when RSS feed fetch fails', async () => {
    const mockRequest = new Request('http://localhost/api/channels', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/@testhandle' }),
      headers: { 'Content-Type': 'application/json' },
    })

    mockParseChannelUrl.mockResolvedValue('UCtest123')
    mockFetchChannelFeed.mockRejectedValue(new Error('RSS feed fetch failed'))

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Failed to validate channel: RSS feed fetch failed' })
  })

  it('returns 409 when channel already exists', async () => {
    const mockRequest = new Request('http://localhost/api/channels', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/@testhandle' }),
      headers: { 'Content-Type': 'application/json' },
    })

    mockParseChannelUrl.mockResolvedValue('UCtest123')
    mockFetchChannelFeed.mockResolvedValue({
      channelId: 'UCtest123',
      channelName: 'Test Channel',
      videos: [],
      fetchedAt: new Date(),
    })

    const dbError = new Error('duplicate key value violates unique constraint')
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(dbError),
      }),
    } as never)

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data).toEqual({ error: 'Channel already followed' })
  })

  it('returns 500 on unexpected database error', async () => {
    const mockRequest = new Request('http://localhost/api/channels', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/@testhandle' }),
      headers: { 'Content-Type': 'application/json' },
    })

    mockParseChannelUrl.mockResolvedValue('UCtest123')
    mockFetchChannelFeed.mockResolvedValue({
      channelId: 'UCtest123',
      channelName: 'Test Channel',
      videos: [],
      fetchedAt: new Date(),
    })

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      }),
    } as never)

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to follow channel' })
  })
})
