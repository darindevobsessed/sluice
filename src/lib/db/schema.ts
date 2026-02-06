import { pgTable, serial, text, integer, timestamp, jsonb, vector, real, index, unique } from 'drizzle-orm/pg-core';

/**
 * Videos table - stores YouTube video metadata and transcripts
 */
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  youtubeId: text('youtube_id').notNull().unique(),
  title: text('title').notNull(),
  channel: text('channel').notNull(),
  thumbnail: text('thumbnail'),
  duration: integer('duration'), // in seconds
  transcript: text('transcript'), // full transcript text
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'), // nullable for existing videos
});

/**
 * Channels table - stores YouTube channel information for discovery
 */
export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  channelId: text('channel_id').notNull().unique(),
  name: text('name').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Insights table - stores AI-generated extraction results for videos
 * One extraction per video (unique constraint on videoId)
 */
export const insights = pgTable('insights', {
  id: text('id').primaryKey(),
  videoId: integer('video_id')
    .notNull()
    .unique()
    .references(() => videos.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(), // 'dev' | 'meeting' | 'educational' | 'thought-leadership' | 'general'
  extraction: jsonb('extraction').notNull(), // Full ExtractionResult as JSON - native jsonb
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Settings table - key-value store for user preferences and app configuration
 */
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

/**
 * Relationships table for Graph RAG
 * Stores chunk-to-chunk edges with similarity scores
 * Enables knowledge graph traversal and related content discovery
 */
export const relationships = pgTable('relationships', {
  id: serial('id').primaryKey(),
  sourceChunkId: integer('source_chunk_id').references(() => chunks.id, { onDelete: 'cascade' }).notNull(),
  targetChunkId: integer('target_chunk_id').references(() => chunks.id, { onDelete: 'cascade' }).notNull(),
  similarity: real('similarity').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index('relationships_source_idx').on(table.sourceChunkId),
  targetIdx: index('relationships_target_idx').on(table.targetChunkId),
  uniqueEdge: unique('unique_edge').on(table.sourceChunkId, table.targetChunkId),
}));

// Type exports for use in application code
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

export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
