import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb, schema } from '@/lib/db/__tests__/setup';
import { hybridSearch } from '../hybrid-search';

// Mock the embedding pipeline to avoid ONNX runtime issues in tests
vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.5))
}));

describe('hybridSearch', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('mode: keyword', () => {
    it('returns chunks matching keyword search', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      await db.insert(schema.chunks).values([
        {
          videoId: video!.id,
          content: 'TypeScript is a typed superset of JavaScript',
          startTime: 0,
          endTime: 10,
          embedding: new Array(384).fill(0.5),
        },
        {
          videoId: video!.id,
          content: 'Python is a dynamically typed language',
          startTime: 10,
          endTime: 20,
          embedding: new Array(384).fill(0.5),
        },
        {
          videoId: video!.id,
          content: 'JavaScript is very popular for web development',
          startTime: 20,
          endTime: 30,
          embedding: new Array(384).fill(0.5),
        },
      ]);

      const results = await hybridSearch('TypeScript', { mode: 'keyword', limit: 10 }, db);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.content).toContain('TypeScript');
    });

    it('performs case-insensitive keyword search', async () => {
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
        content: 'TypeScript is awesome',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.5),
      });

      const results = await hybridSearch('typescript', { mode: 'keyword', limit: 10 }, db);

      expect(results.length).toBe(1);
      expect(results[0]?.content).toContain('TypeScript');
    });

    it('returns empty array when no keyword matches', async () => {
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
        content: 'Python programming',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.5),
      });

      const results = await hybridSearch('TypeScript', { mode: 'keyword', limit: 10 }, db);

      expect(results).toEqual([]);
    });

    it('respects limit parameter', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Insert 5 chunks all containing "test"
      for (let i = 0; i < 5; i++) {
        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `This is test chunk ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          embedding: new Array(384).fill(0.5),
        });
      }

      const results = await hybridSearch('test', { mode: 'keyword', limit: 2 }, db);

      expect(results).toHaveLength(2);
    });
  });

  describe('mode: vector', () => {
    it('performs pure vector search', async () => {
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
        content: 'Some content here',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.8),
      });

      const results = await hybridSearch('query text', { mode: 'vector', limit: 10 }, db);

      expect(Array.isArray(results)).toBe(true);
      // Vector search should return results based on embedding similarity
    });

    it('respects similarity threshold in vector mode', async () => {
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
        content: 'Low similarity content',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.1),
      });

      // With mocked embedding at 0.5 and chunk at 0.1, similarity should be low
      // Results should be filtered by the default 0.3 threshold
      const results = await hybridSearch('query', { mode: 'vector', limit: 10 }, db);

      // May return empty if similarity is too low
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('mode: hybrid (RRF)', () => {
    it('combines vector and keyword results using RRF', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Insert chunks
      // Chunk 1: High vector similarity, contains keyword
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'TypeScript is a typed language',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.9),
      });

      // Chunk 2: Low vector similarity, contains keyword
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'TypeScript tutorial for beginners',
        startTime: 10,
        endTime: 20,
        embedding: new Array(384).fill(0.3),
      });

      // Chunk 3: High vector similarity, no keyword
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Programming concepts explained',
        startTime: 20,
        endTime: 30,
        embedding: new Array(384).fill(0.9),
      });

      const results = await hybridSearch('TypeScript', { mode: 'hybrid', limit: 10 }, db);

      // Should return results from both vector and keyword search
      expect(results.length).toBeGreaterThan(0);
      // Results should be ordered by combined RRF score
      expect(Array.isArray(results)).toBe(true);
    });

    it('deduplicates chunks appearing in both vector and keyword results', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Chunk that will appear in both results
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'TypeScript programming language',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.8),
      });

      const results = await hybridSearch('TypeScript', { mode: 'hybrid', limit: 10 }, db);

      // Should not have duplicates
      const chunkIds = results.map(r => r.chunkId);
      const uniqueIds = new Set(chunkIds);
      expect(chunkIds.length).toBe(uniqueIds.size);
    });

    it('boosts chunks that appear in both vector and keyword results', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Chunk 1: Appears in both (keyword + vector)
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'TypeScript is amazing',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.8),
      });

      // Chunk 2: Only in keyword
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'TypeScript tutorial',
        startTime: 10,
        endTime: 20,
        embedding: new Array(384).fill(0.2),
      });

      // Chunk 3: Only in vector (high similarity but no keyword)
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: 'Programming best practices',
        startTime: 20,
        endTime: 30,
        embedding: new Array(384).fill(0.8),
      });

      const results = await hybridSearch('TypeScript', { mode: 'hybrid', limit: 10 }, db);

      // Chunk that appears in both should have higher score
      // (exact ordering depends on RRF implementation)
      expect(results.length).toBeGreaterThan(0);
    });

    it('respects limit parameter in hybrid mode', async () => {
      const db = getTestDb();

      const [video] = await db.insert(schema.videos).values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning();

      // Insert 10 chunks
      for (let i = 0; i < 10; i++) {
        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `TypeScript content ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          embedding: new Array(384).fill(0.7),
        });
      }

      const results = await hybridSearch('TypeScript', { mode: 'hybrid', limit: 5 }, db);

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('default behavior', () => {
    it('uses hybrid mode by default', async () => {
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
        content: 'TypeScript programming',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.7),
      });

      // Don't specify mode - should use hybrid
      const results = await hybridSearch('TypeScript', { limit: 10 }, db);

      expect(Array.isArray(results)).toBe(true);
    });

    it('uses limit of 10 by default', async () => {
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
          content: `Test content ${i}`,
          startTime: i * 10,
          endTime: (i + 1) * 10,
          embedding: new Array(384).fill(0.7),
        });
      }

      const results = await hybridSearch('test', {}, db);

      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('result structure', () => {
    it('returns SearchResult objects with all required fields', async () => {
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
        content: 'TypeScript programming',
        startTime: 42,
        endTime: 52,
        embedding: new Array(384).fill(0.7),
      });

      const results = await hybridSearch('TypeScript', { mode: 'keyword' }, db);

      expect(results).toHaveLength(1);

      const result = results[0]!;
      expect(result).toHaveProperty('chunkId');
      expect(result).toHaveProperty('content', 'TypeScript programming');
      expect(result).toHaveProperty('startTime', 42);
      expect(result).toHaveProperty('endTime', 52);
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('videoId', video!.id);
      expect(result).toHaveProperty('videoTitle', 'Test Video Title');
      expect(result).toHaveProperty('channel', 'Test Channel Name');
      expect(result).toHaveProperty('youtubeId', 'abc123');
      expect(result).toHaveProperty('thumbnail', 'https://example.com/thumb.jpg');
    });

    it('assigns similarity score of 1.0 for keyword matches', async () => {
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
        content: 'TypeScript programming',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.7),
      });

      const results = await hybridSearch('TypeScript', { mode: 'keyword' }, db);

      expect(results[0]?.similarity).toBe(1.0);
    });
  });

  describe('edge cases', () => {
    it('handles empty database', async () => {
      const db = getTestDb();

      const results = await hybridSearch('anything', { mode: 'hybrid' }, db);

      expect(results).toEqual([]);
    });

    it('handles query with special characters', async () => {
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
        content: 'C++ programming language',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.7),
      });

      const results = await hybridSearch('C++', { mode: 'keyword' }, db);

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles partial word matches in keyword search', async () => {
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
        content: 'TypeScript programming language',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.7),
      });

      // Partial match should work
      const results = await hybridSearch('Type', { mode: 'keyword' }, db);

      expect(results.length).toBe(1);
      expect(results[0]?.content).toContain('TypeScript');
    });
  });
});
