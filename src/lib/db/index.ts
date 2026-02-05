import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Detect if running against Neon (for SSL config)
const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL
  ssl: isNeon ? { rejectUnauthorized: false } : undefined,
  // Connection pool settings (Neon-friendly)
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export const db = drizzle(pool, { schema });

// Export pool for direct SQL when needed
export { pool };

// Re-export schema
export * from './schema';

// Re-export search functions
export { searchVideos, getVideoStats } from './search';
