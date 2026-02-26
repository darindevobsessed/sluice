import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GET } from '../route'
import { db } from '@/lib/db'

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

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

const mockDb = vi.mocked(db)

describe('GET /api/personas/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns channels with 5+ videos where no persona exists', async () => {
    // Mock existing personas
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([
        { channelName: 'Existing Persona Channel' },
      ]),
    } as never)

    // Mock video counts by channel
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue([
          { channel: 'Test Creator 1', videoCount: 10 },
          { channel: 'Test Creator 2', videoCount: 7 },
          { channel: 'Existing Persona Channel', videoCount: 8 },
          { channel: 'Small Channel', videoCount: 3 },
        ]),
      }),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toHaveLength(2)
    expect(data.suggestions).toEqual([
      { channelName: 'Test Creator 1', videoCount: 10 },
      { channelName: 'Test Creator 2', videoCount: 7 },
    ])
  })

  it('filters out channels with fewer than 5 videos', async () => {
    // Mock no existing personas
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([]),
    } as never)

    // Mock video counts
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue([
          { channel: 'Big Channel', videoCount: 10 },
          { channel: 'Medium Channel', videoCount: 4 },
          { channel: 'Small Channel', videoCount: 2 },
        ]),
      }),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toHaveLength(1)
    expect(data.suggestions[0]).toEqual({ channelName: 'Big Channel', videoCount: 10 })
  })

  it('returns empty array when no channels meet criteria', async () => {
    // Mock no existing personas
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([]),
    } as never)

    // Mock video counts (all below threshold of 5)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue([
          { channel: 'Channel 1', videoCount: 2 },
          { channel: 'Channel 2', videoCount: 4 },
        ]),
      }),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toEqual([])
  })

  it('returns empty array when all eligible channels already have personas', async () => {
    // Mock existing personas
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([
        { channelName: 'Channel 1' },
        { channelName: 'Channel 2' },
      ]),
    } as never)

    // Mock video counts
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue([
          { channel: 'Channel 1', videoCount: 10 },
          { channel: 'Channel 2', videoCount: 8 },
        ]),
      }),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toEqual([])
  })

  it('returns 500 on database error', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockRejectedValue(new Error('Database error')),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch persona suggestions' })
  })

  it('sorts suggestions by video count (descending)', async () => {
    // Mock no existing personas
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockResolvedValue([]),
    } as never)

    // Mock video counts (unsorted)
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue([
          { channel: 'Channel A', videoCount: 7 },
          { channel: 'Channel B', videoCount: 10 },
          { channel: 'Channel C', videoCount: 8 },
        ]),
      }),
    } as never)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.suggestions).toHaveLength(3)
    expect(data.suggestions[0]?.channelName).toBe('Channel B')
    expect(data.suggestions[0]?.videoCount).toBe(10)
    expect(data.suggestions[1]?.channelName).toBe('Channel C')
    expect(data.suggestions[2]?.channelName).toBe('Channel A')
  })
})
