import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Videos table - stores YouTube video metadata and transcripts
 */
export const videos = sqliteTable('videos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  youtubeId: text('youtube_id').notNull().unique(),
  title: text('title').notNull(),
  channel: text('channel').notNull(),
  thumbnail: text('thumbnail'),
  duration: integer('duration'), // in seconds
  transcript: text('transcript'), // full transcript text
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Channels table - stores YouTube channel information for discovery
 */
export const channels = sqliteTable('channels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  channelId: text('channel_id').notNull().unique(),
  name: text('name').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Insights table - stores AI-generated extraction results for videos
 * One extraction per video (unique constraint on videoId)
 */
export const insights = sqliteTable('insights', {
  id: text('id').primaryKey(),
  videoId: integer('video_id')
    .notNull()
    .unique()
    .references(() => videos.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(), // 'dev' | 'meeting' | 'educational' | 'thought-leadership' | 'general'
  extraction: text('extraction', { mode: 'json' }).notNull(), // Full ExtractionResult as JSON
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Settings table - key-value store for user preferences and app configuration
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Type exports for use in application code
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;

export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
