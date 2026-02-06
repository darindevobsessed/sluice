import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'

// Mock the embedding pipeline to avoid ONNX runtime issues in tests
vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.5)),
}))

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

// Mock search functions to use test database
vi.mock('@/lib/db/search', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/search')>('@/lib/db/search')
  return {
    ...actual,
    searchVideos: (query: string) => actual.searchVideos(query, testDb),
    getVideoStats: () => actual.getVideoStats(testDb),
  }
})

// Import after mocking
const { GET, POST } = await import('../route')

describe('POST /api/videos', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })

  beforeEach(async () => {
    // Clean tables before each test
    await pool.query('TRUNCATE videos, insights, channels, settings, chunks CASCADE')
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('creates video with publishedAt field', async () => {
    const publishedDate = '2024-01-15T10:30:00.000Z'
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-video-123',
        title: 'Test Video',
        channel: 'Test Channel',
        thumbnail: 'https://example.com/thumb.jpg',
        transcript: 'This is a test transcript with enough characters to pass validation',
        publishedAt: publishedDate,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.video.publishedAt).toBeDefined()
    expect(new Date(data.video.publishedAt).toISOString()).toBe(publishedDate)
  })

  it('creates video without publishedAt field (null)', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-video-456',
        title: 'Test Video Without Date',
        channel: 'Test Channel',
        thumbnail: 'https://example.com/thumb.jpg',
        transcript: 'This is a test transcript with enough characters to pass validation',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.video.publishedAt).toBeNull()
  })

  it('returns publishedAt in video response when querying', async () => {
    // First create a video with publishedAt
    const publishedDate = '2024-02-20T15:45:00.000Z'
    await testDb.insert(schema.videos).values({
      youtubeId: 'test-vid-789',
      title: 'Query Test Video',
      channel: 'Test Channel',
      transcript: 'Test transcript',
      publishedAt: new Date(publishedDate),
    })

    const request = new Request('http://localhost:3000/api/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(1)
    expect(data.videos[0].publishedAt).toBeDefined()
    expect(new Date(data.videos[0].publishedAt).toISOString()).toBe(publishedDate)
  })

  it('handles invalid publishedAt format gracefully', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-video-invalid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'This is a test transcript with enough characters to pass validation',
        publishedAt: 'not-a-valid-date',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('creates video successfully without publishedAt for backward compatibility', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-backward-compat',
        title: 'Backward Compatible Video',
        channel: 'Test Channel',
        transcript: 'This is a test transcript with enough characters to pass validation',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.video.youtubeId).toBe('test-backward-compat')
  })
})

describe('GET /api/videos', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE videos, insights, channels, settings, chunks CASCADE')
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('returns empty list when no videos exist', async () => {
    const request = new Request('http://localhost:3000/api/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toEqual([])
  })

  it('returns videos with all fields including publishedAt', async () => {
    const publishedDate = new Date('2024-03-10T08:00:00Z')
    await testDb.insert(schema.videos).values({
      youtubeId: 'test-full-fields',
      title: 'Full Fields Video',
      channel: 'Test Channel',
      thumbnail: 'https://example.com/thumb.jpg',
      transcript: 'Test transcript',
      publishedAt: publishedDate,
    })

    const request = new Request('http://localhost:3000/api/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(1)
    expect(data.videos[0]).toMatchObject({
      youtubeId: 'test-full-fields',
      title: 'Full Fields Video',
      channel: 'Test Channel',
      thumbnail: 'https://example.com/thumb.jpg',
    })
    expect(data.videos[0].publishedAt).toBeDefined()
    expect(new Date(data.videos[0].publishedAt).getTime()).toBe(publishedDate.getTime())
  })
})
