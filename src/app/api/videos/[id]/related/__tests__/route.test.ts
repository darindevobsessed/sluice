import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RelatedChunk } from '@/lib/graph/types'

// Mock the traverse module
vi.mock('@/lib/graph/traverse', () => ({
  getRelatedChunks: vi.fn(),
}))

// Import after mocking
const { GET } = await import('../route')
const { getRelatedChunks } = await import('@/lib/graph/traverse')

describe('GET /api/videos/[id]/related', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns related chunks for valid video ID', async () => {
    const mockRelated: RelatedChunk[] = [
      {
        chunkId: 1,
        content: 'Related content',
        startTime: 10,
        endTime: 20,
        similarity: 0.92,
        video: {
          id: 2,
          title: 'Related Video',
          channel: 'Test Channel',
          youtubeId: 'related-vid',
        },
      },
    ]

    vi.mocked(getRelatedChunks).mockResolvedValue(mockRelated)

    const request = new Request('http://localhost:3000/api/videos/1/related')
    const params = Promise.resolve({ id: '1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ related: mockRelated })
    expect(getRelatedChunks).toHaveBeenCalledWith(1, { limit: 10, minSimilarity: 0.75 })
  })

  it('returns 400 for invalid video ID', async () => {
    const request = new Request('http://localhost:3000/api/videos/invalid/related')
    const params = Promise.resolve({ id: 'invalid' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Invalid video ID' })
    expect(getRelatedChunks).not.toHaveBeenCalled()
  })

  it('returns empty array when no relationships', async () => {
    vi.mocked(getRelatedChunks).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/videos/99/related')
    const params = Promise.resolve({ id: '99' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ related: [] })
  })

  it('passes query params to getRelatedChunks', async () => {
    vi.mocked(getRelatedChunks).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/videos/5/related?limit=20&minSimilarity=0.85')
    const params = Promise.resolve({ id: '5' })

    const response = await GET(request, { params })

    expect(response.status).toBe(200)
    expect(getRelatedChunks).toHaveBeenCalledWith(5, { limit: 20, minSimilarity: 0.85 })
  })

  it('uses default values for missing query params', async () => {
    vi.mocked(getRelatedChunks).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/videos/3/related')
    const params = Promise.resolve({ id: '3' })

    const response = await GET(request, { params })

    expect(response.status).toBe(200)
    expect(getRelatedChunks).toHaveBeenCalledWith(3, { limit: 10, minSimilarity: 0.75 })
  })

  it('handles limit parameter only', async () => {
    vi.mocked(getRelatedChunks).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/videos/7/related?limit=5')
    const params = Promise.resolve({ id: '7' })

    const response = await GET(request, { params })

    expect(response.status).toBe(200)
    expect(getRelatedChunks).toHaveBeenCalledWith(7, { limit: 5, minSimilarity: 0.75 })
  })

  it('handles minSimilarity parameter only', async () => {
    vi.mocked(getRelatedChunks).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/videos/8/related?minSimilarity=0.9')
    const params = Promise.resolve({ id: '8' })

    const response = await GET(request, { params })

    expect(response.status).toBe(200)
    expect(getRelatedChunks).toHaveBeenCalledWith(8, { limit: 10, minSimilarity: 0.9 })
  })

  it('returns 500 on internal error', async () => {
    vi.mocked(getRelatedChunks).mockRejectedValue(new Error('Database error'))

    const request = new Request('http://localhost:3000/api/videos/1/related')
    const params = Promise.resolve({ id: '1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Internal server error' })
  })

  it('handles NaN video ID', async () => {
    const request = new Request('http://localhost:3000/api/videos/abc123/related')
    const params = Promise.resolve({ id: 'abc123' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Invalid video ID' })
  })

  it('handles negative video ID', async () => {
    const request = new Request('http://localhost:3000/api/videos/-1/related')
    const params = Promise.resolve({ id: '-1' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Invalid video ID' })
  })

  it('handles zero video ID', async () => {
    const request = new Request('http://localhost:3000/api/videos/0/related')
    const params = Promise.resolve({ id: '0' })

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Invalid video ID' })
  })
})
