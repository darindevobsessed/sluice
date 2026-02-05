#!/usr/bin/env npx tsx
/**
 * Migrate data from SQLite to Postgres
 *
 * Usage:
 *   npm run db:migrate-data           # Run migration
 *   npm run db:migrate-data -- --dry-run  # Preview without writing
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/lib/db/schema';
import { existsSync } from 'fs';

const SQLITE_PATH = './gold-miner.db';
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

  // Check DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Make sure .env file exists with DATABASE_URL=postgresql://...');
    process.exit(1);
  }

  // Check SQLite exists
  if (!existsSync(SQLITE_PATH)) {
    console.log('No SQLite database found at', SQLITE_PATH);
    console.log('Nothing to migrate.');
    return;
  }

  // Source: SQLite
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // Check if SQLite has tables
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('videos', 'insights', 'channels', 'settings')"
  ).all() as Array<{ name: string }>;

  if (tables.length === 0) {
    console.log('SQLite database exists but has no tables to migrate.');
    console.log('Nothing to migrate.');
    sqlite.close();
    return;
  }

  console.log(`Found ${tables.length} tables: ${tables.map(t => t.name).join(', ')}\n`);

  // Target: Postgres
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pg = drizzle(pool, { schema });

  // Map old video IDs to new video IDs (Postgres serial won't match)
  const videoIdMap = new Map<number, number>();

  try {
    // Test Postgres connection
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      console.error('❌ Cannot connect to Postgres database');
      console.error('   Make sure Docker container is running: docker compose up -d');
      throw error;
    }

    // Start transaction for atomicity
    await pool.query('BEGIN');

    // 1. Migrate videos (only if table exists)
    const hasVideosTable = tables.some(t => t.name === 'videos');
    const videos = hasVideosTable
      ? sqlite.prepare('SELECT * FROM videos ORDER BY id').all() as SQLiteVideo[]
      : [];
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

        const newId = result[0]?.id;
        if (newId !== undefined) {
          videoIdMap.set(video.id, newId);
        }
      }
      console.log(`  ✓ ${video.title.substring(0, 50)}...`);
    }

    // 2. Migrate insights (requires video ID mapping, only if table exists)
    const hasInsightsTable = tables.some(t => t.name === 'insights');
    const insights = hasInsightsTable
      ? sqlite.prepare('SELECT * FROM insights ORDER BY id').all() as SQLiteInsight[]
      : [];
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

    // 3. Migrate channels (only if table exists)
    const hasChannelsTable = tables.some(t => t.name === 'channels');
    const channels = hasChannelsTable
      ? sqlite.prepare('SELECT * FROM channels ORDER BY id').all() as SQLiteChannel[]
      : [];
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

    // 4. Migrate settings (only if table exists)
    const hasSettingsTable = tables.some(t => t.name === 'settings');
    const settings = hasSettingsTable
      ? sqlite.prepare('SELECT * FROM settings').all() as SQLiteSetting[]
      : [];
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
