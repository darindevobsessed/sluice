import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findNewVideos, createVideoFromRSS } from '../delta'
import type { RSSVideo } from '../types'

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

// Type for mock database that matches Drizzle's query builder interface
type MockDb = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
}

describe('findNewVideos', () => {
  const mockDb: MockDb = {
    select: vi.fn(),
    insert: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only videos NOT in database', async () => {
    const rssVideos: RSSVideo[] = [
      {
        youtubeId: 'video1',
        title: 'Video 1',
        channelId: 'channel1',
        channelName: 'Channel 1',
        publishedAt: new Date('2024-01-01'),
        description: 'Description 1',
      },
      {
        youtubeId: 'video2',
        title: 'Video 2',
        channelId: 'channel1',
        channelName: 'Channel 1',
        publishedAt: new Date('2024-01-02'),
        description: 'Description 2',
      },
      {
        youtubeId: 'video3',
        title: 'Video 3',
        channelId: 'channel1',
        channelName: 'Channel 1',
        publishedAt: new Date('2024-01-03'),
        description: 'Description 3',
      },
    ]

    // Mock database returning video1 and video2 as existing
    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { youtubeId: 'video1' },
        { youtubeId: 'video2' },
      ]),
    })

    const newVideos = await findNewVideos(rssVideos, mockDb as unknown as typeof import('@/lib/db').db)

    expect(newVideos).toHaveLength(1)
    expect(newVideos[0]?.youtubeId).toBe('video3')
  })

  it('returns all videos when database is empty', async () => {
    const rssVideos: RSSVideo[] = [
      {
        youtubeId: 'video1',
        title: 'Video 1',
        channelId: 'channel1',
        channelName: 'Channel 1',
        publishedAt: new Date('2024-01-01'),
        description: 'Description 1',
      },
      {
        youtubeId: 'video2',
        title: 'Video 2',
        channelId: 'channel1',
        channelName: 'Channel 1',
        publishedAt: new Date('2024-01-02'),
        description: 'Description 2',
      },
    ]

    // Mock database returning no existing videos
    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue([]),
    })

    const newVideos = await findNewVideos(rssVideos, mockDb as unknown as typeof import('@/lib/db').db)

    expect(newVideos).toHaveLength(2)
    expect(newVideos.map((v: RSSVideo) => v.youtubeId)).toEqual(['video1', 'video2'])
  })

  it('returns empty array when all videos exist', async () => {
    const rssVideos: RSSVideo[] = [
      {
        youtubeId: 'video1',
        title: 'Video 1',
        channelId: 'channel1',
        channelName: 'Channel 1',
        publishedAt: new Date('2024-01-01'),
        description: 'Description 1',
      },
    ]

    // Mock database returning all videos as existing
    mockDb.select.mockReturnValue({
      from: vi.fn().mockResolvedValue([
        { youtubeId: 'video1' },
      ]),
    })

    const newVideos = await findNewVideos(rssVideos, mockDb as unknown as typeof import('@/lib/db').db)

    expect(newVideos).toHaveLength(0)
  })

  it('returns empty array for empty input', async () => {
    const newVideos = await findNewVideos([], mockDb as unknown as typeof import('@/lib/db').db)
    expect(newVideos).toHaveLength(0)
  })
})

describe('createVideoFromRSS', () => {
  const mockDb: MockDb = {
    select: vi.fn(),
    insert: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates video record and returns ID', async () => {
    const rssVideo: RSSVideo = {
      youtubeId: 'video1',
      title: 'Test Video',
      channelId: 'channel1',
      channelName: 'Test Channel',
      publishedAt: new Date('2024-01-01'),
      description: 'Test description',
    }

    // Mock successful insertion
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
      }),
    })

    const videoId = await createVideoFromRSS(rssVideo, mockDb as unknown as typeof import('@/lib/db').db)

    expect(videoId).toBe(42)
  })

  it('maps RSS fields correctly', async () => {
    const rssVideo: RSSVideo = {
      youtubeId: 'abc123',
      title: 'My Video Title',
      channelId: 'channelXYZ',
      channelName: 'My Channel',
      publishedAt: new Date('2024-02-15'),
      description: 'Video description',
    }

    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 99 }]),
    })

    mockDb.insert.mockReturnValue({
      values: valuesMock,
    })

    await createVideoFromRSS(rssVideo, mockDb as unknown as typeof import('@/lib/db').db)

    // Verify correct fields were passed to insert
    expect(valuesMock).toHaveBeenCalledWith({
      youtubeId: 'abc123',
      title: 'My Video Title',
      channel: 'My Channel',
      publishedAt: new Date('2024-02-15'),
    })
  })

  it('throws error when insertion fails', async () => {
    const rssVideo: RSSVideo = {
      youtubeId: 'video1',
      title: 'Test Video',
      channelId: 'channel1',
      channelName: 'Test Channel',
      publishedAt: new Date('2024-01-01'),
      description: 'Test description',
    }

    // Mock failed insertion (returns empty array)
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    })

    await expect(createVideoFromRSS(rssVideo, mockDb as unknown as typeof import('@/lib/db').db)).rejects.toThrow(
      'Failed to create video from RSS'
    )
  })
})
