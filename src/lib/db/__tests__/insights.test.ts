import { describe, it } from 'vitest';

/**
 * Insights tests - temporarily stubbed during SQLite → Postgres migration.
 * Will be rewritten in Chunk 5 with Postgres test setup.
 */

describe('getExtractionForVideo (Postgres)', () => {
  it.todo('returns null when no extraction exists');
  it.todo('returns extraction with correct data');
});

describe('upsertExtraction (Postgres)', () => {
  it.todo('creates new extraction when none exists');
  it.todo('updates existing extraction');
  it.todo('enforces one extraction per video');
});

describe('deleteExtraction (Postgres)', () => {
  it.todo('deletes extraction');
  it.todo('does not throw when deleting non-existent extraction');
});

describe('edge cases (Postgres)', () => {
  it.todo('handles empty arrays in extraction');
  it.todo('handles large extraction data');
});
