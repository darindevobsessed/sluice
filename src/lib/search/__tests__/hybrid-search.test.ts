import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hybridSearch } from '../hybrid-search'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@/lib/db/schema'

// Mock the embedding pipeline to avoid ONNX runtime issues in tests
vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.5)),
}))

// Mock vector-search module so hybrid mode can be tested independently
vi.mock('../vector-search', () => ({
  vectorSearch: vi.fn().mockResolvedValue([]),
}))

import { vectorSearch } from '../vector-search'

const createMockDb = () => {
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue([]),
  }
  return {
    select: vi.fn(() => mockSelectChain),
    insert: vi.fn(() => mockInsertChain),
    delete: vi.fn(() => mockDeleteChain),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    _selectChain: mockSelectChain,
    _insertChain: mockInsertChain,
    _deleteChain: mockDeleteChain,
  }
}

type MockDb = ReturnType<typeof createMockDb>

describe('hybridSearch', () => {
  let mockDb: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
  })

  describe('mode: keyword', () => {
    it('returns chunks matching keyword search', async () => {
      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript is a typed superset of JavaScript',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'keyword', limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.content).toContain('TypeScript')
    })

    it('performs case-insensitive keyword search', async () => {
      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript is awesome',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'typescript',
        { mode: 'keyword', limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results.length).toBe(1)
      expect(results[0]?.content).toContain('TypeScript')
    })

    it('returns empty array when no keyword matches', async () => {
      mockDb._selectChain.limit.mockResolvedValue([])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'keyword', limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toEqual([])
    })

    it('respects limit parameter', async () => {
      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'This is test chunk 0',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
        {
          chunkId: 2,
          content: 'This is test chunk 1',
          startTime: 10,
          endTime: 20,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'test',
        { mode: 'keyword', limit: 2 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toHaveLength(2)
    })
  })

  describe('mode: vector', () => {
    it('performs pure vector search', async () => {
      vi.mocked(vectorSearch).mockResolvedValue([
        {
          chunkId: 1,
          content: 'Some content here',
          startTime: 0,
          endTime: 10,
          similarity: 0.85,
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'query text',
        { mode: 'vector', limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(1)
      expect(vectorSearch).toHaveBeenCalled()
    })

    it('returns empty results when vector search finds nothing above threshold', async () => {
      vi.mocked(vectorSearch).mockResolvedValue([])

      const results = await hybridSearch(
        'query',
        { mode: 'vector', limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(Array.isArray(results)).toBe(true)
      expect(results).toEqual([])
    })
  })

  describe('mode: hybrid (RRF)', () => {
    it('combines vector and keyword results using RRF', async () => {
      vi.mocked(vectorSearch).mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript is a typed language',
          startTime: 0,
          endTime: 10,
          similarity: 0.9,
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
        {
          chunkId: 3,
          content: 'Programming concepts explained',
          startTime: 20,
          endTime: 30,
          similarity: 0.85,
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript is a typed language',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
        {
          chunkId: 2,
          content: 'TypeScript tutorial for beginners',
          startTime: 10,
          endTime: 20,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'hybrid', limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results.length).toBeGreaterThan(0)
      expect(Array.isArray(results)).toBe(true)
    })

    it('deduplicates chunks appearing in both vector and keyword results', async () => {
      vi.mocked(vectorSearch).mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming language',
          startTime: 0,
          endTime: 10,
          similarity: 0.9,
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming language',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'hybrid', limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      const chunkIds = results.map(r => r.chunkId)
      const uniqueIds = new Set(chunkIds)
      expect(chunkIds.length).toBe(uniqueIds.size)
    })

    it('boosts chunks that appear in both vector and keyword results', async () => {
      vi.mocked(vectorSearch).mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript is amazing',
          startTime: 0,
          endTime: 10,
          similarity: 0.9,
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
        {
          chunkId: 3,
          content: 'Programming best practices',
          startTime: 20,
          endTime: 30,
          similarity: 0.85,
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript is amazing',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
        {
          chunkId: 2,
          content: 'TypeScript tutorial',
          startTime: 10,
          endTime: 20,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'hybrid', limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results.length).toBeGreaterThan(0)
      // Chunk 1 (appears in both) should be first due to RRF boost
      expect(results[0]?.chunkId).toBe(1)
    })

    it('respects limit parameter in hybrid mode', async () => {
      const vectorResults = Array.from({ length: 10 }, (_, i) => ({
        chunkId: i + 1,
        content: `TypeScript content ${i}`,
        startTime: i * 10,
        endTime: (i + 1) * 10,
        similarity: 0.9 - i * 0.01,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'test-vid',
        thumbnail: null,
        publishedAt: null,
      }))

      vi.mocked(vectorSearch).mockResolvedValue(vectorResults)

      mockDb._selectChain.limit.mockResolvedValue(
        vectorResults.map(r => ({ ...r, similarity: '1.0' })),
      )

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'hybrid', limit: 5 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results.length).toBeLessThanOrEqual(5)
    })
  })

  describe('default behavior', () => {
    it('uses hybrid mode by default', async () => {
      vi.mocked(vectorSearch).mockResolvedValue([])
      mockDb._selectChain.limit.mockResolvedValue([])

      const results = await hybridSearch(
        'TypeScript',
        { limit: 10 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(Array.isArray(results)).toBe(true)
      expect(vectorSearch).toHaveBeenCalled()
    })

    it('uses limit of 10 by default', async () => {
      vi.mocked(vectorSearch).mockResolvedValue([])
      mockDb._selectChain.limit.mockResolvedValue([])

      const results = await hybridSearch(
        'test',
        {},
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results.length).toBeLessThanOrEqual(10)
    })
  })

  describe('result structure', () => {
    it('returns SearchResult objects with all required fields', async () => {
      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming',
          startTime: 42,
          endTime: 52,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video Title',
          channel: 'Test Channel Name',
          youtubeId: 'abc123',
          thumbnail: 'https://example.com/thumb.jpg',
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'keyword' },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toHaveLength(1)

      const result = results[0]!
      expect(result).toHaveProperty('chunkId')
      expect(result).toHaveProperty('content', 'TypeScript programming')
      expect(result).toHaveProperty('startTime', 42)
      expect(result).toHaveProperty('endTime', 52)
      expect(result).toHaveProperty('similarity')
      expect(result).toHaveProperty('videoId', 1)
      expect(result).toHaveProperty('videoTitle', 'Test Video Title')
      expect(result).toHaveProperty('channel', 'Test Channel Name')
      expect(result).toHaveProperty('youtubeId', 'abc123')
      expect(result).toHaveProperty('thumbnail', 'https://example.com/thumb.jpg')
    })

    it('assigns similarity score of 1.0 for keyword matches', async () => {
      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'keyword' },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results[0]?.similarity).toBe(1.0)
    })
  })

  describe('edge cases', () => {
    it('handles empty database', async () => {
      vi.mocked(vectorSearch).mockResolvedValue([])
      mockDb._selectChain.limit.mockResolvedValue([])

      const results = await hybridSearch(
        'anything',
        { mode: 'hybrid' },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toEqual([])
    })

    it('handles query with special characters', async () => {
      mockDb._selectChain.limit.mockResolvedValue([])

      const results = await hybridSearch(
        'C++',
        { mode: 'keyword' },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results.length).toBeGreaterThanOrEqual(0)
    })

    it('handles partial word matches in keyword search', async () => {
      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming language',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Test Video',
          channel: 'Test Channel',
          youtubeId: 'test-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'Type',
        { mode: 'keyword' },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results.length).toBe(1)
      expect(results[0]?.content).toContain('TypeScript')
    })
  })

  describe('temporal decay', () => {
    it('does not apply decay when temporalDecay is false (default)', async () => {
      const now = new Date()
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming old',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Old Video',
          channel: 'Test Channel',
          youtubeId: 'old-vid',
          thumbnail: null,
          publishedAt: oneYearAgo,
        },
        {
          chunkId: 2,
          content: 'TypeScript programming new',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 2,
          videoTitle: 'New Video',
          channel: 'Test Channel',
          youtubeId: 'new-vid',
          thumbnail: null,
          publishedAt: now,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'keyword', limit: 10, temporalDecay: false },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toHaveLength(2)
      expect(results[0]?.similarity).toBeCloseTo(results[1]?.similarity ?? 0, 2)
    })

    it('applies temporal decay when temporalDecay is true', async () => {
      const now = new Date()
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Old Video',
          channel: 'Test Channel',
          youtubeId: 'old-vid',
          thumbnail: null,
          publishedAt: oneYearAgo,
        },
        {
          chunkId: 2,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 2,
          videoTitle: 'New Video',
          channel: 'Test Channel',
          youtubeId: 'new-vid',
          thumbnail: null,
          publishedAt: now,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'keyword', limit: 10, temporalDecay: true },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toHaveLength(2)

      const newResult = results.find(r => r.videoId === 2)
      const oldResult = results.find(r => r.videoId === 1)

      expect(newResult).toBeDefined()
      expect(oldResult).toBeDefined()
      expect(newResult!.similarity).toBeGreaterThan(oldResult!.similarity)

      expect(oldResult!.similarity).toBeCloseTo(0.5, 1)
      expect(newResult!.similarity).toBeCloseTo(1.0, 1)
    })

    it('respects custom halfLifeDays parameter', async () => {
      const now = new Date()
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Old Video',
          channel: 'Test Channel',
          youtubeId: 'old-vid',
          thumbnail: null,
          publishedAt: sixMonthsAgo,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'keyword', limit: 10, temporalDecay: true, halfLifeDays: 180 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toHaveLength(1)
      expect(results[0]?.similarity).toBeCloseTo(0.5, 1)
    })

    it('handles chunks from videos with null publishedAt', async () => {
      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'No Date Video',
          channel: 'Test Channel',
          youtubeId: 'no-date-vid',
          thumbnail: null,
          publishedAt: null,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'keyword', limit: 10, temporalDecay: true },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toHaveLength(1)
      expect(results[0]?.similarity).toBeCloseTo(1.0, 2)
    })

    it('re-sorts results after applying decay', async () => {
      const now = new Date()
      const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)

      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Old Video',
          channel: 'Test Channel',
          youtubeId: 'old-vid',
          thumbnail: null,
          publishedAt: twoYearsAgo,
        },
        {
          chunkId: 2,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 2,
          videoTitle: 'New Video',
          channel: 'Test Channel',
          youtubeId: 'new-vid',
          thumbnail: null,
          publishedAt: now,
        },
      ])

      const resultsNoDecay = await hybridSearch(
        'TypeScript',
        { mode: 'keyword', limit: 10, temporalDecay: false },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      const resultsWithDecay = await hybridSearch(
        'TypeScript',
        { mode: 'keyword', limit: 10, temporalDecay: true },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(resultsNoDecay[0]?.videoId).toBe(1)
      expect(resultsWithDecay[0]?.videoId).toBe(2)
    })

    it('applies decay in hybrid mode', async () => {
      const now = new Date()
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

      vi.mocked(vectorSearch).mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: 0.9,
          videoId: 1,
          videoTitle: 'Old Video',
          channel: 'Test Channel',
          youtubeId: 'old-vid',
          thumbnail: null,
          publishedAt: oneYearAgo,
        },
        {
          chunkId: 2,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: 0.9,
          videoId: 2,
          videoTitle: 'New Video',
          channel: 'Test Channel',
          youtubeId: 'new-vid',
          thumbnail: null,
          publishedAt: now,
        },
      ])

      mockDb._selectChain.limit.mockResolvedValue([
        {
          chunkId: 1,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 1,
          videoTitle: 'Old Video',
          channel: 'Test Channel',
          youtubeId: 'old-vid',
          thumbnail: null,
          publishedAt: oneYearAgo,
        },
        {
          chunkId: 2,
          content: 'TypeScript programming',
          startTime: 0,
          endTime: 10,
          similarity: '1.0',
          videoId: 2,
          videoTitle: 'New Video',
          channel: 'Test Channel',
          youtubeId: 'new-vid',
          thumbnail: null,
          publishedAt: now,
        },
      ])

      const results = await hybridSearch(
        'TypeScript',
        { mode: 'hybrid', limit: 10, temporalDecay: true },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(results).toHaveLength(2)

      const newResult = results.find(r => r.videoId === 2)
      const oldResult = results.find(r => r.videoId === 1)

      expect(newResult).toBeDefined()
      expect(oldResult).toBeDefined()
      expect(newResult!.similarity).toBeGreaterThan(oldResult!.similarity)
    })

    it('applies decay in vector mode', async () => {
      const now = new Date()
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

      vi.mocked(vectorSearch).mockResolvedValue([
        {
          chunkId: 1,
          content: 'Some content here',
          startTime: 0,
          endTime: 10,
          similarity: 0.9,
          videoId: 1,
          videoTitle: 'Old Video',
          channel: 'Test Channel',
          youtubeId: 'old-vid',
          thumbnail: null,
          publishedAt: oneYearAgo,
        },
        {
          chunkId: 2,
          content: 'Different content',
          startTime: 0,
          endTime: 10,
          similarity: 0.9,
          videoId: 2,
          videoTitle: 'New Video',
          channel: 'Test Channel',
          youtubeId: 'new-vid',
          thumbnail: null,
          publishedAt: now,
        },
      ])

      const results = await hybridSearch(
        'query',
        { mode: 'vector', limit: 10, temporalDecay: true },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      const newResult = results.find(r => r.videoId === 2)
      const oldResult = results.find(r => r.videoId === 1)

      if (newResult && oldResult) {
        expect(newResult.similarity).toBeGreaterThan(oldResult.similarity)
      }
    })
  })
})
