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
import { findSimilarChannels } from '@/lib/channels/similarity'

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

vi.mock('@/lib/channels/similarity', () => ({
  findSimilarChannels: vi.fn(),
}))

const mockDb = vi.mocked(db)
const mockFindSimilarChannels = vi.mocked(findSimilarChannels)

describe('GET /api/channels/similar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns similar channels for followed channels', async () => {
    const mockFollowedChannels = [
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

    const mockSimilarChannels = [
      {
        channelName: 'Similar Channel 1',
        similarity: 0.85,
        videoCount: 10,
        sampleTitles: ['Video 1', 'Video 2', 'Video 3'],
      },
      {
        channelName: 'Similar Channel 2',
        similarity: 0.72,
        videoCount: 5,
        sampleTitles: ['Video A', 'Video B'],
      },
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockFollowedChannels),
    } as never)

    mockFindSimilarChannels.mockResolvedValue(mockSimilarChannels)

    const request = new Request('http://localhost:3000/api/channels/similar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toEqual(mockSimilarChannels)
    expect(mockFindSimilarChannels).toHaveBeenCalledWith(
      ['Test Channel 1', 'Test Channel 2'],
      expect.objectContaining({ limit: 10 })
    )
  })

  it('respects limit query parameter', async () => {
    const mockFollowedChannels = [
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
    ]

    const mockSimilarChannels = [
      {
        channelName: 'Similar Channel 1',
        similarity: 0.85,
        videoCount: 10,
        sampleTitles: ['Video 1', 'Video 2', 'Video 3'],
      },
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockFollowedChannels),
    } as never)

    mockFindSimilarChannels.mockResolvedValue(mockSimilarChannels)

    const request = new Request('http://localhost:3000/api/channels/similar?limit=5')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toEqual(mockSimilarChannels)
    expect(mockFindSimilarChannels).toHaveBeenCalledWith(
      ['Test Channel 1'],
      expect.objectContaining({ limit: 5 })
    )
  })

  it('returns 400 for invalid limit query parameter', async () => {
    const request = new Request('http://localhost:3000/api/channels/similar?limit=invalid')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mockFindSimilarChannels).not.toHaveBeenCalled()
  })

  it('returns 400 for negative limit', async () => {
    const request = new Request('http://localhost:3000/api/channels/similar?limit=-5')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns 400 for limit exceeding maximum', async () => {
    const request = new Request('http://localhost:3000/api/channels/similar?limit=101')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('returns empty suggestions when no channels followed', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    } as never)

    const request = new Request('http://localhost:3000/api/channels/similar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toEqual([])
    expect(data.message).toBe('No followed channels to base recommendations on')
    expect(mockFindSimilarChannels).not.toHaveBeenCalled()
  })

  it('returns empty suggestions when no similar channels found', async () => {
    const mockFollowedChannels = [
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
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockFollowedChannels),
    } as never)

    mockFindSimilarChannels.mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/channels/similar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toEqual([])
    expect(data.message).toBe('No similar channels found')
    expect(mockFindSimilarChannels).toHaveBeenCalled()
  })

  it('returns 500 on database error when fetching channels', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockRejectedValue(new Error('Database error')),
    } as never)

    const request = new Request('http://localhost:3000/api/channels/similar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch similar channels' })
  })

  it('returns 500 on error when finding similar channels', async () => {
    const mockFollowedChannels = [
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
    ]

    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue(mockFollowedChannels),
    } as never)

    mockFindSimilarChannels.mockRejectedValue(new Error('Similarity computation failed'))

    const request = new Request('http://localhost:3000/api/channels/similar')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch similar channels' })
  })

  it('handles edge case with zero limit', async () => {
    const request = new Request('http://localhost:3000/api/channels/similar?limit=0')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })
})
