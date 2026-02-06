import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { setupTestDb, teardownTestDb, getTestDb, schema } from '@/lib/db/__tests__/setup'
import { getRelatedChunks } from '../traverse'

describe('getRelatedChunks', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  describe('normal operation', () => {
    it('returns related chunks from other videos', async () => {
      const db = getTestDb()

      // Create two videos
      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'video-1',
        title: 'First Video',
        channel: 'Test Channel',
        transcript: 'First transcript',
        duration: 600,
      }).returning()

      const [video2] = await db.insert(schema.videos).values({
        youtubeId: 'video-2',
        title: 'Second Video',
        channel: 'Another Channel',
        transcript: 'Second transcript',
        duration: 500,
      }).returning()

      // Create chunks in video 1
      const embedding1 = new Array(384).fill(0.8)
      const [chunk1] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Content from video 1',
        startTime: 10,
        endTime: 20,
        embedding: embedding1,
      }).returning()

      // Create chunk in video 2 with similar embedding
      const [chunk2] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'Related content from video 2',
        startTime: 30,
        endTime: 40,
        embedding: [...embedding1],
      }).returning()

      // Create relationship between chunks
      await db.insert(schema.relationships).values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 0.95,
      })

      const related = await getRelatedChunks(video1!.id, undefined, db)

      expect(related).toHaveLength(1)
      expect(related[0]!.chunkId).toBe(chunk2!.id)
      expect(related[0]!.content).toBe('Related content from video 2')
      expect(related[0]!.startTime).toBe(30)
      expect(related[0]!.endTime).toBe(40)
      expect(related[0]!.similarity).toBe(0.95)
      expect(related[0]!.video).toEqual({
        id: video2!.id,
        title: 'Second Video',
        channel: 'Another Channel',
        youtubeId: 'video-2',
      })
    })

    it('results include video metadata', async () => {
      const db = getTestDb()

      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'source-video',
        title: 'Source Video',
        channel: 'Source Channel',
        transcript: 'Source transcript',
        duration: 600,
      }).returning()

      const [video2] = await db.insert(schema.videos).values({
        youtubeId: 'target-video',
        title: 'Target Video Title',
        channel: 'Target Channel Name',
        transcript: 'Target transcript',
        duration: 700,
      }).returning()

      const embedding = new Array(384).fill(0.9)
      const [chunk1] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Source chunk',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      const [chunk2] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'Target chunk',
        startTime: 5,
        endTime: 15,
        embedding: [...embedding],
      }).returning()

      await db.insert(schema.relationships).values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 0.88,
      })

      const related = await getRelatedChunks(video1!.id, undefined, db)

      expect(related[0]!.video.id).toBe(video2!.id)
      expect(related[0]!.video.title).toBe('Target Video Title')
      expect(related[0]!.video.channel).toBe('Target Channel Name')
      expect(related[0]!.video.youtubeId).toBe('target-video')
    })

    it('sorted by similarity descending', async () => {
      const db = getTestDb()

      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'video-1',
        title: 'Video 1',
        channel: 'Channel 1',
        transcript: 'Transcript 1',
        duration: 600,
      }).returning()

      const [video2] = await db.insert(schema.videos).values({
        youtubeId: 'video-2',
        title: 'Video 2',
        channel: 'Channel 2',
        transcript: 'Transcript 2',
        duration: 500,
      }).returning()

      const embedding = new Array(384).fill(0.7)
      const [sourceChunk] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Source',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      // Create 3 target chunks with different similarities
      const [chunk1] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'Low similarity',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      }).returning()

      const [chunk2] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'High similarity',
        startTime: 10,
        endTime: 20,
        embedding: [...embedding],
      }).returning()

      const [chunk3] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'Medium similarity',
        startTime: 20,
        endTime: 30,
        embedding: [...embedding],
      }).returning()

      await db.insert(schema.relationships).values([
        { sourceChunkId: sourceChunk!.id, targetChunkId: chunk1!.id, similarity: 0.76 },
        { sourceChunkId: sourceChunk!.id, targetChunkId: chunk2!.id, similarity: 0.92 },
        { sourceChunkId: sourceChunk!.id, targetChunkId: chunk3!.id, similarity: 0.84 },
      ])

      const related = await getRelatedChunks(video1!.id, undefined, db)

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
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'lonely-video',
        title: 'Lonely Video',
        channel: 'Test Channel',
        transcript: 'No relationships',
        duration: 600,
      }).returning()

      const embedding = new Array(384).fill(0.5)
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Lonely chunk',
        startTime: 0,
        endTime: 10,
        embedding,
      })

      const related = await getRelatedChunks(video!.id, undefined, db)

      expect(related).toEqual([])
    })

    it('returns empty array when video has no chunks', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'empty-video',
        title: 'Empty Video',
        channel: 'Test Channel',
        transcript: 'No chunks',
        duration: 600,
      }).returning()

      const related = await getRelatedChunks(video!.id, undefined, db)

      expect(related).toEqual([])
    })

    it('returns empty array for non-existent video', async () => {
      const db = getTestDb()

      const related = await getRelatedChunks(999999, undefined, db)

      expect(related).toEqual([])
    })
  })

  describe('options', () => {
    it('respects limit parameter', async () => {
      const db = getTestDb()

      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'video-1',
        title: 'Video 1',
        channel: 'Channel 1',
        transcript: 'Transcript 1',
        duration: 600,
      }).returning()

      const [video2] = await db.insert(schema.videos).values({
        youtubeId: 'video-2',
        title: 'Video 2',
        channel: 'Channel 2',
        transcript: 'Transcript 2',
        duration: 500,
      }).returning()

      const embedding = new Array(384).fill(0.8)
      const [sourceChunk] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Source',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      // Create 5 target chunks
      const targetChunks = []
      for (let i = 0; i < 5; i++) {
        const [chunk] = await db.insert(schema.chunks).values({
          videoId: video2!.id,
          content: `Target ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          embedding: [...embedding],
        }).returning()
        targetChunks.push(chunk!)
      }

      // Create relationships
      for (const chunk of targetChunks) {
        await db.insert(schema.relationships).values({
          sourceChunkId: sourceChunk!.id,
          targetChunkId: chunk.id,
          similarity: 0.85,
        })
      }

      const related = await getRelatedChunks(video1!.id, { limit: 3 }, db)

      expect(related).toHaveLength(3)
    })

    it('respects minSimilarity parameter', async () => {
      const db = getTestDb()

      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'video-1',
        title: 'Video 1',
        channel: 'Channel 1',
        transcript: 'Transcript 1',
        duration: 600,
      }).returning()

      const [video2] = await db.insert(schema.videos).values({
        youtubeId: 'video-2',
        title: 'Video 2',
        channel: 'Channel 2',
        transcript: 'Transcript 2',
        duration: 500,
      }).returning()

      const embedding = new Array(384).fill(0.7)
      const [sourceChunk] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Source',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      // Create chunks with different similarities
      const [highSim] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'High similarity',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      }).returning()

      const [lowSim] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'Low similarity',
        startTime: 10,
        endTime: 20,
        embedding: [...embedding],
      }).returning()

      await db.insert(schema.relationships).values([
        { sourceChunkId: sourceChunk!.id, targetChunkId: highSim!.id, similarity: 0.90 },
        { sourceChunkId: sourceChunk!.id, targetChunkId: lowSim!.id, similarity: 0.70 },
      ])

      // Filter with minSimilarity 0.80
      const related = await getRelatedChunks(video1!.id, { minSimilarity: 0.80 }, db)

      expect(related).toHaveLength(1)
      expect(related[0]!.similarity).toBe(0.90)
      expect(related[0]!.content).toBe('High similarity')
    })

    it('filters out same-video chunks by default', async () => {
      const db = getTestDb()

      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'video-1',
        title: 'Video 1',
        channel: 'Channel 1',
        transcript: 'Transcript 1',
        duration: 600,
      }).returning()

      const [video2] = await db.insert(schema.videos).values({
        youtubeId: 'video-2',
        title: 'Video 2',
        channel: 'Channel 2',
        transcript: 'Transcript 2',
        duration: 500,
      }).returning()

      const embedding = new Array(384).fill(0.8)

      // Create 2 chunks in video 1
      const [chunk1] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Chunk 1 in video 1',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      const [chunk2] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Chunk 2 in video 1',
        startTime: 10,
        endTime: 20,
        embedding: [...embedding],
      }).returning()

      // Create chunk in video 2
      const [chunk3] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'Chunk in video 2',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      }).returning()

      // Create relationships: chunk1 -> chunk2 (same video) and chunk1 -> chunk3 (different video)
      await db.insert(schema.relationships).values([
        { sourceChunkId: chunk1!.id, targetChunkId: chunk2!.id, similarity: 0.95 },
        { sourceChunkId: chunk1!.id, targetChunkId: chunk3!.id, similarity: 0.90 },
      ])

      const related = await getRelatedChunks(video1!.id, undefined, db)

      // Should only return chunk from video 2
      expect(related).toHaveLength(1)
      expect(related[0]!.chunkId).toBe(chunk3!.id)
      expect(related[0]!.video.id).toBe(video2!.id)
    })

    it('includeWithinVideo option works', async () => {
      const db = getTestDb()

      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'video-1',
        title: 'Video 1',
        channel: 'Channel 1',
        transcript: 'Transcript 1',
        duration: 600,
      }).returning()

      const embedding = new Array(384).fill(0.8)

      const [chunk1] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Chunk 1',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      const [chunk2] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Chunk 2',
        startTime: 10,
        endTime: 20,
        embedding: [...embedding],
      }).returning()

      await db.insert(schema.relationships).values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 0.95,
      })

      // With includeWithinVideo: true
      const related = await getRelatedChunks(video1!.id, { includeWithinVideo: true }, db)

      expect(related).toHaveLength(1)
      expect(related[0]!.chunkId).toBe(chunk2!.id)
      expect(related[0]!.video.id).toBe(video1!.id)
    })
  })

  describe('multiple source chunks', () => {
    it('aggregates relationships from multiple chunks in source video', async () => {
      const db = getTestDb()

      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'video-1',
        title: 'Video 1',
        channel: 'Channel 1',
        transcript: 'Transcript 1',
        duration: 600,
      }).returning()

      const [video2] = await db.insert(schema.videos).values({
        youtubeId: 'video-2',
        title: 'Video 2',
        channel: 'Channel 2',
        transcript: 'Transcript 2',
        duration: 500,
      }).returning()

      const embedding = new Array(384).fill(0.8)

      // Create 2 source chunks in video 1
      const [source1] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Source 1',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      const [source2] = await db.insert(schema.chunks).values({
        videoId: video1!.id,
        content: 'Source 2',
        startTime: 10,
        endTime: 20,
        embedding: [...embedding],
      }).returning()

      // Create 2 target chunks in video 2
      const [target1] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'Target 1',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      }).returning()

      const [target2] = await db.insert(schema.chunks).values({
        videoId: video2!.id,
        content: 'Target 2',
        startTime: 10,
        endTime: 20,
        embedding: [...embedding],
      }).returning()

      // Create relationships from both source chunks
      await db.insert(schema.relationships).values([
        { sourceChunkId: source1!.id, targetChunkId: target1!.id, similarity: 0.90 },
        { sourceChunkId: source2!.id, targetChunkId: target2!.id, similarity: 0.85 },
      ])

      const related = await getRelatedChunks(video1!.id, undefined, db)

      // Should return both target chunks
      expect(related).toHaveLength(2)
      expect(related[0]!.similarity).toBe(0.90)
      expect(related[1]!.similarity).toBe(0.85)
    })
  })
})
