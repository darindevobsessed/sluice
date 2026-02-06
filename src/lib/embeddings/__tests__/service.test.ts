import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ChunkData } from '../types'

// Mock the pipeline module
vi.mock('../pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.1))
}))

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn()
  },
  chunks: {} // Mock table reference
}))

// Mock the graph module
vi.mock('@/lib/graph', () => ({
  computeRelationships: vi.fn().mockResolvedValue({ created: 5, skipped: 0 })
}))

import { embedChunks } from '../service'
import { generateEmbedding } from '../pipeline'
import { db } from '@/lib/db'
import { computeRelationships } from '@/lib/graph'

describe('embedChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic embedding generation', () => {
    it('generates embeddings for all chunks', async () => {
      const inputChunks: ChunkData[] = [
        { content: 'First chunk', startTime: 0, endTime: 5000, segmentIndices: [0] },
        { content: 'Second chunk', startTime: 5000, endTime: 10000, segmentIndices: [1] },
        { content: 'Third chunk', startTime: 10000, endTime: 15000, segmentIndices: [2] }
      ]

      const result = await embedChunks(inputChunks)

      expect(result.chunks).toHaveLength(3)
      expect(result.successCount).toBe(3)
      expect(result.errorCount).toBe(0)
      expect(result.totalChunks).toBe(3)
      expect(generateEmbedding).toHaveBeenCalledTimes(3)

      // Verify each chunk has an embedding
      result.chunks.forEach(chunk => {
        expect(chunk.embedding).toBeInstanceOf(Array)
        expect(chunk.embedding.length).toBe(384)
        expect(chunk.error).toBeUndefined()
      })
    })

    it('returns empty result for empty chunks array', async () => {
      const result = await embedChunks([])

      expect(result.chunks).toHaveLength(0)
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(0)
      expect(result.totalChunks).toBe(0)
      expect(generateEmbedding).not.toHaveBeenCalled()
    })
  })

  describe('progress callback', () => {
    it('calls progress callback with correct values after each batch', async () => {
      const inputChunks: ChunkData[] = Array.from({ length: 10 }, (_, i) => ({
        content: `Chunk ${i}`,
        startTime: i * 1000,
        endTime: (i + 1) * 1000,
        segmentIndices: [i]
      }))

      const progressCalls: Array<{ current: number; total: number }> = []
      const onProgress = vi.fn((current: number, total: number) => {
        progressCalls.push({ current, total })
      })

      await embedChunks(inputChunks, onProgress)

      // Should be called at least once
      expect(onProgress).toHaveBeenCalled()

      // Verify progress values are sensible
      progressCalls.forEach(call => {
        expect(call.current).toBeGreaterThanOrEqual(0)
        expect(call.current).toBeLessThanOrEqual(call.total)
        expect(call.total).toBe(10)
      })

      // Last call should show completion
      const lastCall = progressCalls[progressCalls.length - 1]
      expect(lastCall?.current).toBe(10)
    })

    it('does not throw if progress callback is not provided', async () => {
      const inputChunks: ChunkData[] = [
        { content: 'Test chunk', startTime: 0, endTime: 5000, segmentIndices: [0] }
      ]

      await expect(embedChunks(inputChunks)).resolves.not.toThrow()
    })
  })

  describe('batch processing', () => {
    it('respects batch size of 32', async () => {
      // Create 100 chunks to test batching
      const inputChunks: ChunkData[] = Array.from({ length: 100 }, (_, i) => ({
        content: `Chunk ${i}`,
        startTime: i * 1000,
        endTime: (i + 1) * 1000,
        segmentIndices: [i]
      }))

      const progressCalls: number[] = []
      const onProgress = vi.fn((current: number) => {
        progressCalls.push(current)
      })

      await embedChunks(inputChunks, onProgress)

      // Progress should be called multiple times (at least once per batch)
      expect(onProgress.mock.calls.length).toBeGreaterThan(1)

      // Check that batching is happening by verifying progress increments
      // With batch size of 32, we expect progress to jump by ~32 each time
      const increments = progressCalls.slice(1).map((val, i) => val - progressCalls[i]!)
      const hasBatchSizeIncrements = increments.some(inc => inc > 1 && inc <= 32)
      expect(hasBatchSizeIncrements).toBe(true)
    })

    it('handles chunks count not divisible by batch size', async () => {
      // 50 chunks with batch size 32 = 2 batches (32 + 18)
      const inputChunks: ChunkData[] = Array.from({ length: 50 }, (_, i) => ({
        content: `Chunk ${i}`,
        startTime: i * 1000,
        endTime: (i + 1) * 1000,
        segmentIndices: [i]
      }))

      const result = await embedChunks(inputChunks)

      expect(result.successCount).toBe(50)
      expect(result.chunks).toHaveLength(50)
    })
  })

  describe('error handling', () => {
    it('continues processing when single chunk fails', async () => {
      const mockGenerateEmbedding = generateEmbedding as ReturnType<typeof vi.fn>

      // Make the second chunk fail
      mockGenerateEmbedding
        .mockResolvedValueOnce(new Float32Array(384).fill(0.1))
        .mockRejectedValueOnce(new Error('Embedding failed'))
        .mockResolvedValueOnce(new Float32Array(384).fill(0.1))

      const inputChunks: ChunkData[] = [
        { content: 'First chunk', startTime: 0, endTime: 5000, segmentIndices: [0] },
        { content: 'Second chunk', startTime: 5000, endTime: 10000, segmentIndices: [1] },
        { content: 'Third chunk', startTime: 10000, endTime: 15000, segmentIndices: [2] }
      ]

      const result = await embedChunks(inputChunks)

      expect(result.totalChunks).toBe(3)
      expect(result.successCount).toBe(2)
      expect(result.errorCount).toBe(1)

      // Check that error is marked on the failed chunk
      expect(result.chunks[1]?.error).toBeDefined()
      expect(result.chunks[1]?.error).toContain('Embedding failed')

      // Other chunks should succeed
      expect(result.chunks[0]?.error).toBeUndefined()
      expect(result.chunks[2]?.error).toBeUndefined()
    })

    it('returns all chunks even with multiple errors', async () => {
      const mockGenerateEmbedding = generateEmbedding as ReturnType<typeof vi.fn>

      // All chunks fail
      mockGenerateEmbedding
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))

      const inputChunks: ChunkData[] = [
        { content: 'First chunk', startTime: 0, endTime: 5000, segmentIndices: [0] },
        { content: 'Second chunk', startTime: 5000, endTime: 10000, segmentIndices: [1] },
        { content: 'Third chunk', startTime: 10000, endTime: 15000, segmentIndices: [2] }
      ]

      const result = await embedChunks(inputChunks)

      expect(result.totalChunks).toBe(3)
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(3)
      expect(result.chunks).toHaveLength(3)

      // All chunks should have errors
      result.chunks.forEach(chunk => {
        expect(chunk.error).toBeDefined()
      })
    })
  })

  describe('result structure', () => {
    it('includes correct counts in result', async () => {
      const inputChunks: ChunkData[] = [
        { content: 'Chunk 1', startTime: 0, endTime: 5000, segmentIndices: [0] },
        { content: 'Chunk 2', startTime: 5000, endTime: 10000, segmentIndices: [1] }
      ]

      const result = await embedChunks(inputChunks)

      expect(result).toHaveProperty('chunks')
      expect(result).toHaveProperty('totalChunks')
      expect(result).toHaveProperty('successCount')
      expect(result).toHaveProperty('errorCount')
      expect(result).toHaveProperty('durationMs')

      expect(result.totalChunks).toBe(2)
      expect(result.successCount).toBe(2)
      expect(result.errorCount).toBe(0)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('tracks duration in milliseconds', async () => {
      const inputChunks: ChunkData[] = [
        { content: 'Test chunk', startTime: 0, endTime: 5000, segmentIndices: [0] }
      ]

      const result = await embedChunks(inputChunks)

      expect(typeof result.durationMs).toBe('number')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      expect(result.durationMs).toBeLessThan(10000) // Should be fast with mocks
    })
  })

  describe('database storage', () => {
    it('stores chunks to database when videoId provided', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 1 }])
      })

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      })

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        return await callback({
          insert: mockInsert,
          delete: mockDelete
        })
      })

      // Update mocks
      vi.mocked(db).insert = mockInsert
      vi.mocked(db).delete = mockDelete
      vi.mocked(db).transaction = mockTransaction

      const inputChunks: ChunkData[] = [
        { content: 'Chunk 1', startTime: 0, endTime: 5000, segmentIndices: [0] },
        { content: 'Chunk 2', startTime: 5000, endTime: 10000, segmentIndices: [1] }
      ]

      await embedChunks(inputChunks, undefined, 123)

      expect(mockTransaction).toHaveBeenCalled()
      expect(mockDelete).toHaveBeenCalled()
      expect(mockInsert).toHaveBeenCalled()
    })

    it('does not store to database when videoId not provided', async () => {
      const mockTransaction = vi.fn()
      vi.mocked(db).transaction = mockTransaction

      const inputChunks: ChunkData[] = [
        { content: 'Chunk 1', startTime: 0, endTime: 5000, segmentIndices: [0] }
      ]

      await embedChunks(inputChunks)

      expect(mockTransaction).not.toHaveBeenCalled()
    })

    it('uses transaction for atomicity', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([])
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        }
        return await callback(mockTx)
      })

      vi.mocked(db).transaction = mockTransaction

      const inputChunks: ChunkData[] = [
        { content: 'Test chunk', startTime: 0, endTime: 5000, segmentIndices: [0] }
      ]

      await embedChunks(inputChunks, undefined, 456)

      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })

    it('rolls back transaction on complete failure', async () => {
      const mockTransaction = vi.fn().mockRejectedValue(new Error('Database error'))
      vi.mocked(db).transaction = mockTransaction

      const mockGenerateEmbedding = generateEmbedding as ReturnType<typeof vi.fn>
      mockGenerateEmbedding.mockResolvedValue(new Float32Array(384).fill(0.1))

      const inputChunks: ChunkData[] = [
        { content: 'Test chunk', startTime: 0, endTime: 5000, segmentIndices: [0] }
      ]

      // Should throw when database transaction fails
      await expect(embedChunks(inputChunks, undefined, 789)).rejects.toThrow('Database error')
    })
  })

  describe('relationship computation', () => {
    it('calls computeRelationships after embedding with videoId', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([])
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        }
        return await callback(mockTx)
      })

      vi.mocked(db).transaction = mockTransaction
      vi.mocked(computeRelationships).mockResolvedValue({ created: 5, skipped: 0 })

      const inputChunks: ChunkData[] = [
        { content: 'Chunk 1', startTime: 0, endTime: 5000, segmentIndices: [0] },
        { content: 'Chunk 2', startTime: 5000, endTime: 10000, segmentIndices: [1] }
      ]

      const result = await embedChunks(inputChunks, undefined, 123)

      expect(computeRelationships).toHaveBeenCalledWith(123)
      expect(result.relationshipsCreated).toBe(5)
    })

    it('does not call computeRelationships when videoId not provided', async () => {
      vi.mocked(computeRelationships).mockClear()

      const inputChunks: ChunkData[] = [
        { content: 'Chunk 1', startTime: 0, endTime: 5000, segmentIndices: [0] }
      ]

      await embedChunks(inputChunks)

      expect(computeRelationships).not.toHaveBeenCalled()
    })

    it('continues successfully even if relationship computation fails', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([])
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        }
        return await callback(mockTx)
      })

      vi.mocked(db).transaction = mockTransaction
      vi.mocked(computeRelationships).mockRejectedValue(new Error('Relationship computation failed'))

      const inputChunks: ChunkData[] = [
        { content: 'Chunk 1', startTime: 0, endTime: 5000, segmentIndices: [0] }
      ]

      // Should not throw - embedding should succeed despite relationship error
      const result = await embedChunks(inputChunks, undefined, 456)

      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(0)
      expect(result.relationshipsCreated).toBe(0)
      expect(computeRelationships).toHaveBeenCalledWith(456)
    })

    it('sets relationshipsCreated to 0 if computation fails', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([])
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        }
        return await callback(mockTx)
      })

      vi.mocked(db).transaction = mockTransaction
      vi.mocked(computeRelationships).mockRejectedValue(new Error('Graph error'))

      const inputChunks: ChunkData[] = [
        { content: 'Test', startTime: 0, endTime: 5000, segmentIndices: [0] }
      ]

      const result = await embedChunks(inputChunks, undefined, 789)

      expect(result).toHaveProperty('relationshipsCreated', 0)
    })
  })
})
