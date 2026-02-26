/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRelatedChunks } from '../traverse'
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

describe('getRelatedChunks', () => {
  let mockDb: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
  })

  describe('normal operation', () => {
    it('returns related chunks from other videos', async () => {
      // Step 1: get chunk IDs for the source video
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          // chunk IDs for source video
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          } as any
        }
        // Step 2: find related chunks with joins
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        chunkId: 2,
                        content: 'Related content from video 2',
                        startTime: 30,
                        endTime: 40,
                        similarity: 0.95,
                        videoId: 2,
                        videoTitle: 'Second Video',
                        channel: 'Another Channel',
                        youtubeId: 'video-2',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toHaveLength(1)
      expect(related[0]!.chunkId).toBe(2)
      expect(related[0]!.content).toBe('Related content from video 2')
      expect(related[0]!.startTime).toBe(30)
      expect(related[0]!.endTime).toBe(40)
      expect(related[0]!.similarity).toBe(0.95)
      expect(related[0]!.video).toEqual({
        id: 2,
        title: 'Second Video',
        channel: 'Another Channel',
        youtubeId: 'video-2',
      })
    })

    it('results include video metadata', async () => {
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        chunkId: 2,
                        content: 'Target chunk',
                        startTime: 5,
                        endTime: 15,
                        similarity: 0.88,
                        videoId: 2,
                        videoTitle: 'Target Video Title',
                        channel: 'Target Channel Name',
                        youtubeId: 'target-video',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related[0]!.video.id).toBe(2)
      expect(related[0]!.video.title).toBe('Target Video Title')
      expect(related[0]!.video.channel).toBe('Target Channel Name')
      expect(related[0]!.video.youtubeId).toBe('target-video')
    })

    it('sorted by similarity descending', async () => {
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        chunkId: 2,
                        content: 'High similarity',
                        startTime: 10,
                        endTime: 20,
                        similarity: 0.92,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                      {
                        chunkId: 3,
                        content: 'Medium similarity',
                        startTime: 20,
                        endTime: 30,
                        similarity: 0.84,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                      {
                        chunkId: 4,
                        content: 'Low similarity',
                        startTime: 0,
                        endTime: 10,
                        similarity: 0.76,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toHaveLength(3)
      expect(related[0]!.similarity).toBe(0.92)
      expect(related[0]!.content).toBe('High similarity')
      expect(related[1]!.similarity).toBe(0.84)
      expect(related[1]!.content).toBe('Medium similarity')
      expect(related[2]!.similarity).toBe(0.76)
      expect(related[2]!.content).toBe('Low similarity')
    })
  })

  describe('edge cases', () => {
    it('empty results return empty array', async () => {
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          // Video has chunks but no relationships
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toEqual([])
    })

    it('returns empty array when video has no chunks', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any))

      const related = await getRelatedChunks(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toEqual([])
    })

    it('returns empty array for non-existent video', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any))

      const related = await getRelatedChunks(
        999999,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toEqual([])
    })
  })

  describe('options', () => {
    it('respects limit parameter', async () => {
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        chunkId: 2,
                        content: 'Target 0',
                        startTime: 0,
                        endTime: 10,
                        similarity: 0.90,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                      {
                        chunkId: 3,
                        content: 'Target 1',
                        startTime: 10,
                        endTime: 20,
                        similarity: 0.88,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                      {
                        chunkId: 4,
                        content: 'Target 2',
                        startTime: 20,
                        endTime: 30,
                        similarity: 0.85,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        { limit: 3 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toHaveLength(3)
    })

    it('respects minSimilarity parameter', async () => {
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          } as any
        }
        // DB returns only results above minSimilarity (filtered via SQL WHERE)
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        chunkId: 2,
                        content: 'High similarity',
                        startTime: 0,
                        endTime: 10,
                        similarity: 0.90,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        { minSimilarity: 0.80 },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toHaveLength(1)
      expect(related[0]!.similarity).toBe(0.90)
      expect(related[0]!.content).toBe('High similarity')
    })

    it('filters out same-video chunks by default', async () => {
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
            }),
          } as any
        }
        // Only cross-video result returned (same-video filtered by ne() in WHERE)
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        chunkId: 3,
                        content: 'Chunk in video 2',
                        startTime: 0,
                        endTime: 10,
                        similarity: 0.90,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toHaveLength(1)
      expect(related[0]!.chunkId).toBe(3)
      expect(related[0]!.video.id).toBe(2)
    })

    it('includeWithinVideo option works', async () => {
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }]),
            }),
          } as any
        }
        // Same-video chunk returned when includeWithinVideo is true
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        chunkId: 2,
                        content: 'Chunk 2',
                        startTime: 10,
                        endTime: 20,
                        similarity: 0.95,
                        videoId: 1,
                        videoTitle: 'Video 1',
                        channel: 'Channel 1',
                        youtubeId: 'video-1',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        { includeWithinVideo: true },
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toHaveLength(1)
      expect(related[0]!.chunkId).toBe(2)
      expect(related[0]!.video.id).toBe(1)
    })
  })

  describe('multiple source chunks', () => {
    it('aggregates relationships from multiple chunks in source video', async () => {
      let selectCallIdx = 0
      mockDb.select.mockImplementation(() => {
        selectCallIdx++
        if (selectCallIdx === 1) {
          // Source video has 2 chunks
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      {
                        chunkId: 3,
                        content: 'Target 1',
                        startTime: 0,
                        endTime: 10,
                        similarity: 0.90,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                      {
                        chunkId: 4,
                        content: 'Target 2',
                        startTime: 10,
                        endTime: 20,
                        similarity: 0.85,
                        videoId: 2,
                        videoTitle: 'Video 2',
                        channel: 'Channel 2',
                        youtubeId: 'video-2',
                      },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        } as any
      })

      const related = await getRelatedChunks(
        1,
        undefined,
        mockDb as unknown as NodePgDatabase<typeof schema>,
      )

      expect(related).toHaveLength(2)
      expect(related[0]!.similarity).toBe(0.90)
      expect(related[1]!.similarity).toBe(0.85)
    })
  })
})
