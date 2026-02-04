import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Video } from './schema';

// FTS5 migration SQL (embedded to avoid path resolution issues)
const FTS_MIGRATION_SQL = `
-- FTS5 virtual table for full-text search on videos
-- Uses external content table pattern for better storage efficiency
-- Indexes: title, transcript, channel

CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
  title,
  transcript,
  channel,
  content='videos',
  content_rowid='id'
);

-- Trigger to keep FTS index in sync on INSERT
CREATE TRIGGER IF NOT EXISTS videos_ai AFTER INSERT ON videos BEGIN
  INSERT INTO videos_fts(rowid, title, transcript, channel)
  VALUES (new.id, new.title, new.transcript, new.channel);
END;

-- Trigger to keep FTS index in sync on UPDATE
CREATE TRIGGER IF NOT EXISTS videos_au AFTER UPDATE ON videos BEGIN
  INSERT INTO videos_fts(videos_fts, rowid, title, transcript, channel)
  VALUES('delete', old.id, old.title, old.transcript, old.channel);
  INSERT INTO videos_fts(rowid, title, transcript, channel)
  VALUES (new.id, new.title, new.transcript, new.channel);
END;

-- Trigger to keep FTS index in sync on DELETE
CREATE TRIGGER IF NOT EXISTS videos_ad AFTER DELETE ON videos BEGIN
  INSERT INTO videos_fts(videos_fts, rowid, title, transcript, channel)
  VALUES('delete', old.id, old.title, old.transcript, old.channel);
END;
`;

// Schema SQL for creating tables
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  thumbnail TEXT,
  duration INTEGER,
  transcript TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/**
 * Escape special FTS5 characters in user query
 */
function escapeFtsQuery(query: string): string {
  // Remove or escape FTS5 special characters: " * : ( ) + - AND OR NOT
  return query
    .replace(/"/g, '""') // Escape double quotes
    .replace(/[*:()+\-^]/g, ' ') // Remove special operators
    .trim();
}

/**
 * Map snake_case row from SQLite to camelCase Video type
 */
interface VideoRow {
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

function mapRowToVideo(row: VideoRow): Video {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    channel: row.channel,
    thumbnail: row.thumbnail,
    duration: row.duration,
    transcript: row.transcript,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

/**
 * Create a database connection with all necessary setup
 * @param dbPath - Path to the database file (use ':memory:' for in-memory)
 * @returns Object with sqlite connection, drizzle instance, and helper functions
 */
export function createDatabase(dbPath: string) {
  const sqliteConn = new Database(dbPath);

  // Enable WAL mode for file-based databases
  if (dbPath !== ':memory:') {
    sqliteConn.pragma('journal_mode = WAL');
  }

  // Create schema tables
  sqliteConn.exec(SCHEMA_SQL);

  // Run FTS5 migration if not already applied
  const checkFtsTable = sqliteConn.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='videos_fts'"
  );
  const ftsExists = checkFtsTable.get();

  if (!ftsExists) {
    sqliteConn.exec(FTS_MIGRATION_SQL);
    // Rebuild FTS index to include any existing videos
    sqliteConn.exec("INSERT INTO videos_fts(videos_fts) VALUES('rebuild');");
  }

  const drizzleDb = drizzle(sqliteConn, { schema });

  /**
   * Search videos using FTS5 full-text search
   */
  function searchVideos(query: string): Video[] {
    const trimmedQuery = query.trim();

    // If no query, return all videos sorted by most recent
    if (!trimmedQuery) {
      const stmt = sqliteConn.prepare(
        'SELECT * FROM videos ORDER BY created_at DESC'
      );
      const rows = stmt.all() as VideoRow[];
      return rows.map(mapRowToVideo);
    }

    // Use FTS5 search with bm25 ranking
    const escapedQuery = escapeFtsQuery(trimmedQuery);

    // Handle case where query becomes empty after escaping
    if (!escapedQuery) {
      const stmt = sqliteConn.prepare(
        'SELECT * FROM videos ORDER BY created_at DESC'
      );
      const rows = stmt.all() as VideoRow[];
      return rows.map(mapRowToVideo);
    }

    const stmt = sqliteConn.prepare(`
      SELECT v.*
      FROM videos v
      JOIN videos_fts fts ON v.id = fts.rowid
      WHERE videos_fts MATCH ?
      ORDER BY bm25(videos_fts) ASC
    `);

    const rows = stmt.all(escapedQuery) as VideoRow[];
    return rows.map(mapRowToVideo);
  }

  /**
   * Get statistics about the video knowledge bank
   */
  function getVideoStats(): {
    count: number;
    totalHours: number;
    channels: number;
  } {
    const countResult = sqliteConn.prepare('SELECT COUNT(*) as count FROM videos').get() as { count: number };

    const durationResult = sqliteConn.prepare(
      'SELECT COALESCE(SUM(duration), 0) as total FROM videos'
    ).get() as { total: number };

    const channelsResult = sqliteConn.prepare(
      'SELECT COUNT(DISTINCT channel) as channels FROM videos'
    ).get() as { channels: number };

    return {
      count: countResult.count,
      totalHours: Math.round((durationResult.total / 3600) * 10) / 10,
      channels: channelsResult.channels,
    };
  }

  /**
   * Close the database connection
   */
  function close() {
    sqliteConn.close();
  }

  return {
    sqlite: sqliteConn,
    db: drizzleDb,
    searchVideos,
    getVideoStats,
    close,
  };
}

// Type for the database instance
export type DatabaseInstance = ReturnType<typeof createDatabase>;

// Ensure data directory exists for production
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Default production database
const defaultDbPath = join(dataDir, 'gold-miner.db');
const defaultInstance = createDatabase(defaultDbPath);

// Export the default database instance and helpers
export const db = defaultInstance.db;
export const sqlite = defaultInstance.sqlite;
export const searchVideos = defaultInstance.searchVideos;
export const getVideoStats = defaultInstance.getVideoStats;

// Export schema for use in queries
export * from './schema';
