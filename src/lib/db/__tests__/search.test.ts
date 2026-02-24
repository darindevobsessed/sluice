import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb, schema } from './setup';
import { searchVideos, getVideoStats, getDistinctChannels } from '../search';

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
        youtubeId: 'ds-vid1',
        title: 'First Video',
        channel: 'Channel A',
        transcript: 'Content about TypeScript',
        duration: 600,
        createdAt: earlier,
        updatedAt: earlier,
      },
      {
        youtubeId: 'ds-vid2',
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
        youtubeId: 'ds-vid1',
        title: 'TypeScript Deep Dive',
        channel: 'Dev Channel',
        transcript: 'Video content here',
        duration: 600,
      },
      {
        youtubeId: 'ds-vid2',
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

  it('finds videos by channel name', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'ds-vid1',
        title: 'Video One',
        channel: 'Fireship',
        transcript: 'Content here',
        duration: 600,
      },
      {
        youtubeId: 'ds-vid2',
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
        youtubeId: 'ds-vid1',
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

  it('excludes transcript from returned results', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'ds-vid1',
        title: 'Video With Transcript',
        channel: 'Channel A',
        transcript: 'This is a long transcript that should not be in the response',
        duration: 600,
      },
    ]);

    const results = await searchVideos('', db);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Video With Transcript');
    // Verify transcript is NOT in the returned object
    expect('transcript' in results[0]!).toBe(false);
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
        youtubeId: 'ds-vid1',
        title: 'Video 1',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 600,
      },
      {
        youtubeId: 'ds-vid2',
        title: 'Video 2',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 900,
      },
      {
        youtubeId: 'ds-vid3',
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
        youtubeId: 'ds-vid1',
        title: 'Video 1',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 3600, // 1 hour
      },
      {
        youtubeId: 'ds-vid2',
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
        youtubeId: 'ds-vid1',
        title: 'Video 1',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 600,
      },
      {
        youtubeId: 'ds-vid2',
        title: 'Video 2',
        channel: 'Channel A', // Same channel
        transcript: 'Content',
        duration: 900,
      },
      {
        youtubeId: 'ds-vid3',
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

describe('getDistinctChannels (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('returns empty array when no videos exist', async () => {
    const db = getTestDb();
    const creators = await getDistinctChannels(db);
    expect(creators).toEqual([]);
  });

  it('returns single channel with correct video count', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'ds-vid1',
        title: 'Video 1',
        channel: 'Solo Creator',
        transcript: 'Content',
        duration: 600,
      },
    ]);

    const creators = await getDistinctChannels(db);
    expect(creators).toEqual([
      { channel: 'Solo Creator', videoCount: 1 },
    ]);
  });

  it('returns multiple channels with correct video counts', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'ds-vid1',
        title: 'Video 1',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 600,
      },
      {
        youtubeId: 'ds-vid2',
        title: 'Video 2',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 900,
      },
      {
        youtubeId: 'ds-vid3',
        title: 'Video 3',
        channel: 'Channel B',
        transcript: 'Content',
        duration: 1200,
      },
    ]);

    const creators = await getDistinctChannels(db);
    expect(creators).toHaveLength(2);
    expect(creators).toContainEqual({ channel: 'Channel A', videoCount: 2 });
    expect(creators).toContainEqual({ channel: 'Channel B', videoCount: 1 });
  });

  it('sorts channels by video count descending', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'ds-vid1',
        title: 'Video 1',
        channel: 'Small Channel',
        transcript: 'Content',
        duration: 600,
      },
      {
        youtubeId: 'ds-vid2',
        title: 'Video 2',
        channel: 'Big Channel',
        transcript: 'Content',
        duration: 900,
      },
      {
        youtubeId: 'ds-vid3',
        title: 'Video 3',
        channel: 'Big Channel',
        transcript: 'Content',
        duration: 1200,
      },
      {
        youtubeId: 'ds-vid4',
        title: 'Video 4',
        channel: 'Big Channel',
        transcript: 'Content',
        duration: 1500,
      },
      {
        youtubeId: 'ds-vid5',
        title: 'Video 5',
        channel: 'Medium Channel',
        transcript: 'Content',
        duration: 1800,
      },
      {
        youtubeId: 'ds-vid6',
        title: 'Video 6',
        channel: 'Medium Channel',
        transcript: 'Content',
        duration: 2100,
      },
    ]);

    const creators = await getDistinctChannels(db);
    expect(creators).toEqual([
      { channel: 'Big Channel', videoCount: 3 },
      { channel: 'Medium Channel', videoCount: 2 },
      { channel: 'Small Channel', videoCount: 1 },
    ]);
  });

  it('handles channels with identical video counts', async () => {
    const db = getTestDb();

    await db.insert(schema.videos).values([
      {
        youtubeId: 'ds-vid1',
        title: 'Video 1',
        channel: 'Channel A',
        transcript: 'Content',
        duration: 600,
      },
      {
        youtubeId: 'ds-vid2',
        title: 'Video 2',
        channel: 'Channel B',
        transcript: 'Content',
        duration: 900,
      },
    ]);

    const creators = await getDistinctChannels(db);
    expect(creators).toHaveLength(2);
    // Both should have videoCount: 1
    expect(creators.every(c => c.videoCount === 1)).toBe(true);
    // Should contain both channels
    const channels = creators.map(c => c.channel);
    expect(channels).toContain('Channel A');
    expect(channels).toContain('Channel B');
  });
});
