---
name: database-migration
title: Database Migration
status: active
priority: high
created: 2026-02-05
updated: 2026-02-05
cycle: rag-foundation
story_number: 1
chunks_total: 5
chunks_complete: 1
---

# Story: Database Migration

## Spark

Replace SQLite with Postgres + PG Vector extension. This is the foundation for all RAG capabilities — without vector storage, no embeddings, no semantic search.

Keep Drizzle ORM (Brad confirmed it's fine). Design the schema to be Neon-compatible from day one (connection pooling, SSL, etc.) even though we're running locally for now.

Migrate existing data (videos, insights, channels) to the new Postgres instance. Add new columns/tables for embeddings that will be populated by Story 3.

> *"Store it in Postgres. You have to do embeddings. You have to do rags. Do it local for now, but then we can deploy it to Vercel with the Neon database."*

## Dependencies

**Blocked by:** None (first story)
**Blocks:** Story 3 (Embedding Pipeline), Story 4 (RAG Search)

## Acceptance

- [ ] Docker Compose starts Postgres with pgvector extension
- [ ] Drizzle schema uses Postgres types (pgTable, serial, timestamp, jsonb)
- [ ] New `chunks` table exists with vector column (384 dimensions for FastEmbed)
- [ ] Database connection works with connection pooling
- [ ] Simple ILIKE search replaces FTS5 (temporary until vector search)
- [ ] All existing SQLite data migrated to Postgres
- [ ] All API routes work with async Postgres queries
- [ ] All tests pass with Postgres
- [ ] No SQLite dependencies remain in codebase
- [ ] Neon-compatible (SSL handling, connection string format)

## Chunks

### Chunk 1: Docker Setup + Postgres with pgvector

**Goal:** Local Postgres database with pgvector extension running in Docker.

**Files:**
- `docker-compose.yml` — create
- `.env.example` — create
- `.env` — create (gitignored)
- `.gitignore` — modify (add .env)
- `scripts/init-db.sql` — create (pgvector extension setup)
- `README.md` — modify (add Docker prerequisite)

**Implementation Details:**

**docker-compose.yml:**
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: goldminer-db
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: goldminer
      POSTGRES_PASSWORD: goldminer
      POSTGRES_DB: goldminer
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U goldminer"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**.env.example:**
```
DATABASE_URL=postgresql://goldminer:goldminer@localhost:5432/goldminer
```

**scripts/init-db.sql:**
```sql
-- Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Create test database for running tests
CREATE DATABASE goldminer_test;
\c goldminer_test
CREATE EXTENSION IF NOT EXISTS vector;
```

**What Could Break:**
- Docker not installed — document in README
- Port 5432 in use — can change port mapping in docker-compose
- Insufficient Docker resources — pgvector needs ~512MB RAM

**Done When:**
- [ ] `docker compose up -d` starts Postgres with pgvector
- [ ] Can connect: `psql postgresql://goldminer:goldminer@localhost:5432/goldminer`
- [ ] `\dx` shows vector extension installed
- [ ] Test database `goldminer_test` exists with vector extension
- [ ] Health check passes

---

### Chunk 2: Drizzle Schema Migration (SQLite → Postgres)

**Goal:** Convert Drizzle schema from SQLite to Postgres syntax, add chunks table for embeddings.

**Files:**
- `src/lib/db/schema.ts` — rewrite (sqlite → postgres)
- `drizzle.config.ts` — modify (dialect + credentials)
- `package.json` — modify (add postgres driver, remove sqlite)

**Implementation Details:**

**Install/uninstall packages:**
```bash
npm install pg @types/pg
npm uninstall better-sqlite3 @types/better-sqlite3
```

**Note:** No separate `pgvector` package needed — Drizzle ORM v0.45.1+ has native pgvector support.

**Schema conversion (src/lib/db/schema.ts):**
```typescript
import { pgTable, serial, text, integer, timestamp, jsonb, vector, index } from 'drizzle-orm/pg-core';

export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  youtubeId: text('youtube_id').notNull().unique(),
  title: text('title').notNull(),
  channel: text('channel').notNull(),
  thumbnail: text('thumbnail'),
  duration: integer('duration'),
  transcript: text('transcript'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  channelId: text('channel_id').notNull().unique(),
  name: text('name').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insights = pgTable('insights', {
  id: text('id').primaryKey(),
  videoId: integer('video_id')
    .notNull()
    .unique()
    .references(() => videos.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(),
  extraction: jsonb('extraction').notNull(), // Changed from text+json mode to native jsonb
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/**
 * Chunks table for RAG embeddings
 * Vector dimension: 384 (matches FastEmbed all-MiniLM-L6-v2 model)
 * Populated by Story 3 (Embedding Pipeline)
 */
export const chunks = pgTable('chunks', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  startTime: integer('start_time'), // seconds into video
  endTime: integer('end_time'),
  // Vector embedding - 384 dimensions for all-MiniLM-L6-v2
  // NULL until populated by embedding pipeline
  embedding: vector('embedding', { dimensions: 384 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Index for vector similarity search (commented until data exists)
// CREATE INDEX chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

// Type exports
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
```

**drizzle.config.ts:**
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

**What Could Break:**
- Drizzle pgvector support requires Postgres with vector extension enabled
- JSONB behavior differs from SQLite JSON (stricter parsing)
- Drizzle-kit version compatibility with pgvector

**Done When:**
- [ ] Schema compiles without errors
- [ ] `npm run db:push` creates all tables in Postgres
- [ ] chunks table has vector column
- [ ] `drizzle-kit studio` connects and shows all tables
- [ ] No SQLite imports in schema.ts

---

### Chunk 3: Database Connection Layer

**Goal:** Update database initialization with Postgres connection pooling, Neon-compatible config, and simple search.

**Files:**
- `src/lib/db/index.ts` — rewrite (Postgres connection with pooling)
- `src/lib/db/search.ts` — create (ILIKE search replacing FTS5)
- `src/lib/db/insights.ts` — modify (async operations)

**Implementation Details:**

**src/lib/db/index.ts:**
```typescript
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

// Export for direct SQL when needed
export { pool };

// Re-export schema
export * from './schema';
```

**src/lib/db/search.ts:**
```typescript
import { db } from './index';
import { videos, type Video } from './schema';
import { desc, or, ilike } from 'drizzle-orm';

/**
 * Search videos using simple ILIKE pattern matching
 * Temporary replacement for FTS5 until vector search (Story 4)
 */
export async function searchVideos(query: string): Promise<Video[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return db.select().from(videos).orderBy(desc(videos.createdAt));
  }

  const pattern = `%${trimmed}%`;

  return db.select()
    .from(videos)
    .where(
      or(
        ilike(videos.title, pattern),
        ilike(videos.channel, pattern),
        ilike(videos.transcript, pattern)
      )
    )
    .orderBy(desc(videos.createdAt));
}

/**
 * Get statistics about the video knowledge bank
 */
export async function getVideoStats(): Promise<{
  count: number;
  totalHours: number;
  channels: number;
}> {
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(videos);

  const durationResult = await db.select({
    total: sql<number>`coalesce(sum(duration), 0)`
  }).from(videos);

  const channelsResult = await db.select({
    channels: sql<number>`count(distinct channel)`
  }).from(videos);

  return {
    count: Number(countResult[0]?.count ?? 0),
    totalHours: Math.round((Number(durationResult[0]?.total ?? 0) / 3600) * 10) / 10,
    channels: Number(channelsResult[0]?.channels ?? 0),
  };
}
```

**src/lib/db/insights.ts updates:**
- Add `async/await` to all functions
- Update imports from new index.ts
- Use `db.query` instead of raw SQL

**What Could Break:**
- Missing `sql` import from drizzle-orm
- Pool connection timeout on slow networks
- Neon SSL detection regex might not cover all cases

**Done When:**
- [ ] Database connects to Postgres
- [ ] `searchVideos()` returns results with ILIKE
- [ ] `getVideoStats()` returns correct counts
- [ ] Connection pooling works (no connection exhaustion)
- [ ] Neon connection works with SSL (if tested)
- [ ] No FTS5 or SQLite code remains

---

### Chunk 4: Data Migration Script

**Goal:** Migrate existing SQLite data to Postgres safely with transaction and dry-run support.

**Files:**
- `scripts/migrate-data.ts` — create
- `package.json` — modify (add migrate script)

**Implementation Details:**

**scripts/migrate-data.ts:**
```typescript
#!/usr/bin/env npx tsx
/**
 * Migrate data from SQLite to Postgres
 *
 * Usage:
 *   npm run db:migrate-data           # Run migration
 *   npm run db:migrate-data -- --dry-run  # Preview without writing
 */
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/lib/db/schema';
import { existsSync } from 'fs';

const SQLITE_PATH = './data/gold-miner.db';
const isDryRun = process.argv.includes('--dry-run');

interface SQLiteVideo {
  id: number;
  youtube_id: string;
  title: string;
  channel: string;
  thumbnail: string | null;
  duration: number | null;
  transcript: string | null;
  created_at: number;
  updated_at: number;
}

interface SQLiteInsight {
  id: string;
  video_id: number;
  content_type: string;
  extraction: string;
  created_at: number;
  updated_at: number;
}

interface SQLiteChannel {
  id: number;
  channel_id: string;
  name: string;
  thumbnail_url: string | null;
  created_at: number;
}

interface SQLiteSetting {
  key: string;
  value: string;
}

async function migrate() {
  console.log(isDryRun ? '🔍 DRY RUN MODE - No data will be written\n' : '🚀 Starting migration...\n');

  // Check SQLite exists
  if (!existsSync(SQLITE_PATH)) {
    console.log('No SQLite database found at', SQLITE_PATH);
    console.log('Nothing to migrate.');
    return;
  }

  // Source: SQLite
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // Target: Postgres
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pg = drizzle(pool, { schema });

  // Map old video IDs to new video IDs (Postgres serial won't match)
  const videoIdMap = new Map<number, number>();

  try {
    // Start transaction for atomicity
    await pool.query('BEGIN');

    // 1. Migrate videos
    const videos = sqlite.prepare('SELECT * FROM videos ORDER BY id').all() as SQLiteVideo[];
    console.log(`📹 Found ${videos.length} videos`);

    for (const video of videos) {
      if (!isDryRun) {
        const result = await pg.insert(schema.videos).values({
          youtubeId: video.youtube_id,
          title: video.title,
          channel: video.channel,
          thumbnail: video.thumbnail,
          duration: video.duration,
          transcript: video.transcript,
          createdAt: new Date(video.created_at * 1000),
          updatedAt: new Date(video.updated_at * 1000),
        }).returning({ id: schema.videos.id });

        videoIdMap.set(video.id, result[0].id);
      }
      console.log(`  ✓ ${video.title.substring(0, 50)}...`);
    }

    // 2. Migrate insights (requires video ID mapping)
    const insights = sqlite.prepare('SELECT * FROM insights ORDER BY id').all() as SQLiteInsight[];
    console.log(`\n💡 Found ${insights.length} insights`);

    for (const insight of insights) {
      const newVideoId = videoIdMap.get(insight.video_id);
      if (!newVideoId && !isDryRun) {
        console.warn(`  ⚠ Skipping insight ${insight.id} - video ${insight.video_id} not found`);
        continue;
      }

      if (!isDryRun) {
        await pg.insert(schema.insights).values({
          id: insight.id,
          videoId: newVideoId!,
          contentType: insight.content_type,
          extraction: JSON.parse(insight.extraction),
          createdAt: new Date(insight.created_at * 1000),
          updatedAt: new Date(insight.updated_at * 1000),
        });
      }
      console.log(`  ✓ Insight for video ${insight.video_id}`);
    }

    // 3. Migrate channels
    const channels = sqlite.prepare('SELECT * FROM channels ORDER BY id').all() as SQLiteChannel[];
    console.log(`\n📺 Found ${channels.length} channels`);

    for (const channel of channels) {
      if (!isDryRun) {
        await pg.insert(schema.channels).values({
          channelId: channel.channel_id,
          name: channel.name,
          thumbnailUrl: channel.thumbnail_url,
          createdAt: new Date(channel.created_at * 1000),
        });
      }
      console.log(`  ✓ ${channel.name}`);
    }

    // 4. Migrate settings
    const settings = sqlite.prepare('SELECT * FROM settings').all() as SQLiteSetting[];
    console.log(`\n⚙️ Found ${settings.length} settings`);

    for (const setting of settings) {
      if (!isDryRun) {
        await pg.insert(schema.settings).values({
          key: setting.key,
          value: setting.value,
        });
      }
      console.log(`  ✓ ${setting.key}`);
    }

    // Commit transaction
    if (!isDryRun) {
      await pool.query('COMMIT');
      console.log('\n✅ Migration complete!');
      console.log('\n💾 SQLite database preserved at:', SQLITE_PATH);
      console.log('   Delete manually after verifying Postgres data.');
    } else {
      await pool.query('ROLLBACK');
      console.log('\n✅ Dry run complete - no data written');
    }

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('\n❌ Migration failed, rolled back:', error);
    throw error;
  } finally {
    sqlite.close();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**package.json additions:**
```json
"scripts": {
  "db:migrate-data": "tsx scripts/migrate-data.ts"
}
```

**What Could Break:**
- SQLite extraction column contains invalid JSON — handle parse errors
- Video ID mapping fails if concurrent inserts happen
- Large datasets may timeout — could add batching

**Done When:**
- [ ] `npm run db:migrate-data -- --dry-run` shows preview
- [ ] `npm run db:migrate-data` completes without errors
- [ ] All videos migrated with correct data
- [ ] All insights migrated with correct video FK
- [ ] Timestamps preserved correctly
- [ ] SQLite file preserved for backup verification

---

### Chunk 5: Update Consumers + Tests

**Goal:** Update all database consumers for async Postgres, implement test strategy with transaction rollback.

**Files:**
- `src/app/api/videos/route.ts` — modify (async)
- `src/app/api/videos/[id]/route.ts` — modify (async)
- `src/app/api/videos/[id]/insights/route.ts` — modify (async)
- `src/app/page.tsx` — modify (async)
- `src/components/videos/VideoGrid.tsx` — modify (async)
- `src/lib/db/__tests__/search.test.ts` — rewrite
- `src/lib/db/__tests__/insights.test.ts` — rewrite
- `vitest.config.ts` — modify (add setup file)
- `src/lib/db/__tests__/setup.ts` — create (test utilities)

**Implementation Details:**

**API route pattern (example for videos/route.ts):**
```typescript
// Before (sync SQLite)
const videos = searchVideos(query);

// After (async Postgres)
const videos = await searchVideos(query);
```

**Test setup (src/lib/db/__tests__/setup.ts):**
```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST
  ?? process.env.DATABASE_URL?.replace('/goldminer', '/goldminer_test');

let pool: Pool;
let testDb: ReturnType<typeof drizzle>;

export async function setupTestDb() {
  pool = new Pool({ connectionString: TEST_DATABASE_URL });
  testDb = drizzle(pool, { schema });

  // Clean tables before each test
  await pool.query('TRUNCATE videos, insights, channels, settings, chunks CASCADE');

  return testDb;
}

export async function teardownTestDb() {
  await pool.end();
}

export { testDb };
```

**Test file pattern (search.test.ts):**
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, testDb } from './setup';
import { searchVideos, getVideoStats } from '../search';
import { videos } from '../schema';

describe('searchVideos', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.delete(videos);
  });

  it('returns all videos when query is empty', async () => {
    await testDb.insert(videos).values([
      { youtubeId: 'abc123', title: 'Test Video', channel: 'Test' },
    ]);

    const results = await searchVideos('');
    expect(results).toHaveLength(1);
  });

  it('searches by title with ILIKE', async () => {
    await testDb.insert(videos).values([
      { youtubeId: 'abc', title: 'React Tutorial', channel: 'Dev' },
      { youtubeId: 'def', title: 'Vue Guide', channel: 'Dev' },
    ]);

    const results = await searchVideos('react');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('React Tutorial');
  });
});
```

**vitest.config.ts update:**
```typescript
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config'], // Load .env for DATABASE_URL
  },
});
```

**What Could Break:**
- Tests run in parallel may conflict — use `--no-threads` or separate DBs
- Missing `await` anywhere causes Promise returns instead of data
- Component files that import db directly may need client/server split

**Done When:**
- [ ] All API routes work with Postgres
- [ ] `npm run dev` starts successfully
- [ ] Search returns results from Postgres
- [ ] Video detail page loads
- [ ] Insights save and load correctly
- [ ] `npm test` passes all tests
- [ ] No SQLite references remain anywhere in codebase
- [ ] `npm run build` succeeds

---

## Notes

- **Temporary search:** ILIKE search is a stopgap until Story 4 (RAG Search) replaces it with vector similarity
- **Vector index:** Commented in schema; will be enabled in Story 3 after data exists
- **Neon readiness:** Connection handles SSL for Neon, but full deployment is future work
- **SQLite backup:** Migration script preserves SQLite file for manual deletion after verification
- **FastEmbed dimension:** chunks.embedding is 384 dimensions to match all-MiniLM-L6-v2 model
