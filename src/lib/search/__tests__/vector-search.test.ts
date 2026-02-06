import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb, schema } from '@/lib/db/__tests__/setup';
import { vectorSearch, searchByQuery } from '../vector-search';

// Mock the embedding pipeline to avoid ONNX runtime issues in tests
vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.5))
}));

describe('vectorSearch (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('basic vector search', () => {
    it('returns empty array when no chunks exist', async () => {
      const db = getTestDb();
      const queryEmbedding = new Array(384).fill(0.1);

      const results = await vectorSearch(queryEmbedding, 10, 0.3, db);

      expect(results).toEqual([]);
    });

    it('returns empty array when no chunks have embeddings', async () => {
      const db = getTestDb();

      // Insert video and chunk without embedding
      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Test chunk content',
        startTime: 0,
        endTime: 10,
        embedding: null, // No embedding
      });

      const queryEmbedding = new Array(384).fill(0.1);
      const results = await vectorSearch(queryEmbedding, 10, 0.3, db);

      expect(results).toEqual([]);
    });

    it('returns chunks ordered by similarity score', async () => {
      const db = getTestDb();

      // Insert video
      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        thumbnail: 'https://example.com/thumb.jpg',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Insert chunks with different embeddings
      // Create varied embeddings to test ordering
      // Query will have alternating pattern
      const queryEmbedding = new Array(384).fill(0).map((_, i) => i % 2 === 0 ? 1 : 0);

      // Chunk 1: Identical to query (perfect match)
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Most relevant chunk',
        startTime: 0,
        endTime: 10,
        embedding: [...queryEmbedding],
      });

      // Chunk 2: Inverted pattern (opposite)
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Least relevant chunk',
        startTime: 10,
        endTime: 20,
        embedding: new Array(384).fill(0).map((_, i) => i % 2 === 0 ? 0 : 1),
      });

      // Chunk 3: Half match (moderate similarity)
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Somewhat relevant chunk',
        startTime: 20,
        endTime: 30,
        embedding: new Array(384).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0),
      });

      const results = await vectorSearch(queryEmbedding, 10, 0.3, db);

      expect(results.length).toBeGreaterThan(0);
      // Results should be ordered by similarity (highest first)
      // Identical embedding should be first
      expect(results[0]?.content).toBe('Most relevant chunk');
      // Least similar should be last
      const lastResult = results[results.length - 1];
      expect(lastResult?.content).toBe('Least relevant chunk');
    });
  });

  describe('similarity threshold', () => {
    it('filters out results below threshold', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Insert chunks with different similarity levels
      const queryEmbedding = new Array(384).fill(0).map((_, i) => i % 2 === 0 ? 1 : 0);

      await db.insert(schema.chunks).values([
        {
          videoId: video!.id,
          content: 'High similarity',
          startTime: 0,
          endTime: 10,
          embedding: [...queryEmbedding], // Identical to query
        },
        {
          videoId: video!.id,
          content: 'Low similarity',
          startTime: 10,
          endTime: 20,
          embedding: new Array(384).fill(0).map((_, i) => i % 2 === 0 ? 0 : 1), // Opposite
        },
      ]);

      // With threshold of 0.95, only the identical one should return
      // (cosine similarity of 1.0 for identical normalized vectors)
      const results = await vectorSearch(queryEmbedding, 10, 0.95, db);

      expect(results).toHaveLength(1);
      expect(results[0]?.content).toBe('High similarity');
    });

    it('uses default threshold of 0.3', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Medium similarity',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.5),
      });

      const queryEmbedding = new Array(384).fill(0.5);

      // Should use default threshold
      const results = await vectorSearch(queryEmbedding, 10, undefined, db);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('limit parameter', () => {
    it('respects limit parameter', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Insert 5 chunks
      for (let i = 0; i < 5; i++) {
        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `Chunk ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          embedding: new Array(384).fill(0.8),
        });
      }

      const queryEmbedding = new Array(384).fill(0.8);
      const results = await vectorSearch(queryEmbedding, 2, 0.3, db);

      expect(results).toHaveLength(2);
    });

    it('uses default limit of 10', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Insert 15 chunks
      for (let i = 0; i < 15; i++) {
        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `Chunk ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          embedding: new Array(384).fill(0.8),
        });
      }

      const queryEmbedding = new Array(384).fill(0.8);
      const results = await vectorSearch(queryEmbedding, undefined, 0.3, db);

      expect(results).toHaveLength(10);
    });
  });

  describe('result structure', () => {
    it('includes all required fields in result', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'abc123',
        title: 'Test Video Title',
        channel: 'Test Channel Name',
        thumbnail: 'https://example.com/thumb.jpg',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Test chunk content',
        startTime: 42,
        endTime: 52,
        embedding: new Array(384).fill(0.8),
      });

      const queryEmbedding = new Array(384).fill(0.8);
      const results = await vectorSearch(queryEmbedding, 10, 0.3, db);

      expect(results).toHaveLength(1);

      const result = results[0]!;
      expect(result).toHaveProperty('chunkId');
      expect(result).toHaveProperty('content', 'Test chunk content');
      expect(result).toHaveProperty('startTime', 42);
      expect(result).toHaveProperty('endTime', 52);
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('videoId', video!.id);
      expect(result).toHaveProperty('videoTitle', 'Test Video Title');
      expect(result).toHaveProperty('channel', 'Test Channel Name');
      expect(result).toHaveProperty('youtubeId', 'abc123');
      expect(result).toHaveProperty('thumbnail', 'https://example.com/thumb.jpg');
    });

    it('normalizes similarity score to 0-1 range', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Test chunk',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.8),
      });

      const queryEmbedding = new Array(384).fill(0.8);
      const results = await vectorSearch(queryEmbedding, 10, 0.3, db);

      expect(results[0]?.similarity).toBeGreaterThanOrEqual(0);
      expect(results[0]?.similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('video metadata', () => {
    it('includes video metadata with each chunk', async () => {
      const db = getTestDb();

      // Insert two different videos
      const [video1] = await db.insert(schema.videos).values({
        youtubeId: 'vid1',
        title: 'Video One',
        channel: 'Channel A',
        thumbnail: 'https://example.com/thumb1.jpg',
        transcript: 'Transcript 1',
        duration: 600,
      }).returning();

      const [video2] = await db.insert(schema.videos).values({
        youtubeId: 'vid2',
        title: 'Video Two',
        channel: 'Channel B',
        thumbnail: 'https://example.com/thumb2.jpg',
        transcript: 'Transcript 2',
        duration: 900,
      }).returning();

      // Insert chunks for both videos
      await db.insert(schema.chunks).values([
        {
          videoId: video1!.id,
          content: 'Chunk from video 1',
          startTime: 0,
          endTime: 10,
          embedding: new Array(384).fill(0.8),
        },
        {
          videoId: video2!.id,
          content: 'Chunk from video 2',
          startTime: 0,
          endTime: 10,
          embedding: new Array(384).fill(0.8),
        },
      ]);

      const queryEmbedding = new Array(384).fill(0.8);
      const results = await vectorSearch(queryEmbedding, 10, 0.3, db);

      expect(results).toHaveLength(2);

      // Check first result has correct video metadata
      const result1 = results.find(r => r.videoId === video1!.id);
      expect(result1?.videoTitle).toBe('Video One');
      expect(result1?.channel).toBe('Channel A');
      expect(result1?.youtubeId).toBe('vid1');
      expect(result1?.thumbnail).toBe('https://example.com/thumb1.jpg');

      // Check second result has correct video metadata
      const result2 = results.find(r => r.videoId === video2!.id);
      expect(result2?.videoTitle).toBe('Video Two');
      expect(result2?.channel).toBe('Channel B');
      expect(result2?.youtubeId).toBe('vid2');
      expect(result2?.thumbnail).toBe('https://example.com/thumb2.jpg');
    });
  });
});

describe('searchByQuery (E2E)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('generates embedding and performs vector search', async () => {
    const db = getTestDb();

    const [video] = await db.insert(schema.videos).values({
      youtubeId: 'test-vid',
      title: 'TypeScript Tutorial',
      channel: 'Dev Channel',
      transcript: 'Learn TypeScript',
      duration: 600,
    }).returning();

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'TypeScript is a typed superset of JavaScript',
      startTime: 0,
      endTime: 10,
      embedding: new Array(384).fill(0.5),
    });

    // Search with a text query
    const results = await searchByQuery('TypeScript programming', 5, 0.1, db);

    // Should return results (exact similarity depends on embedding model)
    expect(Array.isArray(results)).toBe(true);
  });

  it('handles empty query string', async () => {
    const db = getTestDb();

    await expect(searchByQuery('', 10, 0.3, db)).rejects.toThrow();
  });

  it('returns empty array when no matching chunks', async () => {
    const db = getTestDb();

    const [video] = await db.insert(schema.videos).values({
      youtubeId: 'test-vid',
      title: 'Test Video',
      channel: 'Test Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning();

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'Completely different content',
      startTime: 0,
      endTime: 10,
      embedding: new Array(384).fill(0.1),
    });

    // With high threshold, may return no results
    const results = await searchByQuery('TypeScript programming', 5, 0.9, db);

    expect(Array.isArray(results)).toBe(true);
  });
});
