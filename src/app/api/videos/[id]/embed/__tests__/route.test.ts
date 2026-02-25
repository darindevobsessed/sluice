import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the database module
const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
}

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    db: {
      select: vi.fn(() => ({ ...mockSelectChain })),
      insert: vi.fn(),
      delete: vi.fn(),
    },
  }
})

// Mock the embedding service
const mockEmbedChunks = vi.fn()
vi.mock('@/lib/embeddings/service', () => ({
  embedChunks: (...args: unknown[]) => mockEmbedChunks(...args),
}))

// Mock the chunker
const mockChunkTranscript = vi.fn()
vi.mock('@/lib/embeddings/chunker', () => ({
  chunkTranscript: (...args: unknown[]) => mockChunkTranscript(...args),
}))

// Mock the transcript parser
vi.mock('@/lib/transcript/parse', () => ({
  parseTranscript: vi.fn().mockReturnValue([
    { text: 'Test segment 1', offset: 0, seconds: 0, timestamp: '0:00' },
    { text: 'Test segment 2', offset: 5000, seconds: 5, timestamp: '0:05' },
  ]),
}))

// Import after mocking
const { POST } = await import('../route')

describe('POST /api/videos/[id]/embed', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: embedChunks returns success
    mockEmbedChunks.mockResolvedValue({
      chunks: [
        {
          content: 'Test chunk 1',
          startTime: 0,
          endTime: 5000,
          segmentIndices: [0],
          embedding: new Array(384).fill(0.1),
        },
        {
          content: 'Test chunk 2',
          startTime: 5000,
          endTime: 10000,
          segmentIndices: [1],
          embedding: new Array(384).fill(0.2),
        },
      ],
      totalChunks: 2,
      successCount: 2,
      errorCount: 0,
      durationMs: 500,
      relationshipsCreated: 3,
    })

    // Default: chunkTranscript returns chunks
    mockChunkTranscript.mockReturnValue([
      {
        content: 'Test chunk 1',
        startTime: 0,
        endTime: 5000,
        segmentIndices: [0],
      },
      {
        content: 'Test chunk 2',
        startTime: 5000,
        endTime: 10000,
        segmentIndices: [1],
      },
    ])

    // Default: select returns empty (no video found)
    mockSelectChain.limit.mockResolvedValue([])
  })

  it('returns 404 if video not found', async () => {
    mockSelectChain.limit.mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/videos/999/embed', {
      method: 'POST',
    })
    const params = Promise.resolve({ id: '999' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({
      success: false,
      error: 'Video not found',
      chunkCount: 0,
    })
  })

  it('returns 400 if video has no transcript', async () => {
    mockSelectChain.limit.mockResolvedValue([
      { id: 1, youtubeId: 'em-vid-no-transcript', title: 'Test Video', transcript: null },
    ])

    const request = new Request('http://localhost:3000/api/videos/1/embed', {
      method: 'POST',
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      success: false,
      error: 'Video has no transcript',
      chunkCount: 0,
    })
  })

  it('generates embeddings for video with transcript', async () => {
    mockSelectChain.limit.mockResolvedValue([
      {
        id: 1,
        youtubeId: 'em-vid-new-embedding',
        title: 'Test Video',
        transcript: '0:00\nTest content\n0:05\nMore content',
        duration: 600,
      },
    ])

    const request = new Request('http://localhost:3000/api/videos/1/embed', {
      method: 'POST',
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      alreadyEmbedded: false,
      chunkCount: 2,
      durationMs: 500,
      relationshipsCreated: 3,
    })

    expect(mockChunkTranscript).toHaveBeenCalled()
    expect(mockEmbedChunks).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
      1,
    )
  })

  it('returns correct response structure on success', async () => {
    mockSelectChain.limit.mockResolvedValue([
      {
        id: 1,
        youtubeId: 'em-vid-response-structure',
        title: 'Test Video',
        transcript: '0:00\nTest content',
        duration: 600,
      },
    ])

    const request = new Request('http://localhost:3000/api/videos/1/embed', {
      method: 'POST',
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('success', true)
    expect(data).toHaveProperty('alreadyEmbedded')
    expect(data).toHaveProperty('chunkCount')
    expect(typeof data.success).toBe('boolean')
    expect(typeof data.chunkCount).toBe('number')
  })

  it('includes relationshipsCreated in response', async () => {
    mockSelectChain.limit.mockResolvedValue([
      {
        id: 1,
        youtubeId: 'em-vid-with-relationships',
        title: 'Test Video',
        transcript: '0:00\nTest content',
        duration: 600,
      },
    ])

    const request = new Request('http://localhost:3000/api/videos/1/embed', {
      method: 'POST',
    })
    const params = Promise.resolve({ id: '1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('relationshipsCreated', 3)
    expect(typeof data.relationshipsCreated).toBe('number')
  })

  it('returns 400 for invalid video ID', async () => {
    const request = new Request('http://localhost:3000/api/videos/abc/embed', {
      method: 'POST',
    })
    const params = Promise.resolve({ id: 'abc' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid video ID')
  })
})
