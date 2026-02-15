import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDb, teardownTestDb, getTestDb, schema } from '@/lib/db/__tests__/setup'
import { computeRelationships } from '../compute-relationships'

describe('computeRelationships', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  describe('normal operation', () => {
    it('creates relationships between similar chunks', async () => {
      const db = getTestDb()

      // Insert video
      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      // Insert chunks with similar embeddings
      // Using identical embeddings to guarantee similarity > 0.75
      const embedding1 = new Array(384).fill(0).map((_, i) => i % 2 === 0 ? 1 : 0)
      const embedding2 = [...embedding1] // Identical (similarity = 1.0)
      const embedding3 = new Array(384).fill(0).map((_, i) => i % 3 === 0 ? 1 : 0) // Somewhat different

      const [chunk1] = await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'First chunk',
        startTime: 0,
        endTime: 10,
        embedding: embedding1,
      }).returning()

      const [chunk2] = await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Second chunk',
        startTime: 10,
        endTime: 20,
        embedding: embedding2,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Third chunk',
        startTime: 20,
        endTime: 30,
        embedding: embedding3,
      })

      // Compute relationships
      const result = await computeRelationships(video!.id, undefined, db)

      expect(result.created).toBeGreaterThan(0)
      expect(result.skipped).toBeGreaterThanOrEqual(0)

      // Verify relationships were created
      const relationships = await db
        .select()
        .from(schema.relationships)

      expect(relationships.length).toBeGreaterThan(0)

      // Check that at least chunk1 -> chunk2 relationship exists (they're identical)
      const chunk1ToChunk2 = relationships.find(
        r => r.sourceChunkId === chunk1!.id && r.targetChunkId === chunk2!.id
      )
      expect(chunk1ToChunk2).toBeDefined()
      expect(chunk1ToChunk2!.similarity).toBeGreaterThan(0.75)
    })

    it('returns correct counts', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      // Insert 3 chunks with high similarity
      const embedding = new Array(384).fill(0.8)
      for (let i = 0; i < 3; i++) {
        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `Chunk ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          embedding,
        })
      }

      const result = await computeRelationships(video!.id, undefined, db)

      // With 3 chunks and bidirectional relationships:
      // 3 pairs (0-1, 0-2, 1-2) × 2 directions = 6 relationships
      expect(result.created).toBe(6)
    })
  })

  describe('threshold filtering', () => {
    it('only creates relationships above threshold', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      // Chunk 1 and 2: high similarity (identical)
      const highSimilarityEmbedding = new Array(384).fill(0.9)

      await db.insert(schema.chunks).values([
        {
          videoId: video!.id,
          content: 'High similarity 1',
          startTime: 0,
          endTime: 10,
          embedding: highSimilarityEmbedding,
        },
        {
          videoId: video!.id,
          content: 'High similarity 2',
          startTime: 10,
          endTime: 20,
          embedding: [...highSimilarityEmbedding],
        },
        {
          videoId: video!.id,
          content: 'Low similarity',
          startTime: 20,
          endTime: 30,
          // Opposite embedding (low similarity)
          embedding: new Array(384).fill(-0.9),
        },
      ])

      // Use default threshold 0.75
      const result = await computeRelationships(video!.id, undefined, db)

      // Should only create relationship between first two chunks (bidirectional = 2 rows)
      expect(result.created).toBe(2)
    })

    it('respects custom threshold', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      const embedding = new Array(384).fill(0.8)
      await db.insert(schema.chunks).values([
        {
          videoId: video!.id,
          content: 'Chunk 1',
          startTime: 0,
          endTime: 10,
          embedding,
        },
        {
          videoId: video!.id,
          content: 'Chunk 2',
          startTime: 10,
          endTime: 20,
          embedding: [...embedding],
        },
      ])

      // With threshold 0.99, identical embeddings should still pass (bidirectional = 2 rows)
      const result = await computeRelationships(video!.id, { threshold: 0.99 }, db)

      expect(result.created).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('handles empty video (no chunks)', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'empty-vid',
        title: 'Empty Video',
        channel: 'Test Channel',
        transcript: 'No chunks',
        duration: 600,
      }).returning()

      const result = await computeRelationships(video!.id, undefined, db)

      expect(result.created).toBe(0)
      expect(result.skipped).toBe(0)
    })

    it('handles video with single chunk', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'single-chunk',
        title: 'Single Chunk Video',
        channel: 'Test Channel',
        transcript: 'One chunk only',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Only chunk',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.5),
      })

      const result = await computeRelationships(video!.id, undefined, db)

      // No relationships possible with single chunk
      expect(result.created).toBe(0)
    })

    it('handles chunks without embeddings', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'no-embeddings',
        title: 'No Embeddings Video',
        channel: 'Test Channel',
        transcript: 'Chunks without embeddings',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values([
        {
          videoId: video!.id,
          content: 'Chunk 1',
          startTime: 0,
          endTime: 10,
          embedding: null,
        },
        {
          videoId: video!.id,
          content: 'Chunk 2',
          startTime: 10,
          endTime: 20,
          embedding: null,
        },
      ])

      const result = await computeRelationships(video!.id, undefined, db)

      // Should create no relationships (no embeddings to compare)
      expect(result.created).toBe(0)
      expect(result.skipped).toBe(0)
    })

    it('skips self-relationships', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      const [chunk] = await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Test chunk',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.5),
      }).returning()

      await computeRelationships(video!.id, undefined, db)

      // Verify no self-relationship (A->A)
      const allRelationships = await db
        .select()
        .from(schema.relationships)

      const selfRelationship = allRelationships.find(
        r => r.sourceChunkId === chunk!.id && r.targetChunkId === chunk!.id
      )

      expect(selfRelationship).toBeUndefined()
    })

    it('prevents duplicate relationships on re-run', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      const embedding = new Array(384).fill(0.8)
      await db.insert(schema.chunks).values([
        {
          videoId: video!.id,
          content: 'Chunk 1',
          startTime: 0,
          endTime: 10,
          embedding,
        },
        {
          videoId: video!.id,
          content: 'Chunk 2',
          startTime: 10,
          endTime: 20,
          embedding: [...embedding],
        },
      ])

      // First run (bidirectional = 2 rows)
      const result1 = await computeRelationships(video!.id, undefined, db)
      expect(result1.created).toBe(2)

      // Second run - SQL finds same pair again, attempts to create bidirectional (4 attempts total)
      const result2 = await computeRelationships(video!.id, undefined, db)
      expect(result2.created).toBe(0) // No new relationships
      expect(result2.skipped).toBe(4) // 2 pairs × 2 directions = 4 skipped
    })
  })

  describe('progress callback', () => {
    it('calls progress callback with updates', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      const embedding = new Array(384).fill(0.8)
      // Insert 5 chunks
      for (let i = 0; i < 5; i++) {
        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `Chunk ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          embedding: [...embedding],
        })
      }

      const progressCalls: Array<{ processed: number; total: number }> = []
      const onProgress = vi.fn((processed: number, total: number) => {
        progressCalls.push({ processed, total })
      })

      await computeRelationships(video!.id, { onProgress }, db)

      // Should have called progress callback
      expect(onProgress).toHaveBeenCalled()
      expect(progressCalls.length).toBeGreaterThan(0)

      // Verify total is consistent
      const totalValue = progressCalls[0]?.total
      expect(progressCalls.every(call => call.total === totalValue)).toBe(true)

      // Verify processed increases
      if (progressCalls.length > 1) {
        expect(progressCalls[progressCalls.length - 1]!.processed).toBeGreaterThanOrEqual(
          progressCalls[0]!.processed
        )
      }
    })

    it('works without progress callback', async () => {
      const db = getTestDb()

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      const embedding = new Array(384).fill(0.8)
      await db.insert(schema.chunks).values([
        {
          videoId: video!.id,
          content: 'Chunk 1',
          startTime: 0,
          endTime: 10,
          embedding,
        },
        {
          videoId: video!.id,
          content: 'Chunk 2',
          startTime: 10,
          endTime: 20,
          embedding: [...embedding],
        },
      ])

      // Should not throw without progress callback
      await expect(computeRelationships(video!.id, undefined, db)).resolves.toBeDefined()
    })
  })

  describe('cross-video relationships', () => {
    it('creates relationships between chunks from different videos', async () => {
      const db = getTestDb()

      // Create two videos
      const [videoA] = await db.insert(schema.videos).values({
        youtubeId: 'video-a',
        title: 'Video A',
        channel: 'Test Channel',
        transcript: 'Video A transcript',
        duration: 600,
      }).returning()

      const [videoB] = await db.insert(schema.videos).values({
        youtubeId: 'video-b',
        title: 'Video B',
        channel: 'Test Channel',
        transcript: 'Video B transcript',
        duration: 600,
      }).returning()

      // Create chunks with similar embeddings across videos
      const similarEmbedding = new Array(384).fill(0.9)

      const [chunkA] = await db.insert(schema.chunks).values({
        videoId: videoA!.id,
        content: 'Chunk from Video A',
        startTime: 0,
        endTime: 10,
        embedding: similarEmbedding,
      }).returning()

      const [chunkB] = await db.insert(schema.chunks).values({
        videoId: videoB!.id,
        content: 'Chunk from Video B',
        startTime: 0,
        endTime: 10,
        embedding: [...similarEmbedding],
      }).returning()

      // Compute relationships for video A
      const result = await computeRelationships(videoA!.id, undefined, db)

      expect(result.created).toBeGreaterThan(0)

      // Verify cross-video relationship exists (A -> B)
      const allRelationships = await db
        .select()
        .from(schema.relationships)

      const crossVideoRelationship = allRelationships.find(
        r => r.sourceChunkId === chunkA!.id && r.targetChunkId === chunkB!.id
      )

      expect(crossVideoRelationship).toBeDefined()
      expect(crossVideoRelationship!.similarity).toBeGreaterThan(0.75)
    })

    it('creates bidirectional relationships', async () => {
      const db = getTestDb()

      // Create two videos
      const [videoA] = await db.insert(schema.videos).values({
        youtubeId: 'video-a',
        title: 'Video A',
        channel: 'Test Channel',
        transcript: 'Video A transcript',
        duration: 600,
      }).returning()

      const [videoB] = await db.insert(schema.videos).values({
        youtubeId: 'video-b',
        title: 'Video B',
        channel: 'Test Channel',
        transcript: 'Video B transcript',
        duration: 600,
      }).returning()

      // Create chunks with similar embeddings
      const embedding = new Array(384).fill(0.9)

      const [chunkA] = await db.insert(schema.chunks).values({
        videoId: videoA!.id,
        content: 'Chunk from Video A',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      const [chunkB] = await db.insert(schema.chunks).values({
        videoId: videoB!.id,
        content: 'Chunk from Video B',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      }).returning()

      // Compute relationships for video A
      await computeRelationships(videoA!.id, undefined, db)

      // Verify BOTH directions exist (A -> B and B -> A)
      const allRelationships = await db
        .select()
        .from(schema.relationships)

      const aToB = allRelationships.find(
        r => r.sourceChunkId === chunkA!.id && r.targetChunkId === chunkB!.id
      )
      const bToA = allRelationships.find(
        r => r.sourceChunkId === chunkB!.id && r.targetChunkId === chunkA!.id
      )

      expect(aToB).toBeDefined()
      expect(bToA).toBeDefined()
      expect(aToB!.similarity).toBe(bToA!.similarity)
    })

    it('enables traverse.ts to find relationships from either direction', async () => {
      const db = getTestDb()

      // Create two videos
      const [videoA] = await db.insert(schema.videos).values({
        youtubeId: 'video-a',
        title: 'Video A',
        channel: 'Test Channel',
        transcript: 'Video A transcript',
        duration: 600,
      }).returning()

      const [videoB] = await db.insert(schema.videos).values({
        youtubeId: 'video-b',
        title: 'Video B',
        channel: 'Test Channel',
        transcript: 'Video B transcript',
        duration: 600,
      }).returning()

      // Create chunks with similar embeddings
      const embedding = new Array(384).fill(0.9)

      await db.insert(schema.chunks).values({
        videoId: videoA!.id,
        content: 'Chunk from Video A',
        startTime: 0,
        endTime: 10,
        embedding,
      })

      await db.insert(schema.chunks).values({
        videoId: videoB!.id,
        content: 'Chunk from Video B',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      })

      // Compute relationships for video A only
      await computeRelationships(videoA!.id, undefined, db)

      // Query from video B's perspective (should find relationship due to bidirectional insert)
      const relationshipsFromB = await db
        .select()
        .from(schema.relationships)
        .innerJoin(schema.chunks, eq(schema.relationships.sourceChunkId, schema.chunks.id))
        .where(eq(schema.chunks.videoId, videoB!.id))

      expect(relationshipsFromB.length).toBeGreaterThan(0)
    })

    it('compares against all existing chunks not just same video', async () => {
      const db = getTestDb()

      // Create three videos
      const [videoA] = await db.insert(schema.videos).values({
        youtubeId: 'video-a',
        title: 'Video A',
        channel: 'Test Channel',
        transcript: 'Video A transcript',
        duration: 600,
      }).returning()

      const [videoB] = await db.insert(schema.videos).values({
        youtubeId: 'video-b',
        title: 'Video B',
        channel: 'Test Channel',
        transcript: 'Video B transcript',
        duration: 600,
      }).returning()

      const [videoC] = await db.insert(schema.videos).values({
        youtubeId: 'video-c',
        title: 'Video C',
        channel: 'Test Channel',
        transcript: 'Video C transcript',
        duration: 600,
      }).returning()

      // Create similar chunks across all videos
      const embedding = new Array(384).fill(0.9)

      const [chunkA] = await db.insert(schema.chunks).values({
        videoId: videoA!.id,
        content: 'Chunk from Video A',
        startTime: 0,
        endTime: 10,
        embedding,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: videoB!.id,
        content: 'Chunk from Video B',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      })

      await db.insert(schema.chunks).values({
        videoId: videoC!.id,
        content: 'Chunk from Video C',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      })

      // Compute relationships for video A
      await computeRelationships(videoA!.id, undefined, db)

      // Count relationships from chunk A
      const relationshipsFromA = await db
        .select()
        .from(schema.relationships)
        .where(eq(schema.relationships.sourceChunkId, chunkA!.id))

      // Should have relationships to both B and C
      expect(relationshipsFromA.length).toBeGreaterThanOrEqual(2)
    })
  })
})
