import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb, schema } from './setup';
import { searchVideos, getVideoStats } from '../search';

describe('searchVideos (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('returns empty array when no videos exist', async () => {
    const db = getTestDb();
    const results = await searchVideos('test query', db);
    expect(results).toEqual([]);
  });

  it('returns all videos when query is empty', async () => {
    const db = getTestDb();

    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // 1 minute earlier

    // Insert test videos with explicit timestamps
    await db.insert(schema.videos).values([
      {
        youtubeId: 'vid1',
        title: 'First Video',
        channel: 'Channel A',
        transcript: 'Content about TypeScript',
        duration: 600,
        createdAt: earlier,
        updatedAt: earlier,
      },
      {
        youtubeId: 'vid2',
        title: 'Second Video',
        channel: 'Channel B',
        transcript: 'Content about React',
        duration: 900,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const results = await searchVideos('', db);
    expect(results).toHaveLength(2);
    expect(results[0]?.title).toBe('Second Video'); // Most recent first
    expect(results[1]?.title).toBe('First Video');
  });

  it('finds videos by title match using ILIKE', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'vid1',
        title: 'TypeScript Deep Dive',
        channel: 'Dev Channel',
        transcript: 'Video content here',
        duration: 600,
      },
      {
        youtubeId: 'vid2',
        title: 'React Hooks Guide',
        channel: 'Dev Channel',
        transcript: 'Video content here',
        duration: 900,
      },
    ]);

    const results = await searchVideos('typescript', db);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('TypeScript Deep Dive');
  });

  it('finds videos by transcript content', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'vid1',
        title: 'Video One',
        channel: 'Channel A',
        transcript: 'This video discusses async/await patterns',
        duration: 600,
      },
      {
        youtubeId: 'vid2',
        title: 'Video Two',
        channel: 'Channel B',
        transcript: 'This video covers state management',
        duration: 900,
      },
    ]);

    const results = await searchVideos('async/await', db);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Video One');
  });

  it('finds videos by channel name', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'vid1',
        title: 'Video One',
        channel: 'Fireship',
        transcript: 'Content here',
        duration: 600,
      },
      {
        youtubeId: 'vid2',
        title: 'Video Two',
        channel: 'Theo - t3.gg',
        transcript: 'Content here',
        duration: 900,
      },
    ]);

    const results = await searchVideos('fireship', db);
    expect(results).toHaveLength(1);
    expect(results[0]?.channel).toBe('Fireship');
  });

  it('is case insensitive', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'vid1',
        title: 'JavaScript Performance',
        channel: 'Dev Channel',
        transcript: 'Optimizing JavaScript code',
        duration: 600,
      },
    ]);

    // Test uppercase
    const upperResults = await searchVideos('JAVASCRIPT', db);
    expect(upperResults).toHaveLength(1);

    // Test mixed case
    const mixedResults = await searchVideos('JaVaScRiPt', db);
    expect(mixedResults).toHaveLength(1);

    // Test lowercase
    const lowerResults = await searchVideos('javascript', db);
    expect(lowerResults).toHaveLength(1);
  });
});

describe('getVideoStats (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('returns zeros when no videos exist', async () => {
    const db = getTestDb();
    const stats = await getVideoStats(db);
    expect(stats).toEqual({
      count: 0,
      totalHours: 0,
      channels: 0,
    });
  });

  it('counts videos correctly', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'vid1',
        title: 'Video 1',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 600,
      },
      {
        youtubeId: 'vid2',
        title: 'Video 2',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 900,
      },
      {
        youtubeId: 'vid3',
        title: 'Video 3',
        channel: 'Channel B',
        transcript: 'Content',
        duration: 1200,
      },
    ]);

    const stats = await getVideoStats(db);
    expect(stats.count).toBe(3);
  });

  it('calculates total hours correctly', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'vid1',
        title: 'Video 1',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 3600, // 1 hour
      },
      {
        youtubeId: 'vid2',
        title: 'Video 2',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 1800, // 0.5 hours
      },
    ]);

    const stats = await getVideoStats(db);
    expect(stats.totalHours).toBe(1.5); // Rounded to 1 decimal
  });

  it('counts unique channels', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'vid1',
        title: 'Video 1',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 600,
      },
      {
        youtubeId: 'vid2',
        title: 'Video 2',
        channel: 'Channel A', // Same channel
        transcript: 'Content',
        duration: 900,
      },
      {
        youtubeId: 'vid3',
        title: 'Video 3',
        channel: 'Channel B', // Different channel
        transcript: 'Content',
        duration: 1200,
      },
    ]);

    const stats = await getVideoStats(db);
    expect(stats.channels).toBe(2); // Only 2 unique channels
  });
});
