import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

// Mock database and query modules
const mockDb = {
  select: vi.fn(),
}

const mockChannels = {
  id: 'id',
}

const mockUpdateChannelAutomation = vi.fn()

vi.mock('@/lib/db', () => ({
  db: mockDb,
  channels: mockChannels,
}))

vi.mock('@/lib/automation/queries', () => ({
  updateChannelAutomation: mockUpdateChannelAutomation,
}))

// Import after mocking
const { GET, PATCH } = await import('../route')

describe('GET /api/channels/[id]/automation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns automation settings for existing channel', async () => {
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([
      {
        id: 1,
        channelId: 'UC123',
        name: 'Test Channel',
        feedUrl: 'https://example.com/feed.xml',
        autoFetch: true,
        fetchIntervalHours: 12,
        lastFetchedAt: new Date('2024-01-01T00:00:00Z'),
      },
    ])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
    })

    const params = Promise.resolve({ id: '1' })
    const request = new Request('http://localhost/api/channels/1/automation')
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      feedUrl: 'https://example.com/feed.xml',
      autoFetch: true,
      fetchIntervalHours: 12,
    })
    expect(data.lastFetchedAt).toBeDefined()
  })

  it('returns 404 when channel not found', async () => {
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
    })

    const params = Promise.resolve({ id: '999' })
    const request = new Request('http://localhost/api/channels/999/automation')
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Channel not found')
  })

  it('returns 400 for invalid channel ID', async () => {
    const params = Promise.resolve({ id: 'invalid' })
    const request = new Request('http://localhost/api/channels/invalid/automation')
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 500 on database error', async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error('Database connection failed')
    })

    const params = Promise.resolve({ id: '1' })
    const request = new Request('http://localhost/api/channels/1/automation')
    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBeDefined()
  })
})

describe('PATCH /api/channels/[id]/automation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates automation settings successfully', async () => {
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([
      { id: 1, channelId: 'UC123', name: 'Test Channel' },
    ])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
    })

    mockUpdateChannelAutomation.mockResolvedValue([
      {
        id: 1,
        channelId: 'UC123',
        name: 'Test Channel',
        autoFetch: true,
        fetchIntervalHours: 24,
      },
    ])

    const params = Promise.resolve({ id: '1' })
    const request = new Request('http://localhost/api/channels/1/automation', {
      method: 'PATCH',
      body: JSON.stringify({
        autoFetch: true,
        fetchIntervalHours: 24,
      }),
    })

    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channel).toBeDefined()
    expect(data.channel.autoFetch).toBe(true)
    expect(data.channel.fetchIntervalHours).toBe(24)
    expect(mockUpdateChannelAutomation).toHaveBeenCalledWith(1, {
      autoFetch: true,
      fetchIntervalHours: 24,
    })
  })

  it('returns 400 for invalid request body', async () => {
    const params = Promise.resolve({ id: '1' })
    const request = new Request('http://localhost/api/channels/1/automation', {
      method: 'PATCH',
      body: JSON.stringify({
        autoFetch: 'not-a-boolean',
      }),
    })

    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 400 for invalid channel ID', async () => {
    const params = Promise.resolve({ id: 'invalid' })
    const request = new Request('http://localhost/api/channels/invalid/automation', {
      method: 'PATCH',
      body: JSON.stringify({ autoFetch: true }),
    })

    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 404 when channel not found', async () => {
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
    })

    const params = Promise.resolve({ id: '999' })
    const request = new Request('http://localhost/api/channels/999/automation', {
      method: 'PATCH',
      body: JSON.stringify({ autoFetch: true }),
    })

    const response = await PATCH(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Channel not found')
  })

  it('updates only feedUrl', async () => {
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([
      { id: 1, channelId: 'UC123', name: 'Test Channel' },
    ])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
    })

    mockUpdateChannelAutomation.mockResolvedValue([
      {
        id: 1,
        feedUrl: 'https://new-feed.com/rss',
      },
    ])

    const params = Promise.resolve({ id: '1' })
    const request = new Request('http://localhost/api/channels/1/automation', {
      method: 'PATCH',
      body: JSON.stringify({
        feedUrl: 'https://new-feed.com/rss',
      }),
    })

    const response = await PATCH(request, { params })
    await response.json()

    expect(response.status).toBe(200)
    expect(mockUpdateChannelAutomation).toHaveBeenCalledWith(1, {
      feedUrl: 'https://new-feed.com/rss',
    })
  })

  it('returns 500 on database error', async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error('Database connection failed')
    })

    const params = Promise.resolve({ id: '1' })
    const request = new Request('http://localhost/api/channels/1/automation', {
      method: 'PATCH',
      body: JSON.stringify({ autoFetch: true }),
    })

    const response = await PATCH(request, { params })

    expect(response.status).toBe(500)
  })
})
