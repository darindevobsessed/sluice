import { describe, it, expect } from 'vitest'
import { embedChunks } from '../service'
import type { ChunkData } from '../types'

describe('embedChunks integration', () => {
  it.skip('processes typical transcript in under 5 seconds', async () => {
    // Generate realistic chunk data (50-100 chunks for typical transcript)
    const chunks: ChunkData[] = Array.from({ length: 75 }, (_, i) => ({
      content: `This is chunk ${i} with some realistic content that might appear in a transcript. It contains multiple sentences and is of reasonable length to test actual embedding performance.`,
      startTime: i * 5000,
      endTime: (i + 1) * 5000,
      segmentIndices: [i]
    }))

    const startTime = performance.now()
    const result = await embedChunks(chunks)
    const duration = performance.now() - startTime

    expect(result.successCount).toBe(75)
    expect(result.errorCount).toBe(0)
    expect(duration).toBeLessThan(5000) // 5 second target
  }, 10000) // Allow 10 seconds for test timeout

  it.skip('handles 100+ chunks efficiently', async () => {
    const chunks: ChunkData[] = Array.from({ length: 150 }, (_, i) => ({
      content: `Chunk ${i}: Some test content for embedding`,
      startTime: i * 1000,
      endTime: (i + 1) * 1000,
      segmentIndices: [i]
    }))

    const startTime = performance.now()
    const result = await embedChunks(chunks)
    const duration = performance.now() - startTime

    expect(result.successCount).toBe(150)
    expect(result.errorCount).toBe(0)

    // Should take less than 10 seconds for 150 chunks
    expect(duration).toBeLessThan(10000)
  }, 15000)
})
