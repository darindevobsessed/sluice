import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractTemporalForVideo } from '../service'
import * as extract from '../extract'
import type { Chunk } from '@/lib/db/schema'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@/lib/db/schema'

// Mock database with proper chaining
interface MockSelectChain {
  from: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
}

interface MockInsertChain {
  values: ReturnType<typeof vi.fn>
}

interface MockDb {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
}

const createMockDb = () => {
  const mockSelectChain: MockSelectChain = {
    from: vi.fn(),
    where: vi.fn(),
  }

  const mockInsertChain: MockInsertChain = {
    values: vi.fn(),
  }

  const mockDb: MockDb = {
    select: vi.fn(() => mockSelectChain),
    insert: vi.fn(() => mockInsertChain),
  }

  mockSelectChain.from.mockReturnValue(mockSelectChain)
  mockSelectChain.where.mockResolvedValue([]) // Default to empty array
  mockInsertChain.values.mockResolvedValue([])

  return { mockDb, mockSelectChain, mockInsertChain }
}

describe('extractTemporalForVideo', () => {
  let mockDb: MockDb
  let mockSelectChain: MockSelectChain
  let mockInsertChain: MockInsertChain

  beforeEach(() => {
    vi.clearAllMocks()
    const mocks = createMockDb()
    mockDb = mocks.mockDb
    mockSelectChain = mocks.mockSelectChain
    mockInsertChain = mocks.mockInsertChain
  })

  it('should extract temporal metadata for chunks with confidence > 0', async () => {
    // Setup: Mock chunks from database
    const mockChunks: Chunk[] = [
      {
        id: 1,
        videoId: 123,
        content: 'React 18 was released in 2022',
        startTime: 0,
        endTime: 10,
        embedding: [],
        createdAt: new Date(),
      },
      {
        id: 2,
        videoId: 123,
        content: 'This is version 3.2.1 of the library',
        startTime: 10,
        endTime: 20,
        embedding: [],
        createdAt: new Date(),
      },
    ]

    // Mock database to return chunks
    mockSelectChain.where.mockResolvedValue(mockChunks)

    // Mock extractTemporalMetadata to return different confidence scores
    const extractSpy = vi.spyOn(extract, 'extractTemporalMetadata')
    extractSpy.mockReturnValueOnce({
      versions: ['React 18'],
      dates: ['2022'],
      confidence: 0.8,
    })
    extractSpy.mockReturnValueOnce({
      versions: ['3.2.1'],
      dates: [],
      confidence: 0.7,
    })

    const result = await extractTemporalForVideo(123, undefined, mockDb as unknown as NodePgDatabase<typeof schema>)

    expect(result.extracted).toBe(2)
    expect(result.skipped).toBe(0)
    expect(extractSpy).toHaveBeenCalledTimes(2)
    expect(mockDb.insert).toHaveBeenCalledTimes(2)
  })

  it('should skip chunks with confidence = 0', async () => {
    const mockChunks: Chunk[] = [
      {
        id: 1,
        videoId: 123,
        content: 'No temporal information here',
        startTime: 0,
        endTime: 10,
        embedding: [],
        createdAt: new Date(),
      },
      {
        id: 2,
        videoId: 123,
        content: 'React 18 released in 2022',
        startTime: 10,
        endTime: 20,
        embedding: [],
        createdAt: new Date(),
      },
    ]

    mockSelectChain.where.mockResolvedValue(mockChunks)

    const extractSpy = vi.spyOn(extract, 'extractTemporalMetadata')
    extractSpy.mockReturnValueOnce({
      versions: [],
      dates: [],
      confidence: 0.0,
    })
    extractSpy.mockReturnValueOnce({
      versions: ['React 18'],
      dates: ['2022'],
      confidence: 0.8,
    })

    const result = await extractTemporalForVideo(123, undefined, mockDb as unknown as NodePgDatabase<typeof schema>)

    expect(result.extracted).toBe(1)
    expect(result.skipped).toBe(1)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('should report progress via callback', async () => {
    const mockChunks: Chunk[] = [
      {
        id: 1,
        videoId: 123,
        content: 'React 18',
        startTime: 0,
        endTime: 10,
        embedding: [],
        createdAt: new Date(),
      },
      {
        id: 2,
        videoId: 123,
        content: 'Vue 3',
        startTime: 10,
        endTime: 20,
        embedding: [],
        createdAt: new Date(),
      },
      {
        id: 3,
        videoId: 123,
        content: 'Angular 15',
        startTime: 20,
        endTime: 30,
        embedding: [],
        createdAt: new Date(),
      },
    ]

    mockSelectChain.where.mockResolvedValue(mockChunks)

    const extractSpy = vi.spyOn(extract, 'extractTemporalMetadata')
    extractSpy.mockReturnValue({
      versions: ['v1'],
      dates: [],
      confidence: 0.5,
    })

    const progressCalls: Array<{ processed: number; total: number }> = []
    const onProgress = (processed: number, total: number) => {
      progressCalls.push({ processed, total })
    }

    await extractTemporalForVideo(123, { onProgress }, mockDb as unknown as NodePgDatabase<typeof schema>)

    expect(progressCalls.length).toBeGreaterThan(0)
    expect(progressCalls[progressCalls.length - 1]).toEqual({
      processed: 3,
      total: 3,
    })
  })

  it('should handle empty video (no chunks)', async () => {
    mockSelectChain.where.mockResolvedValue([])

    const result = await extractTemporalForVideo(123, undefined, mockDb as unknown as NodePgDatabase<typeof schema>)

    expect(result.extracted).toBe(0)
    expect(result.skipped).toBe(0)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('should store version and date mentions correctly', async () => {
    const mockChunks: Chunk[] = [
      {
        id: 1,
        videoId: 123,
        content: 'React 18 and Vue 3 released in 2022',
        startTime: 0,
        endTime: 10,
        embedding: [],
        createdAt: new Date(),
      },
    ]

    mockSelectChain.where.mockResolvedValue(mockChunks)

    const extractSpy = vi.spyOn(extract, 'extractTemporalMetadata')
    extractSpy.mockReturnValue({
      versions: ['React 18', 'Vue 3'],
      dates: ['2022'],
      confidence: 1.0,
    })

    await extractTemporalForVideo(123, undefined, mockDb as unknown as NodePgDatabase<typeof schema>)

    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(mockInsertChain.values).toHaveBeenCalledWith({
      chunkId: 1,
      versionMention: 'React 18, Vue 3',
      releaseDateMention: '2022',
      confidence: 1.0,
    })
  })
})
