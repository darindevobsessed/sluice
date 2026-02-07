import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

// Use test database (created by init-db.sql)
// Uses same credentials as main db, just different database name
// Replace database name at end of URL, not username
const TEST_DATABASE_URL = process.env.DATABASE_URL?.replace(/\/goldminer$/, '/goldminer_test')
  ?? 'postgresql://goldminer:goldminer@localhost:5432/goldminer_test';

let pool: Pool | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function setupTestDb() {
  if (!pool) {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    testDb = drizzle(pool, { schema });
  }

  // Clean tables before each test
  await pool.query('TRUNCATE videos, insights, channels, settings, chunks, relationships, temporal_metadata, focus_areas, video_focus_areas CASCADE');

  return testDb!;
}

export async function teardownTestDb() {
  if (pool) {
    await pool.end();
    pool = null;
    testDb = null;
  }
}

export function getTestDb() {
  if (!testDb) throw new Error('Test database not initialized. Call setupTestDb first.');
  return testDb;
}

export { schema };
