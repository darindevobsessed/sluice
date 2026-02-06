import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@/lib/db/schema';

// Mock the embedding pipeline to avoid ONNX runtime issues in tests
vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.5)),
}));

// Setup test database
const TEST_DATABASE_URL =
  process.env.DATABASE_URL?.replace(/\/goldminer$/, '/goldminer_test') ??
  'postgresql://goldminer:goldminer@localhost:5432/goldminer_test';

let pool: Pool;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

// Mock the database module to use test database
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return {
    ...actual,
    get db() {
      return testDb;
    },
  };
});

// Import after mocking
const { GET } = await import('../route');

describe('GET /api/search', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    testDb = drizzle(pool, { schema });
  });

  beforeEach(async () => {
    // Clean tables before each test
    await pool.query('TRUNCATE videos, insights, channels, settings, chunks CASCADE');
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('returns empty results for empty query', async () => {
    const request = new Request('http://localhost:3000/api/search?q=');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      chunks: [],
      videos: [],
      query: '',
      mode: 'hybrid',
      timing: 0,
      hasEmbeddings: false,
    });
  });

  it('returns empty results for missing query parameter', async () => {
    const request = new Request('http://localhost:3000/api/search');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      chunks: [],
      videos: [],
      query: '',
      mode: 'hybrid',
      timing: 0,
      hasEmbeddings: false,
    });
  });

  it('returns both chunk and video results', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'test-vid',
        title: 'TypeScript Tutorial',
        channel: 'Dev Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

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
        content: 'TypeScript provides better tooling',
        startTime: 10,
        endTime: 20,
        embedding: new Array(384).fill(0.5),
      },
    ]);

    const request = new Request('http://localhost:3000/api/search?q=TypeScript');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.query).toBe('TypeScript');
    expect(data.mode).toBe('hybrid');
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks.length).toBeGreaterThan(0);
    expect(data.videos).toBeInstanceOf(Array);
    expect(data.videos.length).toBeGreaterThan(0);
    expect(data.hasEmbeddings).toBe(true);
    expect(typeof data.timing).toBe('number');
    expect(data.timing).toBeGreaterThanOrEqual(0);
  });

  it('respects limit parameter for chunks', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

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

    const request = new Request('http://localhost:3000/api/search?q=TypeScript&limit=3');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.chunks.length).toBeLessThanOrEqual(3);
  });

  it('respects limit parameter for videos', async () => {
    const db = testDb;

    // Create 5 videos with chunks
    for (let i = 0; i < 5; i++) {
      const [video] = await db
        .insert(schema.videos)
        .values({
          youtubeId: `vid-${i}`,
          title: `TypeScript Video ${i}`,
          channel: 'Test Channel',
          transcript: 'Test transcript',
          duration: 600,
        })
        .returning();

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `TypeScript content ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.7),
      });
    }

    const request = new Request('http://localhost:3000/api/search?q=TypeScript&limit=2');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos.length).toBeLessThanOrEqual(2);
  });

  it('uses default limit of 10', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

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

    const request = new Request('http://localhost:3000/api/search?q=test');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.chunks.length).toBeLessThanOrEqual(10);
  });

  it('respects mode parameter: keyword', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'TypeScript is great',
      startTime: 0,
      endTime: 10,
      embedding: new Array(384).fill(0.5),
    });

    const request = new Request('http://localhost:3000/api/search?q=TypeScript&mode=keyword');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mode).toBe('keyword');
    expect(data.chunks.length).toBeGreaterThan(0);
  });

  it('respects mode parameter: vector', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'Some content',
      startTime: 0,
      endTime: 10,
      embedding: new Array(384).fill(0.8),
    });

    const request = new Request('http://localhost:3000/api/search?q=content&mode=vector');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mode).toBe('vector');
  });

  it('uses hybrid mode by default', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mode).toBe('hybrid');
  });

  it('video results include all required fields', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'abc123',
        title: 'TypeScript Tutorial',
        channel: 'Dev Channel',
        thumbnail: 'https://example.com/thumb.jpg',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'TypeScript is great',
      startTime: 42,
      endTime: 52,
      embedding: new Array(384).fill(0.7),
    });

    const request = new Request('http://localhost:3000/api/search?q=TypeScript');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(1);

    const videoResult = data.videos[0];
    expect(videoResult).toHaveProperty('videoId', video!.id);
    expect(videoResult).toHaveProperty('youtubeId', 'abc123');
    expect(videoResult).toHaveProperty('title', 'TypeScript Tutorial');
    expect(videoResult).toHaveProperty('channel', 'Dev Channel');
    expect(videoResult).toHaveProperty('thumbnail', 'https://example.com/thumb.jpg');
    expect(videoResult).toHaveProperty('score');
    expect(videoResult).toHaveProperty('matchedChunks', 1);
    expect(videoResult).toHaveProperty('bestChunk');
    expect(videoResult.bestChunk).toHaveProperty('content', 'TypeScript is great');
    expect(videoResult.bestChunk).toHaveProperty('startTime', 42);
    expect(videoResult.bestChunk).toHaveProperty('similarity');
  });

  it('aggregates multiple chunks from same video', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'test-vid',
        title: 'TypeScript Guide',
        channel: 'Dev Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    await db.insert(schema.chunks).values([
      {
        videoId: video!.id,
        content: 'TypeScript is great',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.7),
      },
      {
        videoId: video!.id,
        content: 'TypeScript has types',
        startTime: 10,
        endTime: 20,
        embedding: new Array(384).fill(0.9),
      },
      {
        videoId: video!.id,
        content: 'TypeScript compiles',
        startTime: 20,
        endTime: 30,
        embedding: new Array(384).fill(0.6),
      },
    ]);

    const request = new Request('http://localhost:3000/api/search?q=TypeScript');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.videos).toHaveLength(1);
    expect(data.videos[0]?.matchedChunks).toBe(3);
    expect(data.chunks.length).toBeGreaterThanOrEqual(3);
  });

  it('handles database with no embeddings', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    // Insert chunk without embedding
    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'TypeScript content',
      startTime: 0,
      endTime: 10,
      embedding: null, // No embedding
    });

    const request = new Request('http://localhost:3000/api/search?q=TypeScript');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasEmbeddings).toBe(false);
  });

  it('includes cache headers', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test');

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=60');
  });

  it('handles invalid mode parameter gracefully', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test&mode=invalid');

    const response = await GET(request);

    // Should default to hybrid
    expect(response.status).toBe(200);
    // TypeScript will enforce valid mode, but at runtime it might fall through
  });

  it('handles invalid limit parameter', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test&limit=abc');

    const response = await GET(request);

    expect(response.status).toBe(200);
    // Should use default limit
  });

  it('handles very large limit parameter', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test&limit=9999');

    const response = await GET(request);

    expect(response.status).toBe(200);
    // Should work but return fewer results than limit
  });

  it('handles query with special characters', async () => {
    const db = testDb;

    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'test-vid',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning();

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'C++ programming language',
      startTime: 0,
      endTime: 10,
      embedding: new Array(384).fill(0.7),
    });

    const request = new Request('http://localhost:3000/api/search?q=C%2B%2B');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.query).toBe('C++');
  });

  it('returns timing measurement', async () => {
    const request = new Request('http://localhost:3000/api/search?q=test');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(typeof data.timing).toBe('number');
    expect(data.timing).toBeGreaterThanOrEqual(0);
  });
});
