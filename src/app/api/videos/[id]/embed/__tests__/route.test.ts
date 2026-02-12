import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb, schema } from '@/lib/db/__tests__/setup';

// Mock the database to use test db
vi.mock('@/lib/db', async () => {
  const setup = await import('@/lib/db/__tests__/setup');
  const actualSchema = await import('@/lib/db/schema');

  // Create a proxy that lazily gets the test db
  const dbProxy = new Proxy({}, {
    get(_target, prop) {
      const testDb = setup.getTestDb();
      return testDb[prop as keyof typeof testDb];
    }
  });

  return {
    db: dbProxy,
    ...actualSchema,
  };
});

// Mock the embedding service
vi.mock('@/lib/embeddings/service', () => ({
  embedChunks: vi.fn().mockResolvedValue({
    chunks: [
      {
        content: 'Test chunk 1',
        startTime: 0,
        endTime: 5000,
        segmentIndices: [0],
        embedding: new Array(384).fill(0.1),
      },
      {
        content: 'Test chunk 2',
        startTime: 5000,
        endTime: 10000,
        segmentIndices: [1],
        embedding: new Array(384).fill(0.2),
      },
    ],
    totalChunks: 2,
    successCount: 2,
    errorCount: 0,
    durationMs: 500,
    relationshipsCreated: 3,
  }),
}));

// Mock the chunker
vi.mock('@/lib/embeddings/chunker', () => ({
  chunkTranscript: vi.fn().mockReturnValue([
    {
      content: 'Test chunk 1',
      startTime: 0,
      endTime: 5000,
      segmentIndices: [0],
    },
    {
      content: 'Test chunk 2',
      startTime: 5000,
      endTime: 10000,
      segmentIndices: [1],
    },
  ]),
}));

// Mock the transcript parser
vi.mock('@/lib/transcript/parse', () => ({
  parseTranscript: vi.fn().mockReturnValue([
    { text: 'Test segment 1', offset: 0, seconds: 0, timestamp: '0:00' },
    { text: 'Test segment 2', offset: 5000, seconds: 5, timestamp: '0:05' },
  ]),
}));

// Import after mocking
const { POST } = await import('../route');
import { embedChunks } from '@/lib/embeddings/service';
import { chunkTranscript } from '@/lib/embeddings/chunker';

describe('POST /api/videos/[id]/embed (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('returns 404 if video not found', async () => {
    const request = new Request('http://localhost:3000/api/videos/999/embed', {
      method: 'POST',
    });
    const params = Promise.resolve({ id: '999' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({
      success: false,
      error: 'Video not found',
      chunkCount: 0,
    });
  });

  it('returns 400 if video has no transcript', async () => {
    const db = getTestDb();

    // Create video without transcript
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'em-vid-no-transcript',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: null,
        duration: 600,
      })
      .returning();

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/embed`, {
      method: 'POST',
    });
    const params = Promise.resolve({ id: String(video!.id) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Video has no transcript',
      chunkCount: 0,
    });
  });

  it('re-generates embeddings for already embedded video', async () => {
    const db = getTestDb();

    // Create video with transcript
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'em-vid-already-embedded',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: '0:00\nTest content\n0:05\nMore content',
        duration: 600,
      })
      .returning();

    // Create existing chunks with embeddings
    await db.insert(schema.chunks).values([
      {
        videoId: video!.id,
        content: 'Test chunk 1',
        startTime: 0,
        endTime: 5,
        embedding: new Array(384).fill(0.1),
      },
      {
        videoId: video!.id,
        content: 'Test chunk 2',
        startTime: 5,
        endTime: 10,
        embedding: new Array(384).fill(0.2),
      },
    ]);

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/embed`, {
      method: 'POST',
    });
    const params = Promise.resolve({ id: String(video!.id) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      alreadyEmbedded: false,
      chunkCount: 2,
      durationMs: 500,
      relationshipsCreated: 3,
    });

    // Should call embedding service for re-embed
    expect(embedChunks).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
      video!.id
    );
  });

  it('generates embeddings for new video', async () => {
    const db = getTestDb();

    // Create video with transcript but no chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'em-vid-new-embedding',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: '0:00\nTest content\n0:05\nMore content',
        duration: 600,
      })
      .returning();

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/embed`, {
      method: 'POST',
    });
    const params = Promise.resolve({ id: String(video!.id) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      alreadyEmbedded: false,
      chunkCount: 2,
      durationMs: 500,
      relationshipsCreated: 3,
    });

    // Should call chunking and embedding
    expect(chunkTranscript).toHaveBeenCalled();
    expect(embedChunks).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
      video!.id
    );
  });

  it('returns correct response structure on success', async () => {
    const db = getTestDb();

    // Create video with transcript
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'em-vid-response-structure',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: '0:00\nTest content',
        duration: 600,
      })
      .returning();

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/embed`, {
      method: 'POST',
    });
    const params = Promise.resolve({ id: String(video!.id) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('alreadyEmbedded');
    expect(data).toHaveProperty('chunkCount');
    expect(typeof data.success).toBe('boolean');
    expect(typeof data.chunkCount).toBe('number');
  });

  it('includes relationshipsCreated in response when embedding new video', async () => {
    const db = getTestDb();

    // Create video with transcript
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'em-vid-with-relationships',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: '0:00\nTest content',
        duration: 600,
      })
      .returning();

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/embed`, {
      method: 'POST',
    });
    const params = Promise.resolve({ id: String(video!.id) });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('relationshipsCreated', 3);
    expect(typeof data.relationshipsCreated).toBe('number');
  });
});
