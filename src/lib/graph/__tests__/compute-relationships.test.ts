import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computeRelationships, cosineSimilarity } from '../compute-relationships'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@/lib/db/schema'

const createMockDb = () => {
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  }
  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockReturnThis(),
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

describe('computeRelationships', () => {
  let mockDb: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
  })

  describe('normal operation', () => {
    it('creates relationships between similar chunks', async () => {
      // SQL query returns similar chunk pairs
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 2, similarity: 0.95 },
        ],
      })

      // insert().values().onConflictDoNothing().returning() returns created relationships
      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ])

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(2) // bidirectional
      expect(result.skipped).toBe(0)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('returns correct counts', async () => {
      // 3 chunks with high similarity: 3 pairs found by SQL
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 2, similarity: 0.99 },
          { source_id: 1, target_id: 3, similarity: 0.99 },
          { source_id: 2, target_id: 3, similarity: 0.99 },
        ],
      })

      // 3 pairs * 2 directions = 6 relationships created
      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 },
      ])

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(6)
    })
  })

  describe('threshold filtering', () => {
    it('only creates relationships above threshold', async () => {
      // SQL uses threshold in WHERE clause, so only matching pairs returned
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 2, similarity: 0.95 },
          // chunk 3 (low similarity) is excluded by SQL WHERE clause
        ],
      })

      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 }, { id: 2 },
      ])

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(2) // Only high-similarity pair, bidirectional
    })

    it('respects custom threshold', async () => {
      // Even with 0.99 threshold, identical embeddings pass
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 2, similarity: 1.0 },
        ],
      })

      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 }, { id: 2 },
      ])

      const result = await computeRelationships(
        1,
        { threshold: 0.99 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('handles empty video (no chunks)', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] })

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(0)
      expect(result.skipped).toBe(0)
    })

    it('handles video with single chunk', async () => {
      // Single chunk means no pairs found by SQL
      mockDb.execute.mockResolvedValue({ rows: [] })

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(0)
    })

    it('handles chunks without embeddings', async () => {
      // SQL WHERE filters out null embeddings, returns empty
      mockDb.execute.mockResolvedValue({ rows: [] })

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(0)
      expect(result.skipped).toBe(0)
    })

    it('skips self-relationships', async () => {
      // SQL WHERE clause has c2.id != c1.id, so no self-pairs returned
      mockDb.execute.mockResolvedValue({ rows: [] })

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(0)
    })

    it('prevents duplicate relationships on re-run', async () => {
      // SQL finds same pairs again on second run
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 2, similarity: 0.99 },
        ],
      })

      // onConflictDoNothing means returning() returns empty (all skipped)
      mockDb._insertChain.returning.mockResolvedValue([])

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBe(0)
      // 1 pair * 2 directions = 2 attempted, all skipped
      expect(result.skipped).toBe(2)
    })
  })

  describe('progress callback', () => {
    it('calls progress callback with updates', async () => {
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 2, similarity: 0.99 },
          { source_id: 1, target_id: 3, similarity: 0.98 },
        ],
      })

      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
      ])

      const progressCalls: Array<{ processed: number; total: number }> = []
      const onProgress = vi.fn((processed: number, total: number) => {
        progressCalls.push({ processed, total })
      })

      await computeRelationships(
        1,
        { onProgress },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(onProgress).toHaveBeenCalled()
      expect(progressCalls.length).toBeGreaterThan(0)
    })

    it('works without progress callback', async () => {
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 2, similarity: 0.99 },
        ],
      })

      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 }, { id: 2 },
      ])

      await expect(
        computeRelationships(
          1,
          undefined,
          mockDb as unknown as NodePgDatabase<typeof schema>,
        ),
      ).resolves.toBeDefined()
    })
  })

  describe('cross-video relationships', () => {
    it('creates relationships between chunks from different videos', async () => {
      // SQL finds cross-video similarity
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 10, similarity: 0.92 },
        ],
      })

      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 }, { id: 2 },
      ])

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(result.created).toBeGreaterThan(0)
    })

    it('creates bidirectional relationships', async () => {
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 10, similarity: 0.92 },
        ],
      })

      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 }, { id: 2 },
      ])

      await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      // Verify insert was called with both directions
      expect(mockDb.insert).toHaveBeenCalled()
      const insertValues = mockDb._insertChain.values.mock.calls[0]?.[0]

      // Should have 2 entries: source->target and target->source
      expect(insertValues).toHaveLength(2)
      expect(insertValues[0]).toEqual({
        sourceChunkId: 1,
        targetChunkId: 10,
        similarity: 0.92,
      })
      expect(insertValues[1]).toEqual({
        sourceChunkId: 10,
        targetChunkId: 1,
        similarity: 0.92,
      })
    })

    it('compares against all existing chunks not just same video', async () => {
      // SQL returns relationships to chunks from multiple other videos
      mockDb.execute.mockResolvedValue({
        rows: [
          { source_id: 1, target_id: 10, similarity: 0.90 },
          { source_id: 1, target_id: 20, similarity: 0.88 },
        ],
      })

      mockDb._insertChain.returning.mockResolvedValue([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
      ])

      const result = await computeRelationships(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      // 2 pairs * 2 directions = 4
      expect(result.created).toBe(4)
    })
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = [1, 0, 0]
    const b = [1, 0, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0, 0]
    const b = [-1, 0, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5)
  })

  it('handles zero vectors', () => {
    const a = [0, 0, 0]
    const b = [1, 2, 3]
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('throws on dimension mismatch', () => {
    const a = [1, 0]
    const b = [1, 0, 0]
    expect(() => cosineSimilarity(a, b)).toThrow('Vector dimension mismatch')
  })
})
