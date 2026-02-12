import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDb, teardownTestDb, getTestDb, schema } from './setup'

describe('temporal_metadata table schema (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('creates temporal metadata for a chunk', async () => {
    const db = getTestDb()

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'tm-vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    // Create a chunk
    const [chunk] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'This discusses React 18 which was released in 2022',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    // Create temporal metadata
    const [temporal] = await db
      .insert(schema.temporalMetadata)
      .values({
        chunkId: chunk!.id,
        versionMention: 'React 18',
        releaseDateMention: 'released in 2022',
        confidence: 0.95,
      })
      .returning()

    expect(temporal).toBeDefined()
    expect(temporal!.id).toBeDefined()
    expect(temporal!.chunkId).toBe(chunk!.id)
    expect(temporal!.versionMention).toBe('React 18')
    expect(temporal!.releaseDateMention).toBe('released in 2022')
    expect(temporal!.confidence).toBe(0.95)
    expect(temporal!.extractedAt).toBeInstanceOf(Date)
  })

  it('allows null version mention', async () => {
    const db = getTestDb()

    // Create video and chunk
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'tm-vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const [chunk] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Content with only date mention',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    // Create temporal metadata with null version
    const [temporal] = await db
      .insert(schema.temporalMetadata)
      .values({
        chunkId: chunk!.id,
        versionMention: null,
        releaseDateMention: 'in 2023',
        confidence: 0.8,
      })
      .returning()

    expect(temporal).toBeDefined()
    expect(temporal!.versionMention).toBeNull()
    expect(temporal!.releaseDateMention).toBe('in 2023')
  })

  it('allows null release date mention', async () => {
    const db = getTestDb()

    // Create video and chunk
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'tm-vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const [chunk] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Content with only version mention',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    // Create temporal metadata with null date
    const [temporal] = await db
      .insert(schema.temporalMetadata)
      .values({
        chunkId: chunk!.id,
        versionMention: 'v2.0',
        releaseDateMention: null,
        confidence: 0.75,
      })
      .returning()

    expect(temporal).toBeDefined()
    expect(temporal!.versionMention).toBe('v2.0')
    expect(temporal!.releaseDateMention).toBeNull()
  })

  it('queries temporal metadata by chunk', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'tm-vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const [chunk1] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'First chunk',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    const [chunk2] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Second chunk',
        startTime: 30,
        endTime: 60,
      })
      .returning()

    // Create temporal metadata for both chunks
    await db.insert(schema.temporalMetadata).values([
      {
        chunkId: chunk1!.id,
        versionMention: 'React 18',
        releaseDateMention: '2022',
        confidence: 0.9,
      },
      {
        chunkId: chunk2!.id,
        versionMention: 'React 19',
        releaseDateMention: '2024',
        confidence: 0.85,
      },
    ])

    // Query by chunk1
    const results = await db
      .select()
      .from(schema.temporalMetadata)
      .where(eq(schema.temporalMetadata.chunkId, chunk1!.id))

    expect(results).toHaveLength(1)
    expect(results[0]?.versionMention).toBe('React 18')
  })

  it('cascades delete when chunk is deleted', async () => {
    const db = getTestDb()

    // Create video and chunk
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'tm-vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const [chunk] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Chunk with temporal data',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    // Create temporal metadata
    await db.insert(schema.temporalMetadata).values({
      chunkId: chunk!.id,
      versionMention: 'v1.0',
      releaseDateMention: '2023',
      confidence: 0.9,
    })

    // Delete chunk
    await db.delete(schema.chunks).where(eq(schema.chunks.id, chunk!.id))

    // Temporal metadata should be deleted
    const results = await db
      .select()
      .from(schema.temporalMetadata)
      .where(eq(schema.temporalMetadata.chunkId, chunk!.id))

    expect(results).toHaveLength(0)
  })
})

describe('edge cases', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('handles confidence values at boundaries', async () => {
    const db = getTestDb()

    // Create video and chunk
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'tm-vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const [chunk] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Test chunk',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    // Test 0.0 confidence
    const [zero] = await db
      .insert(schema.temporalMetadata)
      .values({
        chunkId: chunk!.id,
        versionMention: 'uncertain',
        releaseDateMention: null,
        confidence: 0.0,
      })
      .returning()

    expect(zero).toBeDefined()
    expect(zero!.confidence).toBe(0.0)

    // Clean up
    await db.delete(schema.temporalMetadata).where(eq(schema.temporalMetadata.id, zero!.id))

    // Test 1.0 confidence
    const [one] = await db
      .insert(schema.temporalMetadata)
      .values({
        chunkId: chunk!.id,
        versionMention: 'certain',
        releaseDateMention: null,
        confidence: 1.0,
      })
      .returning()

    expect(one).toBeDefined()
    expect(one!.confidence).toBe(1.0)
  })

  it('handles multiple temporal extractions per chunk', async () => {
    const db = getTestDb()

    // Create video and chunk
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'tm-vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const [chunk] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Discusses React 18 and Node v20',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    // Create multiple temporal metadata entries for same chunk
    await db.insert(schema.temporalMetadata).values([
      {
        chunkId: chunk!.id,
        versionMention: 'React 18',
        releaseDateMention: '2022',
        confidence: 0.95,
      },
      {
        chunkId: chunk!.id,
        versionMention: 'Node v20',
        releaseDateMention: '2023',
        confidence: 0.9,
      },
    ])

    // Query all for this chunk
    const results = await db
      .select()
      .from(schema.temporalMetadata)
      .where(eq(schema.temporalMetadata.chunkId, chunk!.id))

    expect(results).toHaveLength(2)
    expect(results.map(r => r.versionMention).sort()).toEqual(['Node v20', 'React 18'])
  })

  it('handles both version and date as null', async () => {
    const db = getTestDb()

    // Create video and chunk
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'tm-vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const [chunk] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'No temporal info',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    // Create with both null (edge case - low confidence extraction)
    const [temporal] = await db
      .insert(schema.temporalMetadata)
      .values({
        chunkId: chunk!.id,
        versionMention: null,
        releaseDateMention: null,
        confidence: 0.1,
      })
      .returning()

    expect(temporal).toBeDefined()
    expect(temporal!.versionMention).toBeNull()
    expect(temporal!.releaseDateMention).toBeNull()
    expect(temporal!.confidence).toBe(0.1)
  })
})
