import { pgTable, serial, text, integer, timestamp, jsonb, vector, real, index, unique, uniqueIndex, boolean } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * Videos table - stores YouTube video metadata and transcripts
 */
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  youtubeId: text('youtube_id'),
  sourceType: text('source_type').notNull().default('youtube'),
  title: text('title').notNull(),
  channel: text('channel'),
  thumbnail: text('thumbnail'),
  duration: integer('duration'), // in seconds
  description: text('description'), // video description from YouTube
  transcript: text('transcript'), // full transcript text
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  publishedAt: timestamp('published_at'), // nullable for existing videos
}, (table) => ({
  youtubeIdUnique: uniqueIndex('youtube_id_unique').on(table.youtubeId).where(sql`${table.youtubeId} IS NOT NULL`),
}));

/**
 * Channels table - stores YouTube channel information for discovery
 */
export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  channelId: text('channel_id').notNull().unique(),
  name: text('name').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  feedUrl: text('feed_url'),
  autoFetch: boolean('auto_fetch').default(false),
  lastFetchedAt: timestamp('last_fetched_at'),
  fetchIntervalHours: integer('fetch_interval_hours').default(12),
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

/**
 * Temporal Metadata table for Temporal Graph RAG
 * Stores chunk-level version mentions and release dates extracted from content
 * Enables time-aware knowledge discovery and version tracking
 */
export const temporalMetadata = pgTable('temporal_metadata', {
  id: serial('id').primaryKey(),
  chunkId: integer('chunk_id')
    .notNull()
    .references(() => chunks.id, { onDelete: 'cascade' }),
  versionMention: text('version_mention'), // e.g., "v2.0", "React 18"
  releaseDateMention: text('release_date_mention'), // e.g., "released in 2024"
  confidence: real('confidence').notNull(), // 0-1 confidence score
  extractedAt: timestamp('extracted_at').defaultNow().notNull(),
}, (table) => ({
  chunkIdx: index('temporal_chunk_idx').on(table.chunkId),
}));

/**
 * Jobs table for automation queue
 * Database-backed job queue for reliable async processing
 */
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'fetch_transcript' | 'generate_embeddings'
  payload: jsonb('payload').notNull(), // { videoId, youtubeId, ... }
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('jobs_status_idx').on(table.status),
  typeIdx: index('jobs_type_idx').on(table.type),
}));

/**
 * Focus Areas table - user-defined categories for organizing videos
 * Enables filtering the knowledge bank by topic/theme
 */
export const focusAreas = pgTable('focus_areas', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color'), // optional color for UI display
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Video Focus Areas junction table - many-to-many relationship
 * Videos can belong to multiple focus areas
 */
export const videoFocusAreas = pgTable('video_focus_areas', {
  videoId: integer('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  focusAreaId: integer('focus_area_id')
    .notNull()
    .references(() => focusAreas.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: unique('video_focus_areas_pk').on(table.videoId, table.focusAreaId),
  videoIdx: index('video_focus_areas_video_idx').on(table.videoId),
  focusAreaIdx: index('video_focus_areas_focus_area_idx').on(table.focusAreaId),
}));

/**
 * Personas table - AI-generated personas from YouTube creators
 * One persona per channel, created after 30+ videos are processed
 */
export const personas = pgTable('personas', {
  id: serial('id').primaryKey(),
  channelName: text('channel_name').notNull().unique(),
  name: text('name').notNull(), // Display name for the persona
  systemPrompt: text('system_prompt').notNull(), // Generated from content analysis
  expertiseTopics: jsonb('expertise_topics'), // Array of topic strings
  expertiseEmbedding: vector('expertise_embedding', { dimensions: 384 }), // Centroid of expertise chunks
  transcriptCount: integer('transcript_count').notNull(), // Cached count at creation
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Better Auth tables -- managed by better-auth library
 * These use text IDs (UUIDs) unlike the rest of the schema which uses serial IDs.
 * Table/column names must match better-auth expectations exactly.
 */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

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

export type TemporalMetadata = typeof temporalMetadata.$inferSelect;
export type NewTemporalMetadata = typeof temporalMetadata.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type FocusArea = typeof focusAreas.$inferSelect;
export type NewFocusArea = typeof focusAreas.$inferInsert;

export type VideoFocusArea = typeof videoFocusAreas.$inferSelect;
export type NewVideoFocusArea = typeof videoFocusAreas.$inferInsert;

export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
