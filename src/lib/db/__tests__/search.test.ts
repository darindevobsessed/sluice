import { describe, it, expect, beforeEach, vi } from 'vitest'
import { searchVideos, getVideoStats, getDistinctChannels } from '../search'

const createMockDb = () => {
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockReturnThis(),
  }
  return {
    select: vi.fn(() => mockSelectChain),
    _selectChain: mockSelectChain,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockDb = ReturnType<typeof createMockDb>

describe('searchVideos', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('returns empty array when no videos exist', async () => {
    db._selectChain.orderBy.mockResolvedValue([])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await searchVideos('test query', db as any)
    expect(results).toEqual([])
  })

  it('returns all videos when query is empty', async () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 60000)

    db._selectChain.orderBy.mockResolvedValue([
      {
        id: 2,
        youtubeId: 'ds-vid2',
        sourceType: 'youtube',
        title: 'Second Video',
        channel: 'Channel B',
        thumbnail: null,
        duration: 900,
        description: null,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      },
      {
        id: 1,
        youtubeId: 'ds-vid1',
        sourceType: 'youtube',
        title: 'First Video',
        channel: 'Channel A',
        thumbnail: null,
        duration: 600,
        description: null,
        createdAt: earlier,
        updatedAt: earlier,
        publishedAt: null,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await searchVideos('', db as any)
    expect(results).toHaveLength(2)
    expect(results[0]?.title).toBe('Second Video')
    expect(results[1]?.title).toBe('First Video')
  })

  it('finds videos by title match using ILIKE', async () => {
    db._selectChain.orderBy.mockResolvedValue([
      {
        id: 1,
        youtubeId: 'ds-vid1',
        sourceType: 'youtube',
        title: 'TypeScript Deep Dive',
        channel: 'Dev Channel',
        thumbnail: null,
        duration: 600,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: null,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await searchVideos('typescript', db as any)
    expect(results).toHaveLength(1)
    expect(results[0]?.title).toBe('TypeScript Deep Dive')
    // Verify that where was called for non-empty query
    expect(db._selectChain.where).toHaveBeenCalled()
  })

  it('finds videos by channel name', async () => {
    db._selectChain.orderBy.mockResolvedValue([
      {
        id: 1,
        youtubeId: 'ds-vid1',
        sourceType: 'youtube',
        title: 'Video One',
        channel: 'Fireship',
        thumbnail: null,
        duration: 600,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: null,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await searchVideos('fireship', db as any)
    expect(results).toHaveLength(1)
    expect(results[0]?.channel).toBe('Fireship')
  })

  it('is case insensitive', async () => {
    const video = {
      id: 1,
      youtubeId: 'ds-vid1',
      sourceType: 'youtube',
      title: 'JavaScript Performance',
      channel: 'Dev Channel',
      thumbnail: null,
      duration: 600,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
    }

    db._selectChain.orderBy.mockResolvedValue([video])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upperResults = await searchVideos('JAVASCRIPT', db as any)
    expect(upperResults).toHaveLength(1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mixedResults = await searchVideos('JaVaScRiPt', db as any)
    expect(mixedResults).toHaveLength(1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lowerResults = await searchVideos('javascript', db as any)
    expect(lowerResults).toHaveLength(1)

    // searchVideos should call where for each non-empty query
    expect(db._selectChain.where).toHaveBeenCalledTimes(3)
  })

  it('excludes transcript from returned results', async () => {
    db._selectChain.orderBy.mockResolvedValue([
      {
        id: 1,
        youtubeId: 'ds-vid1',
        sourceType: 'youtube',
        title: 'Video With Transcript',
        channel: 'Channel A',
        thumbnail: null,
        duration: 600,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: null,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await searchVideos('', db as any)
    expect(results).toHaveLength(1)
    expect(results[0]?.title).toBe('Video With Transcript')
    // Verify transcript is NOT in the returned object
    expect('transcript' in results[0]!).toBe(false)
  })
})

describe('getVideoStats', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('returns zeros when no videos exist', async () => {
    // getVideoStats uses select().from() which resolves via the chain
    // The chain ends at from() since there's no where/orderBy/groupBy
    db._selectChain.from.mockResolvedValue([
      { count: 0, totalDuration: 0, channels: 0 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = await getVideoStats(db as any)
    expect(stats).toEqual({
      count: 0,
      totalHours: 0,
      channels: 0,
    })
  })

  it('counts videos correctly', async () => {
    db._selectChain.from.mockResolvedValue([
      { count: 3, totalDuration: 2700, channels: 2 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = await getVideoStats(db as any)
    expect(stats.count).toBe(3)
  })

  it('calculates total hours correctly', async () => {
    db._selectChain.from.mockResolvedValue([
      { count: 2, totalDuration: 5400, channels: 1 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = await getVideoStats(db as any)
    expect(stats.totalHours).toBe(1.5)
  })

  it('counts unique channels', async () => {
    db._selectChain.from.mockResolvedValue([
      { count: 3, totalDuration: 2700, channels: 2 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = await getVideoStats(db as any)
    expect(stats.channels).toBe(2)
  })
})

describe('getDistinctChannels', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('returns empty array when no videos exist', async () => {
    db._selectChain.orderBy.mockResolvedValue([])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creators = await getDistinctChannels(db as any)
    expect(creators).toEqual([])
  })

  it('returns single channel with correct video count', async () => {
    db._selectChain.orderBy.mockResolvedValue([
      { channel: 'Solo Creator', videoCount: 1 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creators = await getDistinctChannels(db as any)
    expect(creators).toEqual([
      { channel: 'Solo Creator', videoCount: 1 },
    ])
  })

  it('returns multiple channels with correct video counts', async () => {
    db._selectChain.orderBy.mockResolvedValue([
      { channel: 'Channel A', videoCount: 2 },
      { channel: 'Channel B', videoCount: 1 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creators = await getDistinctChannels(db as any)
    expect(creators).toHaveLength(2)
    expect(creators).toContainEqual({ channel: 'Channel A', videoCount: 2 })
    expect(creators).toContainEqual({ channel: 'Channel B', videoCount: 1 })
  })

  it('sorts channels by video count descending', async () => {
    db._selectChain.orderBy.mockResolvedValue([
      { channel: 'Big Channel', videoCount: 3 },
      { channel: 'Medium Channel', videoCount: 2 },
      { channel: 'Small Channel', videoCount: 1 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creators = await getDistinctChannels(db as any)
    expect(creators).toEqual([
      { channel: 'Big Channel', videoCount: 3 },
      { channel: 'Medium Channel', videoCount: 2 },
      { channel: 'Small Channel', videoCount: 1 },
    ])
  })

  it('handles channels with identical video counts', async () => {
    db._selectChain.orderBy.mockResolvedValue([
      { channel: 'Channel A', videoCount: 1 },
      { channel: 'Channel B', videoCount: 1 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creators = await getDistinctChannels(db as any)
    expect(creators).toHaveLength(2)
    expect(creators.every((c: { videoCount: number }) => c.videoCount === 1)).toBe(true)
    const channels = creators.map((c: { channel: string }) => c.channel)
    expect(channels).toContain('Channel A')
    expect(channels).toContain('Channel B')
  })

  it('filters out null channels', async () => {
    db._selectChain.orderBy.mockResolvedValue([
      { channel: 'Valid Channel', videoCount: 2 },
      { channel: null, videoCount: 1 },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creators = await getDistinctChannels(db as any)
    expect(creators).toHaveLength(1)
    expect(creators[0]?.channel).toBe('Valid Channel')
  })
})
