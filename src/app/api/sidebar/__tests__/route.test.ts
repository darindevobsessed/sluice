import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'

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

describe('GET /api/sidebar', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE videos, focus_areas, insights, channels, settings, chunks CASCADE')
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('returns empty channels and focus areas when nothing exists', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toEqual([])
    expect(data.focusAreas).toEqual([])
  })

  it('returns channels with video counts sorted by count descending', async () => {
    await testDb.insert(schema.videos).values([
      {
        youtubeId: 'fireship-1',
        title: 'React in 100 Seconds',
        channel: 'Fireship',
        transcript: 'React content',
      },
      {
        youtubeId: 'fireship-2',
        title: 'TypeScript in 100 Seconds',
        channel: 'Fireship',
        transcript: 'TypeScript content',
      },
      {
        youtubeId: 'fireship-3',
        title: 'Node in 100 Seconds',
        channel: 'Fireship',
        transcript: 'Node content',
      },
      {
        youtubeId: 'theo-1',
        title: 'Why TypeScript',
        channel: 'Theo',
        transcript: 'TypeScript thoughts',
      },
      {
        youtubeId: 'theo-2',
        title: 'The Problem With React',
        channel: 'Theo',
        transcript: 'React thoughts',
      },
      {
        youtubeId: 'primeagen-1',
        title: 'Rust is Amazing',
        channel: 'ThePrimeagen',
        transcript: 'Rust content',
      },
    ])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(3)

    // Fireship has 3 videos — should be first
    expect(data.channels[0]).toEqual({ name: 'Fireship', videoCount: 3 })
    // Theo has 2 videos — should be second
    expect(data.channels[1]).toEqual({ name: 'Theo', videoCount: 2 })
    // ThePrimeagen has 1 video — should be last
    expect(data.channels[2]).toEqual({ name: 'ThePrimeagen', videoCount: 1 })
  })

  it('excludes videos with null channel from channel list', async () => {
    await testDb.insert(schema.videos).values([
      {
        youtubeId: 'with-channel',
        title: 'Has Channel',
        channel: 'Known Channel',
        transcript: 'Content with channel',
      },
      {
        sourceType: 'transcript',
        title: 'No Channel Transcript',
        channel: null,
        transcript: 'Content without channel',
      },
    ])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(1)
    expect(data.channels[0].name).toBe('Known Channel')
  })

  it('returns channel with correct name (not raw DB channel column value)', async () => {
    await testDb.insert(schema.videos).values({
      youtubeId: 'test-shape',
      title: 'Shape Test',
      channel: 'My Channel',
      transcript: 'Testing response shape',
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels[0]).toHaveProperty('name')
    expect(data.channels[0]).toHaveProperty('videoCount')
    expect(data.channels[0]).not.toHaveProperty('channel')
    expect(data.channels[0].name).toBe('My Channel')
    expect(data.channels[0].videoCount).toBe(1)
  })

  it('returns all focus areas with id, name, color, and createdAt', async () => {
    await testDb.insert(schema.focusAreas).values([
      { name: 'React', color: '#61dafb' },
      { name: 'TypeScript', color: '#3178c6' },
      { name: 'Testing', color: null },
    ])

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.focusAreas).toHaveLength(3)
    expect(data.focusAreas[0]).toHaveProperty('id')
    expect(data.focusAreas[0]).toHaveProperty('name')
    expect(data.focusAreas[0]).toHaveProperty('color')
    expect(data.focusAreas[0]).toHaveProperty('createdAt')

    const reactArea = data.focusAreas.find((f: { name: string }) => f.name === 'React')
    expect(reactArea).toBeDefined()
    expect(reactArea.color).toBe('#61dafb')

    const testingArea = data.focusAreas.find((f: { name: string }) => f.name === 'Testing')
    expect(testingArea).toBeDefined()
    expect(testingArea.color).toBeNull()
  })

  it('returns both channels and focus areas together in one response', async () => {
    await testDb.insert(schema.videos).values({
      youtubeId: 'combined-test',
      title: 'Combined Test',
      channel: 'My Creator',
      transcript: 'Content for combined test',
    })

    await testDb.insert(schema.focusAreas).values({
      name: 'Frontend',
      color: '#f7df1e',
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.channels).toHaveLength(1)
    expect(data.channels[0].name).toBe('My Creator')
    expect(data.focusAreas).toHaveLength(1)
    expect(data.focusAreas[0].name).toBe('Frontend')
  })

  it('videoCount is a number (not a string from SQL count)', async () => {
    await testDb.insert(schema.videos).values({
      youtubeId: 'count-type-test',
      title: 'Count Type Test',
      channel: 'Type Check Channel',
      transcript: 'Testing count type',
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(typeof data.channels[0].videoCount).toBe('number')
    expect(data.channels[0].videoCount).toBe(1)
  })
})
