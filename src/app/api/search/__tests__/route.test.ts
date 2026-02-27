import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

// Mock the embedding pipeline
vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.5)),
}))

// Mock hybrid search
const mockHybridSearch = vi.fn()
vi.mock('@/lib/search/hybrid-search', () => ({
  hybridSearch: (...args: unknown[]) => mockHybridSearch(...args),
}))

// Mock db for focus area filtering
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
  }
})

// Import after mocking
const { GET } = await import('../route')

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHybridSearch.mockResolvedValue({ results: [], degraded: false })
  })

  it('returns empty results for empty query', async () => {
    const request = new Request('http://localhost:3000/api/search?q=')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      chunks: [],
      videos: [],
      query: '',
      mode: 'hybrid',
      timing: 0,
      hasEmbeddings: true,
      degraded: false,
    })
  })

  it('returns empty results for missing query parameter', async () => {
    const request = new Request('http://localhost:3000/api/search')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      chunks: [],
      videos: [],
      query: '',
      mode: 'hybrid',
      timing: 0,
      hasEmbeddings: true,
      degraded: false,
    })
  })

  it('returns both chunk and video results', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'TypeScript is a typed superset of JavaScript',
        startTime: 0,
        endTime: 10,
        videoId: 1,
        videoTitle: 'TypeScript Tutorial',
        channel: 'Dev Channel',
        youtubeId: 'sr-test-vid',
        thumbnail: null,
        similarity: 0.85,
      },
      {
        chunkId: 2,
        content: 'TypeScript provides better tooling',
        startTime: 10,
        endTime: 20,
        videoId: 1,
        videoTitle: 'TypeScript Tutorial',
        channel: 'Dev Channel',
        youtubeId: 'sr-test-vid',
        thumbnail: null,
        similarity: 0.80,
      },
    ], degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=TypeScript')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.query).toBe('TypeScript')
    expect(data.mode).toBe('hybrid')
    expect(data.chunks).toBeInstanceOf(Array)
    expect(data.chunks.length).toBeGreaterThan(0)
    expect(data.videos).toBeInstanceOf(Array)
    expect(data.videos.length).toBeGreaterThan(0)
    expect(data.hasEmbeddings).toBe(true)
    expect(typeof data.timing).toBe('number')
    expect(data.timing).toBeGreaterThanOrEqual(0)
  })

  it('respects limit parameter for chunks', async () => {
    // Return 10 chunks
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      chunkId: i + 1,
      content: `TypeScript content ${i}`,
      startTime: i * 10,
      endTime: (i + 1) * 10,
      videoId: 1,
      videoTitle: 'Test Video',
      channel: 'Test Channel',
      youtubeId: 'sr-test-vid',
      thumbnail: null,
      similarity: 0.7,
    }))
    mockHybridSearch.mockResolvedValue({ results: chunks, degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=TypeScript&limit=3')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.chunks.length).toBeLessThanOrEqual(3)
  })

  it('respects limit parameter for videos', async () => {
    // Return chunks from 5 different videos
    const chunks = Array.from({ length: 5 }, (_, i) => ({
      chunkId: i + 1,
      content: `TypeScript content ${i}`,
      startTime: 0,
      endTime: 10,
      videoId: i + 1,
      videoTitle: `TypeScript Video ${i}`,
      channel: 'Test Channel',
      youtubeId: `sr-vid-${i}`,
      thumbnail: null,
      similarity: 0.7,
    }))
    mockHybridSearch.mockResolvedValue({ results: chunks, degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=TypeScript&limit=2')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos.length).toBeLessThanOrEqual(2)
  })

  it('respects mode parameter: keyword', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'TypeScript is great',
        startTime: 0,
        endTime: 10,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'sr-test-vid',
        thumbnail: null,
        similarity: 1.0,
      },
    ], degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=TypeScript&mode=keyword')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.mode).toBe('keyword')
    expect(data.chunks.length).toBeGreaterThan(0)
  })

  it('respects mode parameter: vector', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'Some content',
        startTime: 0,
        endTime: 10,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'sr-test-vid',
        thumbnail: null,
        similarity: 0.8,
      },
    ], degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=content&mode=vector')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.mode).toBe('vector')
  })

  it('uses hybrid mode by default', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.mode).toBe('hybrid')
  })

  it('video results include all required fields', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'TypeScript is great',
        startTime: 42,
        endTime: 52,
        videoId: 1,
        videoTitle: 'TypeScript Tutorial',
        channel: 'Dev Channel',
        youtubeId: 'sr-abc123',
        thumbnail: 'https://example.com/thumb.jpg',
        similarity: 0.85,
      },
    ], degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=TypeScript')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(1)

    const videoResult = data.videos[0]
    expect(videoResult).toHaveProperty('videoId', 1)
    expect(videoResult).toHaveProperty('youtubeId', 'sr-abc123')
    expect(videoResult).toHaveProperty('title', 'TypeScript Tutorial')
    expect(videoResult).toHaveProperty('channel', 'Dev Channel')
    expect(videoResult).toHaveProperty('thumbnail', 'https://example.com/thumb.jpg')
    expect(videoResult).toHaveProperty('score')
    expect(videoResult).toHaveProperty('matchedChunks', 1)
    expect(videoResult).toHaveProperty('bestChunk')
    expect(videoResult.bestChunk).toHaveProperty('content', 'TypeScript is great')
    expect(videoResult.bestChunk).toHaveProperty('startTime', 42)
    expect(videoResult.bestChunk).toHaveProperty('similarity')
  })

  it('aggregates multiple chunks from same video', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'TypeScript is great',
        startTime: 0,
        endTime: 10,
        videoId: 1,
        videoTitle: 'TypeScript Guide',
        channel: 'Dev Channel',
        youtubeId: 'sr-test-vid',
        thumbnail: null,
        similarity: 0.7,
      },
      {
        chunkId: 2,
        content: 'TypeScript has types',
        startTime: 10,
        endTime: 20,
        videoId: 1,
        videoTitle: 'TypeScript Guide',
        channel: 'Dev Channel',
        youtubeId: 'sr-test-vid',
        thumbnail: null,
        similarity: 0.9,
      },
      {
        chunkId: 3,
        content: 'TypeScript compiles',
        startTime: 20,
        endTime: 30,
        videoId: 1,
        videoTitle: 'TypeScript Guide',
        channel: 'Dev Channel',
        youtubeId: 'sr-test-vid',
        thumbnail: null,
        similarity: 0.6,
      },
    ], degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=TypeScript')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.videos).toHaveLength(1)
    expect(data.videos[0]?.matchedChunks).toBe(3)
    expect(data.chunks.length).toBeGreaterThanOrEqual(3)
  })

  it('returns hasEmbeddings=false when search returns no results in hybrid mode', async () => {
    mockHybridSearch.mockResolvedValue({ results: [], degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=zzz-nonexistent-query-xyz')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.hasEmbeddings).toBe(false)
  })

  it('returns hasEmbeddings=true when keyword mode returns results', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'TypeScript content without embedding',
        startTime: 0,
        endTime: 10,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'sr-test-vid',
        thumbnail: null,
        similarity: 1.0,
      },
    ], degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=TypeScript&mode=keyword')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.hasEmbeddings).toBe(true)
    expect(data.chunks.length).toBeGreaterThan(0)
  })

  it('includes cache headers', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test')

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=60')
  })

  it('handles invalid mode parameter gracefully', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test&mode=invalid')

    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it('handles invalid limit parameter', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test&limit=abc')

    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it('handles very large limit parameter', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test&limit=9999')

    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it('handles query with special characters', async () => {
    mockHybridSearch.mockResolvedValue({ results: [], degraded: false })

    const request = new Request('http://localhost:3000/api/search?q=C%2B%2B')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.query).toBe('C++')
  })

  it('returns timing measurement', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test')

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(typeof data.timing).toBe('number')
    expect(data.timing).toBeGreaterThanOrEqual(0)
  })

  describe('query length validation', () => {
    it('rejects queries longer than 500 characters', async () => {
      const longQuery = 'a'.repeat(501)
      const request = new Request(`http://localhost:3000/api/search?q=${longQuery}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Search query must be 500 characters or fewer')
    })

    it('accepts queries of exactly 500 characters', async () => {
      const exactQuery = 'a'.repeat(500)
      const request = new Request(`http://localhost:3000/api/search?q=${exactQuery}`)

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('accepts normal length queries', async () => {
      const request = new Request('http://localhost:3000/api/search?q=TypeScript')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('temporal decay parameters', () => {
    it('passes temporalDecay=true to hybridSearch', async () => {
      mockHybridSearch.mockResolvedValue({ results: [], degraded: false })

      const request = new Request('http://localhost:3000/api/search?q=TypeScript&temporalDecay=true')

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockHybridSearch).toHaveBeenCalledWith('TypeScript', expect.objectContaining({
        temporalDecay: true,
      }))
    })

    it('passes temporalDecay=false by default', async () => {
      mockHybridSearch.mockResolvedValue({ results: [], degraded: false })

      const request = new Request('http://localhost:3000/api/search?q=TypeScript')

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockHybridSearch).toHaveBeenCalledWith('TypeScript', expect.objectContaining({
        temporalDecay: false,
      }))
    })

    it('respects custom halfLifeDays parameter', async () => {
      mockHybridSearch.mockResolvedValue({ results: [], degraded: false })

      const request = new Request(
        'http://localhost:3000/api/search?q=TypeScript&temporalDecay=true&halfLifeDays=180',
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockHybridSearch).toHaveBeenCalledWith('TypeScript', expect.objectContaining({
        temporalDecay: true,
        halfLifeDays: 180,
      }))
    })

    it('handles temporalDecay=false explicitly', async () => {
      mockHybridSearch.mockResolvedValue({ results: [], degraded: false })

      const request = new Request('http://localhost:3000/api/search?q=TypeScript&temporalDecay=false')

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockHybridSearch).toHaveBeenCalledWith('TypeScript', expect.objectContaining({
        temporalDecay: false,
      }))
    })

    it('ignores halfLifeDays when temporalDecay is false', async () => {
      mockHybridSearch.mockResolvedValue({ results: [], degraded: false })

      const request = new Request(
        'http://localhost:3000/api/search?q=TypeScript&temporalDecay=false&halfLifeDays=1',
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockHybridSearch).toHaveBeenCalledWith('TypeScript', expect.objectContaining({
        temporalDecay: false,
      }))
    })

    it('handles invalid temporalDecay parameter', async () => {
      const request = new Request('http://localhost:3000/api/search?q=test&temporalDecay=invalid')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('handles invalid halfLifeDays parameter', async () => {
      const request = new Request('http://localhost:3000/api/search?q=test&temporalDecay=true&halfLifeDays=abc')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })
})
