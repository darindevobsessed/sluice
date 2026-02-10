import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'

// Type for channel status response
type ChannelStatus = {
  channelName: string | null
  transcriptCount: number
  personaId: number | null
  personaCreatedAt: Date | null
}

// Setup test database
const TEST_DATABASE_URL =
  process.env.DATABASE_URL?.replace(/\/goldminer$/, '/goldminer_test') ??
  'postgresql://goldminer:goldminer@localhost:5432/goldminer_test'

let pool: Pool
let testDb: ReturnType<typeof drizzle<typeof schema>>

// Mock the database module to use test database
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    get db() {
      return testDb
    },
  }
})

// Import after mocking
const { GET } = await import('../route')

describe('GET /api/personas/status', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })

  beforeEach(async () => {
    // Clean tables before each test
    await pool.query('TRUNCATE videos, personas CASCADE')
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('returns empty channels array when no videos exist', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toEqual([])
    expect(data.threshold).toBe(5)
  })

  it('returns channels with transcript counts and no personas', async () => {
    // Create videos for multiple channels
    await testDb.insert(schema.videos).values([
      { youtubeId: 'vid1', title: 'Video 1', channel: 'Nate B Jones', transcript: 'transcript 1' },
      { youtubeId: 'vid2', title: 'Video 2', channel: 'Nate B Jones', transcript: 'transcript 2' },
      { youtubeId: 'vid3', title: 'Video 3', channel: 'Nate B Jones', transcript: 'transcript 3' },
      { youtubeId: 'vid4', title: 'Video 4', channel: 'Nate B Jones', transcript: 'transcript 4' },
      { youtubeId: 'vid5', title: 'Video 5', channel: 'Nate B Jones', transcript: 'transcript 5' },
      { youtubeId: 'vid6', title: 'Video 6', channel: 'Nate B Jones', transcript: 'transcript 6' },
      { youtubeId: 'vid7', title: 'Video 7', channel: 'Anthropic', transcript: 'transcript 7' },
    ])

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
    // Create videos
    await testDb.insert(schema.videos).values([
      { youtubeId: 'vid1', title: 'Video 1', channel: 'Nate B Jones', transcript: 'transcript 1' },
      { youtubeId: 'vid2', title: 'Video 2', channel: 'Nate B Jones', transcript: 'transcript 2' },
      { youtubeId: 'vid3', title: 'Video 3', channel: 'Nate B Jones', transcript: 'transcript 3' },
      { youtubeId: 'vid4', title: 'Video 4', channel: 'Anthropic', transcript: 'transcript 4' },
    ])

    // Create persona for Nate B Jones
    const personaCreatedAt = new Date('2024-02-10T10:00:00Z')
    const personaRows = await testDb.insert(schema.personas).values({
      channelName: 'Nate B Jones',
      name: 'Nate',
      systemPrompt: 'You are Nate B Jones...',
      transcriptCount: 3,
      createdAt: personaCreatedAt,
    }).returning()
    const persona = personaRows[0]!

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(2)

    // Channel with persona should include persona details
    const nateChannel = data.channels.find((c: ChannelStatus) => c.channelName === 'Nate B Jones')
    expect(nateChannel).toMatchObject({
      channelName: 'Nate B Jones',
      transcriptCount: 3,
      personaId: persona.id,
    })
    expect(nateChannel?.personaCreatedAt).toBeDefined()
    expect(new Date(nateChannel?.personaCreatedAt ?? 0).getTime()).toBe(personaCreatedAt.getTime())

    // Channel without persona
    expect(data.channels.find((c: ChannelStatus) => c.channelName === 'Anthropic')).toMatchObject({
      channelName: 'Anthropic',
      transcriptCount: 1,
      personaId: null,
      personaCreatedAt: null,
    })
  })

  it('sorts active personas first, then by transcript count descending', async () => {
    // Create videos for three channels
    await testDb.insert(schema.videos).values([
      { youtubeId: 'vid1', title: 'Video 1', channel: 'Channel A', transcript: 'transcript 1' },
      { youtubeId: 'vid2', title: 'Video 2', channel: 'Channel A', transcript: 'transcript 2' },
      { youtubeId: 'vid3', title: 'Video 3', channel: 'Channel B', transcript: 'transcript 3' },
      { youtubeId: 'vid4', title: 'Video 4', channel: 'Channel B', transcript: 'transcript 4' },
      { youtubeId: 'vid5', title: 'Video 5', channel: 'Channel B', transcript: 'transcript 5' },
      { youtubeId: 'vid6', title: 'Video 6', channel: 'Channel B', transcript: 'transcript 6' },
      { youtubeId: 'vid7', title: 'Video 7', channel: 'Channel B', transcript: 'transcript 7' },
      { youtubeId: 'vid8', title: 'Video 8', channel: 'Channel C', transcript: 'transcript 8' },
      { youtubeId: 'vid9', title: 'Video 9', channel: 'Channel C', transcript: 'transcript 9' },
      { youtubeId: 'vid10', title: 'Video 10', channel: 'Channel C', transcript: 'transcript 10' },
    ])

    // Create persona for Channel A (2 transcripts, has persona)
    await testDb.insert(schema.personas).values({
      channelName: 'Channel A',
      name: 'Persona A',
      systemPrompt: 'You are Persona A...',
      transcriptCount: 2,
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(3)

    // Channel A should be first (has persona, even though it has fewer transcripts)
    expect(data.channels[0].channelName).toBe('Channel A')
    expect(data.channels[0].personaId).not.toBeNull()

    // Channel B and C should follow, sorted by transcript count descending
    expect(data.channels[1].channelName).toBe('Channel B') // 5 transcripts
    expect(data.channels[1].personaId).toBeNull()
    expect(data.channels[2].channelName).toBe('Channel C') // 3 transcripts
    expect(data.channels[2].personaId).toBeNull()
  })

  it('excludes channels with null channel name', async () => {
    // Create videos with and without channel names
    await testDb.insert(schema.videos).values([
      { youtubeId: 'vid1', title: 'Video 1', channel: 'Valid Channel', transcript: 'transcript 1' },
      { youtubeId: 'vid2', title: 'Video 2', channel: null, transcript: 'transcript 2', sourceType: 'transcript' },
      { youtubeId: 'vid3', title: 'Video 3', channel: null, transcript: 'transcript 3', sourceType: 'transcript' },
    ])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(1)
    expect(data.channels[0].channelName).toBe('Valid Channel')
  })

  it('handles channels below and above threshold', async () => {
    // Create channels with various transcript counts relative to threshold (5)
    await testDb.insert(schema.videos).values([
      { youtubeId: 'vid1', title: 'Video 1', channel: 'Below Threshold', transcript: 'transcript 1' },
      { youtubeId: 'vid2', title: 'Video 2', channel: 'Below Threshold', transcript: 'transcript 2' },
      { youtubeId: 'vid3', title: 'Video 3', channel: 'Below Threshold', transcript: 'transcript 3' },
      { youtubeId: 'vid4', title: 'Video 4', channel: 'At Threshold', transcript: 'transcript 4' },
      { youtubeId: 'vid5', title: 'Video 5', channel: 'At Threshold', transcript: 'transcript 5' },
      { youtubeId: 'vid6', title: 'Video 6', channel: 'At Threshold', transcript: 'transcript 6' },
      { youtubeId: 'vid7', title: 'Video 7', channel: 'At Threshold', transcript: 'transcript 7' },
      { youtubeId: 'vid8', title: 'Video 8', channel: 'At Threshold', transcript: 'transcript 8' },
      { youtubeId: 'vid9', title: 'Video 9', channel: 'Above Threshold', transcript: 'transcript 9' },
      { youtubeId: 'vid10', title: 'Video 10', channel: 'Above Threshold', transcript: 'transcript 10' },
      { youtubeId: 'vid11', title: 'Video 11', channel: 'Above Threshold', transcript: 'transcript 11' },
      { youtubeId: 'vid12', title: 'Video 12', channel: 'Above Threshold', transcript: 'transcript 12' },
      { youtubeId: 'vid13', title: 'Video 13', channel: 'Above Threshold', transcript: 'transcript 13' },
      { youtubeId: 'vid14', title: 'Video 14', channel: 'Above Threshold', transcript: 'transcript 14' },
    ])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(3)
    expect(data.threshold).toBe(5)

    // All channels should be included regardless of threshold
    const belowChannel = data.channels.find((c: ChannelStatus) => c.channelName === 'Below Threshold')
    const atChannel = data.channels.find((c: ChannelStatus) => c.channelName === 'At Threshold')
    const aboveChannel = data.channels.find((c: ChannelStatus) => c.channelName === 'Above Threshold')

    expect(belowChannel?.transcriptCount).toBe(3)
    expect(atChannel?.transcriptCount).toBe(5)
    expect(aboveChannel?.transcriptCount).toBe(6)
  })

  it('returns 500 on database error', async () => {
    // Close the pool to force a database error
    await pool.end()

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch persona status')

    // Reconnect for cleanup
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })
})
