import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database module
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
}

const mockChannels = {
  autoFetch: 'autoFetch',
  id: 'id',
  lastFetchedAt: 'lastFetchedAt',
}

vi.mock('@/lib/db', () => ({
  db: mockDb,
  channels: mockChannels,
}))

// Import after mocking
const { getChannelsForAutoFetch, updateChannelLastFetched, updateChannelAutomation } = await import('../queries')

describe('getChannelsForAutoFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries channels where autoFetch is true', async () => {
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([
      { id: 1, channelId: 'UC123', name: 'Test Channel', autoFetch: true },
    ])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
    })

    const result = await getChannelsForAutoFetch()

    expect(mockDb.select).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
    expect(result).toEqual([
      { id: 1, channelId: 'UC123', name: 'Test Channel', autoFetch: true },
    ])
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getChannelsForAutoFetch(customDb as any)

    expect(customDb.select).toHaveBeenCalledTimes(1)
    expect(mockDb.select).not.toHaveBeenCalled()
  })
})

describe('updateChannelLastFetched', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates lastFetchedAt to current time', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([{ id: 1 }])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
    })

    const result = await updateChannelLastFetched(1)

    expect(mockDb.update).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith({
      lastFetchedAt: expect.any(Date),
    })
    expect(mockWhere).toHaveBeenCalled()
    expect(result).toEqual([{ id: 1 }])
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateChannelLastFetched(1, customDb as any)

    expect(customDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})

describe('updateChannelAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates autoFetch setting', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([
      { id: 1, autoFetch: true },
    ])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    })

    const result = await updateChannelAutomation(1, { autoFetch: true })

    expect(mockDb.update).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith({ autoFetch: true })
    expect(mockWhere).toHaveBeenCalled()
    expect(mockReturning).toHaveBeenCalled()
    expect(result).toEqual([{ id: 1, autoFetch: true }])
  })

  it('updates fetchIntervalHours setting', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([
      { id: 1, fetchIntervalHours: 6 },
    ])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    })

    const result = await updateChannelAutomation(1, { fetchIntervalHours: 6 })

    expect(mockSet).toHaveBeenCalledWith({ fetchIntervalHours: 6 })
    expect(result).toEqual([{ id: 1, fetchIntervalHours: 6 }])
  })

  it('updates feedUrl setting', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([
      { id: 1, feedUrl: 'https://example.com/feed.xml' },
    ])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    })

    const result = await updateChannelAutomation(1, {
      feedUrl: 'https://example.com/feed.xml',
    })

    expect(mockSet).toHaveBeenCalledWith({
      feedUrl: 'https://example.com/feed.xml',
    })
    expect(result).toEqual([
      { id: 1, feedUrl: 'https://example.com/feed.xml' },
    ])
  })

  it('updates multiple settings at once', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([
      { id: 1, autoFetch: true, fetchIntervalHours: 24 },
    ])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    })

    const result = await updateChannelAutomation(1, {
      autoFetch: true,
      fetchIntervalHours: 24,
    })

    expect(mockSet).toHaveBeenCalledWith({
      autoFetch: true,
      fetchIntervalHours: 24,
    })
    expect(result).toEqual([
      { id: 1, autoFetch: true, fetchIntervalHours: 24 },
    ])
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateChannelAutomation(1, { autoFetch: true }, customDb as any)

    expect(customDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})
