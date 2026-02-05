import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type DatabaseInstance } from '../index';

describe('FTS5 Search', () => {
  let dbInstance: DatabaseInstance;

  beforeEach(() => {
    // Create an in-memory database for each test
    dbInstance = createDatabase(':memory:');
  });

  afterEach(() => {
    dbInstance.close();
  });

  describe('searchVideos', () => {
    it('returns empty array when no videos exist', () => {
      const results = dbInstance.searchVideos('');
      expect(results).toEqual([]);
    });

    it('returns all videos when query is empty', () => {
      // Insert test videos
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, duration, transcript)
        VALUES
          ('vid1', 'React Tutorial', 'Channel A', 3600, 'Learn React basics'),
          ('vid2', 'Vue Guide', 'Channel B', 1800, 'Vue fundamentals');
      `);

      const results = dbInstance.searchVideos('');
      expect(results).toHaveLength(2);
    });

    it('returns all videos when query is whitespace', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, duration, transcript)
        VALUES ('vid1', 'Test Video', 'Channel', 100, 'content');
      `);

      const results = dbInstance.searchVideos('   ');
      expect(results).toHaveLength(1);
    });

    it('returns videos sorted by created_at desc when no query', () => {
      // Insert videos with explicit timestamps
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, created_at)
        VALUES
          ('old', 'Old Video', 'Channel', 1000),
          ('new', 'New Video', 'Channel', 2000);
      `);

      const results = dbInstance.searchVideos('');
      expect(results[0]?.youtubeId).toBe('new');
      expect(results[1]?.youtubeId).toBe('old');
    });

    it('finds videos by title match', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES
          ('vid1', 'React Hooks Tutorial', 'Channel', 'some content'),
          ('vid2', 'Vue Composition API', 'Channel', 'other content');
      `);

      const results = dbInstance.searchVideos('React');
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('React Hooks Tutorial');
    });

    it('finds videos by transcript content', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES
          ('vid1', 'Video One', 'Channel', 'useState is a React hook'),
          ('vid2', 'Video Two', 'Channel', 'computed properties in Vue');
      `);

      const results = dbInstance.searchVideos('useState');
      expect(results).toHaveLength(1);
      expect(results[0]?.youtubeId).toBe('vid1');
    });

    it('finds videos by channel name', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES
          ('vid1', 'Tutorial', 'Fireship', 'content'),
          ('vid2', 'Guide', 'ThePrimeagen', 'content');
      `);

      const results = dbInstance.searchVideos('Fireship');
      expect(results).toHaveLength(1);
      expect(results[0]?.channel).toBe('Fireship');
    });

    it('handles special characters in query', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'Cpp Tutorial', 'Channel', 'Learn Cpp basics');
      `);

      // Should not crash with special chars (+ gets escaped to space)
      const results = dbInstance.searchVideos('C++');
      expect(Array.isArray(results)).toBe(true);
      // After escaping, "C++" becomes "C", which might match "Cpp"
    });

    it('handles parentheses in query', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'Function calls', 'Channel', 'Learn about functions');
      `);

      // Should not crash with parentheses
      const results = dbInstance.searchVideos('function()');
      expect(Array.isArray(results)).toBe(true);
    });

    it('handles quotes in query', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'Learn "React"', 'Channel', 'content');
      `);

      const results = dbInstance.searchVideos('"React"');
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns multiple matching videos', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES
          ('vid1', 'JavaScript Basics', 'Channel A', 'Learn JS'),
          ('vid2', 'Advanced JavaScript', 'Channel B', 'Master JS'),
          ('vid3', 'Python Guide', 'Channel C', 'Learn Python');
      `);

      const results = dbInstance.searchVideos('JavaScript');
      expect(results).toHaveLength(2);
    });

    it('is case insensitive', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'TypeScript Guide', 'Channel', 'content');
      `);

      const results = dbInstance.searchVideos('typescript');
      expect(results).toHaveLength(1);
    });
  });

  describe('FTS rebuild', () => {
    it('indexes pre-existing data when FTS table is created', () => {
      // This tests the scenario where videos exist before FTS is set up
      // Simulate by dropping FTS, inserting data, then recreating

      // First, drop the FTS table and triggers
      dbInstance.sqlite.exec(`
        DROP TRIGGER IF EXISTS videos_ai;
        DROP TRIGGER IF EXISTS videos_au;
        DROP TRIGGER IF EXISTS videos_ad;
        DROP TABLE IF EXISTS videos_fts;
      `);

      // Insert a video WITHOUT FTS (no triggers exist)
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'Claude Tutorial', 'Channel', 'Learn about Claude AI assistant');
      `);

      // Recreate FTS table with triggers
      dbInstance.sqlite.exec(`
        CREATE VIRTUAL TABLE videos_fts USING fts5(
          title, transcript, channel,
          content='videos', content_rowid='id'
        );

        CREATE TRIGGER videos_ai AFTER INSERT ON videos BEGIN
          INSERT INTO videos_fts(rowid, title, transcript, channel)
          VALUES (new.id, new.title, new.transcript, new.channel);
        END;
      `);

      // Without rebuild, search should NOT find the video (FTS is empty)
      const beforeRebuild = dbInstance.searchVideos('Claude');
      expect(beforeRebuild).toHaveLength(0);

      // Rebuild the FTS index
      dbInstance.sqlite.exec("INSERT INTO videos_fts(videos_fts) VALUES('rebuild');");

      // After rebuild, search SHOULD find the video
      const afterRebuild = dbInstance.searchVideos('Claude');
      expect(afterRebuild).toHaveLength(1);
      expect(afterRebuild[0]?.title).toBe('Claude Tutorial');
    });

    it('finds transcript content after FTS rebuild', () => {
      // Drop and recreate to simulate production scenario
      dbInstance.sqlite.exec(`
        DROP TRIGGER IF EXISTS videos_ai;
        DROP TRIGGER IF EXISTS videos_au;
        DROP TRIGGER IF EXISTS videos_ad;
        DROP TABLE IF EXISTS videos_fts;
      `);

      // Insert video with transcript containing search term
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'Moltbot Video', 'AI Channel',
          'This video discusses claude and how it powers the new AI assistant called Moltbot.');
      `);

      // Recreate FTS with rebuild
      dbInstance.sqlite.exec(`
        CREATE VIRTUAL TABLE videos_fts USING fts5(
          title, transcript, channel,
          content='videos', content_rowid='id'
        );
        INSERT INTO videos_fts(videos_fts) VALUES('rebuild');
      `);

      // Search for term in transcript should work
      const results = dbInstance.searchVideos('claude');
      expect(results).toHaveLength(1);
      expect(results[0]?.transcript).toContain('claude');
    });
  });

  describe('FTS sync triggers', () => {
    it('syncs FTS on insert', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'Searchable Title', 'Channel', 'content');
      `);

      const results = dbInstance.searchVideos('Searchable');
      expect(results).toHaveLength(1);
    });

    it('syncs FTS on update', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'Original Title', 'Channel', 'content');
      `);

      // Verify original is searchable
      expect(dbInstance.searchVideos('Original')).toHaveLength(1);

      // Update the title
      dbInstance.sqlite.exec(`
        UPDATE videos SET title = 'Updated Title' WHERE youtube_id = 'vid1';
      `);

      // Original term should not match
      expect(dbInstance.searchVideos('Original')).toHaveLength(0);
      // New term should match
      expect(dbInstance.searchVideos('Updated')).toHaveLength(1);
    });

    it('syncs FTS on delete', () => {
      dbInstance.sqlite.exec(`
        INSERT INTO videos (youtube_id, title, channel, transcript)
        VALUES ('vid1', 'Delete Me', 'Channel', 'content');
      `);

      expect(dbInstance.searchVideos('Delete')).toHaveLength(1);

      dbInstance.sqlite.exec(`DELETE FROM videos WHERE youtube_id = 'vid1';`);

      expect(dbInstance.searchVideos('Delete')).toHaveLength(0);
    });
  });
});

describe('getVideoStats', () => {
  let dbInstance: DatabaseInstance;

  beforeEach(() => {
    dbInstance = createDatabase(':memory:');
  });

  afterEach(() => {
    dbInstance.close();
  });

  it('returns zeros when no videos exist', () => {
    const stats = dbInstance.getVideoStats();
    expect(stats).toEqual({
      count: 0,
      totalHours: 0,
      channels: 0,
    });
  });

  it('counts videos correctly', () => {
    dbInstance.sqlite.exec(`
      INSERT INTO videos (youtube_id, title, channel)
      VALUES
        ('vid1', 'Video 1', 'Channel'),
        ('vid2', 'Video 2', 'Channel'),
        ('vid3', 'Video 3', 'Channel');
    `);

    const stats = dbInstance.getVideoStats();
    expect(stats.count).toBe(3);
  });

  it('calculates total hours correctly', () => {
    dbInstance.sqlite.exec(`
      INSERT INTO videos (youtube_id, title, channel, duration)
      VALUES
        ('vid1', 'Video 1', 'Channel', 3600),
        ('vid2', 'Video 2', 'Channel', 1800);
    `);
    // 3600 + 1800 = 5400 seconds = 1.5 hours

    const stats = dbInstance.getVideoStats();
    expect(stats.totalHours).toBe(1.5);
  });

  it('handles null durations', () => {
    dbInstance.sqlite.exec(`
      INSERT INTO videos (youtube_id, title, channel, duration)
      VALUES
        ('vid1', 'Video 1', 'Channel', 3600),
        ('vid2', 'Video 2', 'Channel', NULL);
    `);

    const stats = dbInstance.getVideoStats();
    expect(stats.totalHours).toBe(1); // Only counts the 3600 seconds = 1 hour
  });

  it('counts unique channels', () => {
    dbInstance.sqlite.exec(`
      INSERT INTO videos (youtube_id, title, channel)
      VALUES
        ('vid1', 'Video 1', 'Channel A'),
        ('vid2', 'Video 2', 'Channel A'),
        ('vid3', 'Video 3', 'Channel B'),
        ('vid4', 'Video 4', 'Channel C');
    `);

    const stats = dbInstance.getVideoStats();
    expect(stats.channels).toBe(3);
  });

  it('rounds hours to one decimal place', () => {
    // 7200 seconds = 2.0 hours
    // 600 seconds = 0.166... hours
    // Total = 2.166... should round to 2.2
    dbInstance.sqlite.exec(`
      INSERT INTO videos (youtube_id, title, channel, duration)
      VALUES
        ('vid1', 'Video 1', 'Channel', 7200),
        ('vid2', 'Video 2', 'Channel', 600);
    `);

    const stats = dbInstance.getVideoStats();
    expect(stats.totalHours).toBe(2.2);
  });
});
