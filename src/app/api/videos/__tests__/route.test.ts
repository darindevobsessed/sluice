import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'

// Mock the embedding pipeline to avoid ONNX runtime issues in tests
vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.5)),
}))

// Mock next/server's after function
const mockAfter = vi.fn()
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return {
    ...actual,
    after: mockAfter,
  }
})

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

  it('creates transcript-type video without youtubeId', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'transcript',
        title: 'Manual Transcript Entry',
        channel: 'Test Channel',
        transcript: 'This is a manually entered transcript with enough characters to pass validation rules',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.video.sourceType).toBe('transcript')
    expect(data.video.youtubeId).toBeNull()
    expect(data.video.title).toBe('Manual Transcript Entry')
  })

  it('returns 400 when youtube-type video is missing youtubeId', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'youtube',
        title: 'YouTube Video Without ID',
        channel: 'Test Channel',
        transcript: 'This should fail because youtubeId is required for youtube sourceType',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
    expect(data.error).toContain('YouTube ID is required')
  })

  it('returns 400 when transcript-type video is missing title', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'transcript',
        title: '', // Empty string to trigger the min(1) validation
        channel: 'Test Channel',
        transcript: 'This should fail because title is required for all video types',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
    expect(data.error).toContain('Title is required')
  })

  it('defaults to youtube sourceType when not provided', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-default-type',
        title: 'Default Type Video',
        channel: 'Test Channel',
        transcript: 'This should default to youtube sourceType for backward compatibility',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.video.sourceType).toBe('youtube')
    expect(data.video.youtubeId).toBe('test-default-type')
  })

  it('still checks for duplicate youtubeId on youtube-type videos', async () => {
    // First, create a YouTube video
    const firstRequest = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'duplicate-test-123',
        title: 'First Video',
        channel: 'Test Channel',
        transcript: 'This is the first video with this YouTube ID and enough characters to pass validation',
      }),
    })
    await POST(firstRequest)

    // Try to create another with the same youtubeId
    const secondRequest = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'duplicate-test-123',
        title: 'Second Video',
        channel: 'Test Channel',
        transcript: 'This is a duplicate attempt with enough characters to pass validation rules',
      }),
    })

    const response = await POST(secondRequest)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('already been added')
  })

  it('skips duplicate check for transcript-type videos', async () => {
    // Create two transcript-type videos with same title - should both succeed
    const firstRequest = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'transcript',
        title: 'Same Title Different Transcript',
        channel: 'Test Channel',
        transcript: 'This is the first transcript with enough characters to pass validation rules',
      }),
    })
    const firstResponse = await POST(firstRequest)
    const firstData = await firstResponse.json()

    expect(firstResponse.status).toBe(201)
    expect(firstData.video).toBeDefined()

    const secondRequest = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'transcript',
        title: 'Same Title Different Transcript',
        channel: 'Test Channel',
        transcript: 'This is a different transcript with enough characters to pass validation rules',
      }),
    })
    const secondResponse = await POST(secondRequest)
    const secondData = await secondResponse.json()

    expect(secondResponse.status).toBe(201)
    expect(secondData.video).toBeDefined()
    expect(secondData.video.id).not.toBe(firstData.video.id)
  })

  it('allows transcript-type video without channel (null)', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'transcript',
        title: 'Transcript Without Channel',
        transcript: 'This is a transcript entry without a channel specified, which should be allowed',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.video.sourceType).toBe('transcript')
    expect(data.video.channel).toBeNull()
    expect(data.video.title).toBe('Transcript Without Channel')
  })

  it('returns 400 when youtube-type video is missing channel', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'youtube',
        youtubeId: 'test-video-no-channel',
        title: 'YouTube Video Without Channel',
        transcript: 'This should fail because channel is required for youtube sourceType',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
    expect(data.error).toContain('Channel is required')
  })

  it('triggers auto-embed when video is created with transcript', async () => {
    mockAfter.mockClear()

    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'transcript',
        title: 'Auto-embed Test Video',
        transcript: 'This is a test transcript that should trigger automatic embedding generation',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()

    // Verify after() was called with a function
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(mockAfter).toHaveBeenCalledWith(expect.any(Function))
  })

  it('does not trigger auto-embed when video has empty transcript', async () => {
    mockAfter.mockClear()

    // Create video with minimal transcript (below 50 chars) should fail validation
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'transcript',
        title: 'No Embed Test',
        transcript: 'Short', // This will fail validation
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400) // Should fail validation
    expect(mockAfter).not.toHaveBeenCalled()
  })
})

describe('GET /api/videos', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE videos, insights, channels, settings, chunks, focus_areas CASCADE')
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

  it('filters videos by focusAreaId when provided', async () => {
    // Create focus area
    const focusAreaRows = await testDb.insert(schema.focusAreas).values({
      name: 'React',
      color: '#61dafb',
    }).returning()
    const focusArea = focusAreaRows[0]!

    // Create videos
    const video1Rows = await testDb.insert(schema.videos).values({
      youtubeId: 'video-1',
      title: 'React Tutorial',
      channel: 'React Channel',
      transcript: 'React content',
    }).returning()
    const video1 = video1Rows[0]!

    await testDb.insert(schema.videos).values({
      youtubeId: 'video-2',
      title: 'Python Tutorial',
      channel: 'Python Channel',
      transcript: 'Python content',
    }).returning()

    // Assign only video1 to focus area
    await testDb.insert(schema.videoFocusAreas).values({
      videoId: video1.id,
      focusAreaId: focusArea.id,
    })

    // Request with focusAreaId filter
    const request = new Request(`http://localhost:3000/api/videos?focusAreaId=${focusArea.id}`)
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(1)
    expect(data.videos[0].youtubeId).toBe('video-1')
  })

  it('returns all videos when no focusAreaId provided', async () => {
    // Create focus area
    const focusAreaRows = await testDb.insert(schema.focusAreas).values({
      name: 'JavaScript',
      color: '#f7df1e',
    }).returning()
    const focusArea = focusAreaRows[0]!

    // Create videos
    const video1Rows = await testDb.insert(schema.videos).values({
      youtubeId: 'video-a',
      title: 'JS Tutorial',
      channel: 'JS Channel',
      transcript: 'JS content',
    }).returning()
    const video1 = video1Rows[0]!

    await testDb.insert(schema.videos).values({
      youtubeId: 'video-b',
      title: 'General Tutorial',
      channel: 'General Channel',
      transcript: 'General content',
    })

    // Assign only video1 to focus area
    await testDb.insert(schema.videoFocusAreas).values({
      videoId: video1.id,
      focusAreaId: focusArea.id,
    })

    // Request without focusAreaId - should return all videos
    const request = new Request('http://localhost:3000/api/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(2)
  })

  it('returns empty list when focus area has no videos', async () => {
    // Create focus area with no videos
    const focusAreaRows = await testDb.insert(schema.focusAreas).values({
      name: 'Empty Category',
      color: '#cccccc',
    }).returning()
    const focusArea = focusAreaRows[0]!

    // Create a video but don't assign it
    await testDb.insert(schema.videos).values({
      youtubeId: 'unassigned-video',
      title: 'Unassigned Video',
      channel: 'Test Channel',
      transcript: 'Test content',
    })

    const request = new Request(`http://localhost:3000/api/videos?focusAreaId=${focusArea.id}`)
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toEqual([])
  })

  it('returns 400 for invalid focusAreaId', async () => {
    const request = new Request('http://localhost:3000/api/videos?focusAreaId=invalid')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})
