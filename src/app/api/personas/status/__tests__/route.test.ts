import { describe, it, expect, beforeEach, vi } from 'vitest'

// Type for channel status response
type ChannelStatus = {
  channelName: string | null
  transcriptCount: number
  personaId: number | null
  personaCreatedAt: Date | null
}

// Mock db query results
let mockQueryResults: ChannelStatus[] = []
let mockShouldThrow = false

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => {
        if (mockShouldThrow) {
          throw new Error('Database connection failed')
        }
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockImplementation(() => Promise.resolve(mockQueryResults)),
              }),
            }),
          }),
        }
      }),
    },
  }
})

// Mock PERSONA_THRESHOLD
vi.mock('@/lib/personas/service', () => ({
  PERSONA_THRESHOLD: 5,
}))

// Import after mocking
const { GET } = await import('../route')

describe('GET /api/personas/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryResults = []
    mockShouldThrow = false
  })

  it('returns empty channels array when no videos exist', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toEqual([])
    expect(data.threshold).toBe(5)
  })

  it('returns channels with transcript counts and no personas', async () => {
    mockQueryResults = [
      { channelName: 'Nate B Jones', transcriptCount: 6, personaId: null, personaCreatedAt: null },
      { channelName: 'Anthropic', transcriptCount: 1, personaId: null, personaCreatedAt: null },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(2)
    expect(data.threshold).toBe(5)

    // Should be sorted by transcript count descending (no personas)
    expect(data.channels[0]).toMatchObject({
      channelName: 'Nate B Jones',
      transcriptCount: 6,
      personaId: null,
      personaCreatedAt: null,
    })
    expect(data.channels[1]).toMatchObject({
      channelName: 'Anthropic',
      transcriptCount: 1,
      personaId: null,
      personaCreatedAt: null,
    })
  })

  it('returns channels with personas included', async () => {
    const personaCreatedAt = new Date('2024-02-10T10:00:00Z')
    mockQueryResults = [
      { channelName: 'Nate B Jones', transcriptCount: 3, personaId: 1, personaCreatedAt },
      { channelName: 'Anthropic', transcriptCount: 1, personaId: null, personaCreatedAt: null },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(2)

    const nateChannel = data.channels.find((c: ChannelStatus) => c.channelName === 'Nate B Jones')
    expect(nateChannel).toMatchObject({
      channelName: 'Nate B Jones',
      transcriptCount: 3,
      personaId: 1,
    })
    expect(nateChannel?.personaCreatedAt).toBeDefined()

    expect(data.channels.find((c: ChannelStatus) => c.channelName === 'Anthropic')).toMatchObject({
      channelName: 'Anthropic',
      transcriptCount: 1,
      personaId: null,
      personaCreatedAt: null,
    })
  })

  it('sorts active personas first, then by transcript count descending', async () => {
    mockQueryResults = [
      { channelName: 'Channel A', transcriptCount: 2, personaId: 1, personaCreatedAt: new Date() },
      { channelName: 'Channel B', transcriptCount: 5, personaId: null, personaCreatedAt: null },
      { channelName: 'Channel C', transcriptCount: 3, personaId: null, personaCreatedAt: null },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(3)

    // Channel A should be first (has persona)
    expect(data.channels[0].channelName).toBe('Channel A')
    expect(data.channels[0].personaId).not.toBeNull()

    // Channel B and C should follow, sorted by transcript count descending
    expect(data.channels[1].channelName).toBe('Channel B')
    expect(data.channels[1].personaId).toBeNull()
    expect(data.channels[2].channelName).toBe('Channel C')
    expect(data.channels[2].personaId).toBeNull()
  })

  it('handles channels below and above threshold', async () => {
    mockQueryResults = [
      { channelName: 'Above Threshold', transcriptCount: 6, personaId: null, personaCreatedAt: null },
      { channelName: 'At Threshold', transcriptCount: 5, personaId: null, personaCreatedAt: null },
      { channelName: 'Below Threshold', transcriptCount: 3, personaId: null, personaCreatedAt: null },
    ]

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(3)
    expect(data.threshold).toBe(5)

    const belowChannel = data.channels.find((c: ChannelStatus) => c.channelName === 'Below Threshold')
    const atChannel = data.channels.find((c: ChannelStatus) => c.channelName === 'At Threshold')
    const aboveChannel = data.channels.find((c: ChannelStatus) => c.channelName === 'Above Threshold')

    expect(belowChannel?.transcriptCount).toBe(3)
    expect(atChannel?.transcriptCount).toBe(5)
    expect(aboveChannel?.transcriptCount).toBe(6)
  })

  it('returns 500 on database error', async () => {
    mockShouldThrow = true

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch persona status')
  })
})
