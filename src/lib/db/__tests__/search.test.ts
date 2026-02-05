import { describe, it, expect } from 'vitest';

/**
 * Search tests - temporarily stubbed during SQLite → Postgres migration.
 * Will be rewritten in Chunk 5 with Postgres test setup.
 */

describe('searchVideos (Postgres)', () => {
  it.todo('returns empty array when no videos exist');
  it.todo('returns all videos when query is empty');
  it.todo('finds videos by title match using ILIKE');
  it.todo('finds videos by transcript content');
  it.todo('finds videos by channel name');
  it.todo('is case insensitive');
});

describe('getVideoStats (Postgres)', () => {
  it.todo('returns zeros when no videos exist');
  it.todo('counts videos correctly');
  it.todo('calculates total hours correctly');
  it.todo('counts unique channels');
});
