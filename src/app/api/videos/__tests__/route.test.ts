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

// Mock the metadata fetcher
const mockFetchVideoPageMetadata = vi.fn()
vi.mock('@/lib/youtube/metadata', () => ({
  fetchVideoPageMetadata: mockFetchVideoPageMetadata,
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
    getDistinctChannels: () => actual.getDistinctChannels(testDb),
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
    // Reset mocks before each test
    mockFetchVideoPageMetadata.mockReset()
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

  it('creates video with duration and description fields', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-duration-desc',
        title: 'Video with Metadata',
        channel: 'Test Channel',
        transcript: 'This is a test transcript with enough characters to pass validation',
        duration: 300,
        description: 'This is a test description from the video',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.video.duration).toBe(300)
    expect(data.video.description).toBe('This is a test description from the video')
  })

  it('auto-fetches metadata when youtubeId present and metadata fields missing', async () => {
    mockFetchVideoPageMetadata.mockResolvedValueOnce({
      publishedAt: '2024-06-09T10:00:00Z',
      description: 'Fetched description from YouTube',
      duration: 600,
    })

    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-auto-fetch',
        title: 'Video Auto Fetch',
        channel: 'Test Channel',
        transcript: 'This is a test transcript with enough characters to pass validation',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(mockFetchVideoPageMetadata).toHaveBeenCalledWith('test-auto-fetch')
    expect(data.video.publishedAt).toBeDefined()
    expect(new Date(data.video.publishedAt).toISOString()).toBe('2024-06-09T10:00:00.000Z')
    expect(data.video.description).toBe('Fetched description from YouTube')
    expect(data.video.duration).toBe(600)
  })

  it('caller-provided values take priority over fetched values', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-priority',
        title: 'Priority Test',
        channel: 'Test Channel',
        transcript: 'This is a test transcript with enough characters to pass validation',
        publishedAt: '2024-12-25T12:00:00.000Z',
        description: 'User provided description',
        duration: 500,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    // Should NOT have called fetch because all fields were provided
    expect(mockFetchVideoPageMetadata).not.toHaveBeenCalled()
    expect(new Date(data.video.publishedAt).toISOString()).toBe('2024-12-25T12:00:00.000Z')
    expect(data.video.description).toBe('User provided description')
    expect(data.video.duration).toBe(500)
  })

  it('gracefully handles metadata fetch failure - save still succeeds', async () => {
    mockFetchVideoPageMetadata.mockReset()
    mockFetchVideoPageMetadata.mockRejectedValueOnce(new Error('YouTube fetch failed'))

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-fetch-fail',
        title: 'Fetch Failure Test',
        channel: 'Test Channel',
        transcript: 'This is a test transcript with enough characters to pass validation',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.video.youtubeId).toBe('test-fetch-fail')
    expect(data.video.publishedAt).toBeNull()
    expect(data.video.description).toBeNull()
    expect(data.video.duration).toBeNull()
    expect(consoleWarnSpy).toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('does not fetch metadata when all fields already provided', async () => {
    mockFetchVideoPageMetadata.mockClear()

    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-no-fetch',
        title: 'No Fetch Needed',
        channel: 'Test Channel',
        transcript: 'This is a test transcript with enough characters to pass validation',
        publishedAt: '2024-06-15T08:30:00.000Z',
        description: 'Complete description',
        duration: 450,
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(mockFetchVideoPageMetadata).not.toHaveBeenCalled()
    expect(data.video.publishedAt).toBeDefined()
    expect(data.video.description).toBe('Complete description')
    expect(data.video.duration).toBe(450)
  })

  it('includes milestones in POST response', async () => {
    // Create an existing video from a different channel first
    await testDb.insert(schema.videos).values({
      youtubeId: 'existing-video',
      title: 'Existing Video',
      channel: 'Existing Channel',
      transcript: 'Existing transcript content',
    })

    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'test-milestones',
        title: 'Milestones Test Video',
        channel: 'Test Channel',
        transcript: 'This is a test transcript with enough characters to pass validation',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video).toBeDefined()
    expect(data.milestones).toBeDefined()
    expect(data.milestones.totalVideos).toBe(2) // Includes the new video
    expect(data.milestones.channelVideoCount).toBe(1)
    expect(data.milestones.isNewChannel).toBe(true)
  })

  it('marks isNewChannel as false when adding second video from same channel', async () => {
    // Create first video from "Same Channel"
    await testDb.insert(schema.videos).values({
      youtubeId: 'first-video-same-channel',
      title: 'First Video',
      channel: 'Same Channel',
      transcript: 'First video transcript',
    })

    // Add second video from "Same Channel"
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        youtubeId: 'second-video-same-channel',
        title: 'Second Video',
        channel: 'Same Channel',
        transcript: 'This is the second video from the same channel with enough characters',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.milestones).toBeDefined()
    expect(data.milestones.totalVideos).toBe(2)
    expect(data.milestones.channelVideoCount).toBe(2)
    expect(data.milestones.isNewChannel).toBe(false)
  })

  it('handles transcript-type videos with null channel in milestones', async () => {
    const request = new Request('http://localhost:3000/api/videos', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'transcript',
        title: 'Transcript Without Channel',
        transcript: 'This is a transcript entry without channel for milestone testing',
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.video.channel).toBeNull()
    expect(data.milestones).toBeDefined()
    expect(data.milestones.totalVideos).toBe(1)
    expect(data.milestones.channelVideoCount).toBe(0)
    expect(data.milestones.isNewChannel).toBe(false)
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
    // Transcript is a large field excluded from list responses
    expect(data.videos[0]).not.toHaveProperty('transcript')
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

  it('filters videos by channel when channel param is provided', async () => {
    await testDb.insert(schema.videos).values([
      {
        youtubeId: 'fireship-1',
        title: 'React in 100 Seconds',
        channel: 'Fireship',
        transcript: 'React content from Fireship',
      },
      {
        youtubeId: 'fireship-2',
        title: 'TypeScript in 100 Seconds',
        channel: 'Fireship',
        transcript: 'TypeScript content from Fireship',
      },
      {
        youtubeId: 'theo-1',
        title: 'Why I use TypeScript',
        channel: 'Theo',
        transcript: 'TypeScript thoughts from Theo',
      },
    ])

    const request = new Request('http://localhost:3000/api/videos?channel=Fireship')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(2)
    expect(data.videos.every((v: { channel: string }) => v.channel === 'Fireship')).toBe(true)
  })

  it('returns all videos when channel param is not provided (backward compatible)', async () => {
    await testDb.insert(schema.videos).values([
      {
        youtubeId: 'channel-a-1',
        title: 'Video A1',
        channel: 'Channel A',
        transcript: 'Content from Channel A',
      },
      {
        youtubeId: 'channel-b-1',
        title: 'Video B1',
        channel: 'Channel B',
        transcript: 'Content from Channel B',
      },
    ])

    const request = new Request('http://localhost:3000/api/videos')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(2)
  })

  it('returns empty list when channel param matches no videos', async () => {
    await testDb.insert(schema.videos).values({
      youtubeId: 'some-video',
      title: 'Some Video',
      channel: 'Known Channel',
      transcript: 'Some content here',
    })

    const request = new Request('http://localhost:3000/api/videos?channel=NonExistentChannel')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toEqual([])
  })

  it('channel filter is case-sensitive exact match', async () => {
    await testDb.insert(schema.videos).values([
      {
        youtubeId: 'fireship-exact',
        title: 'Exact Case Video',
        channel: 'Fireship',
        transcript: 'Content from Fireship',
      },
    ])

    // Lowercase 'fireship' should NOT match 'Fireship'
    const request = new Request('http://localhost:3000/api/videos?channel=fireship')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toEqual([])
  })

  it('channel filter can be combined with focusAreaId filter', async () => {
    const focusAreaRows = await testDb.insert(schema.focusAreas).values({
      name: 'Frontend',
      color: '#61dafb',
    }).returning()
    const focusArea = focusAreaRows[0]!

    const videoRows = await testDb.insert(schema.videos).values([
      {
        youtubeId: 'fireship-frontend',
        title: 'React Tutorial',
        channel: 'Fireship',
        transcript: 'React content',
      },
      {
        youtubeId: 'fireship-backend',
        title: 'Node Tutorial',
        channel: 'Fireship',
        transcript: 'Node content',
      },
      {
        youtubeId: 'theo-frontend',
        title: 'Theo Frontend',
        channel: 'Theo',
        transcript: 'Theo frontend content',
      },
    ]).returning()

    const fireshipFrontendId = videoRows[0]!.id
    const theoFrontendId = videoRows[2]!.id

    // Assign fireship-frontend and theo-frontend to focus area
    await testDb.insert(schema.videoFocusAreas).values([
      { videoId: fireshipFrontendId, focusAreaId: focusArea.id },
      { videoId: theoFrontendId, focusAreaId: focusArea.id },
    ])

    // Filter by both Fireship channel AND frontend focus area
    const request = new Request(
      `http://localhost:3000/api/videos?channel=Fireship&focusAreaId=${focusArea.id}`
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(1)
    expect(data.videos[0].youtubeId).toBe('fireship-frontend')
  })
})
