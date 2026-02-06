import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { setupTestDb, teardownTestDb, getTestDb, schema } from './setup'

describe('relationships table schema (Postgres)', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('creates relationship between chunks', async () => {
    const db = getTestDb()

    // Create a video
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    // Create two chunks
    const [chunk1] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'First chunk content',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    const [chunk2] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Second chunk content',
        startTime: 30,
        endTime: 60,
      })
      .returning()

    // Create relationship
    const [relationship] = await db
      .insert(schema.relationships)
      .values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 0.85,
      })
      .returning()

    expect(relationship).toBeDefined()
    expect(relationship!.id).toBeDefined()
    expect(relationship!.sourceChunkId).toBe(chunk1!.id)
    expect(relationship!.targetChunkId).toBe(chunk2!.id)
    expect(relationship!.similarity).toBe(0.85)
    expect(relationship!.createdAt).toBeInstanceOf(Date)
  })

  it('enforces unique constraint on source-target pair', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
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

    // Create first relationship
    await db.insert(schema.relationships).values({
      sourceChunkId: chunk1!.id,
      targetChunkId: chunk2!.id,
      similarity: 0.85,
    })

    // Attempt to create duplicate relationship
    await expect(
      db.insert(schema.relationships).values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 0.90,
      })
    ).rejects.toThrow()
  })

  it('allows reverse relationship (different edge)', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
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

    // Create forward relationship
    const [forward] = await db
      .insert(schema.relationships)
      .values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 0.85,
      })
      .returning()

    // Create reverse relationship (should succeed)
    const [reverse] = await db
      .insert(schema.relationships)
      .values({
        sourceChunkId: chunk2!.id,
        targetChunkId: chunk1!.id,
        similarity: 0.85,
      })
      .returning()

    expect(forward).toBeDefined()
    expect(reverse).toBeDefined()
    expect(forward!.id).not.toBe(reverse!.id)
    expect(forward!.sourceChunkId).toBe(chunk1!.id)
    expect(reverse!.sourceChunkId).toBe(chunk2!.id)
  })

  it('queries relationships by source chunk', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
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
        content: 'Source chunk',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    const [chunk2] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Target chunk 1',
        startTime: 30,
        endTime: 60,
      })
      .returning()

    const [chunk3] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Target chunk 2',
        startTime: 60,
        endTime: 90,
      })
      .returning()

    // Create relationships
    await db.insert(schema.relationships).values([
      {
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 0.85,
      },
      {
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk3!.id,
        similarity: 0.75,
      },
    ])

    // Query by source chunk
    const results = await db
      .select()
      .from(schema.relationships)
      .where(eq(schema.relationships.sourceChunkId, chunk1!.id))

    expect(results).toHaveLength(2)
    expect(results[0]?.similarity).toBeDefined()
    expect(results[1]?.similarity).toBeDefined()
  })

  it('queries relationships by target chunk', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
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
        content: 'Source chunk 1',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    const [chunk2] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Source chunk 2',
        startTime: 30,
        endTime: 60,
      })
      .returning()

    const [chunk3] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Target chunk',
        startTime: 60,
        endTime: 90,
      })
      .returning()

    // Create relationships
    await db.insert(schema.relationships).values([
      {
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk3!.id,
        similarity: 0.85,
      },
      {
        sourceChunkId: chunk2!.id,
        targetChunkId: chunk3!.id,
        similarity: 0.75,
      },
    ])

    // Query by target chunk
    const results = await db
      .select()
      .from(schema.relationships)
      .where(eq(schema.relationships.targetChunkId, chunk3!.id))

    expect(results).toHaveLength(2)
  })

  it('cascades delete when chunk is deleted', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
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
        content: 'Chunk 1',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    const [chunk2] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Chunk 2',
        startTime: 30,
        endTime: 60,
      })
      .returning()

    // Create relationship
    await db.insert(schema.relationships).values({
      sourceChunkId: chunk1!.id,
      targetChunkId: chunk2!.id,
      similarity: 0.85,
    })

    // Delete source chunk
    await db.delete(schema.chunks).where(eq(schema.chunks.id, chunk1!.id))

    // Relationship should be deleted
    const relationships = await db
      .select()
      .from(schema.relationships)
      .where(
        and(
          eq(schema.relationships.sourceChunkId, chunk1!.id),
          eq(schema.relationships.targetChunkId, chunk2!.id)
        )
      )

    expect(relationships).toHaveLength(0)
  })
})

describe('edge cases', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('handles similarity values at boundaries', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
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
        content: 'Chunk 1',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    const [chunk2] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Chunk 2',
        startTime: 30,
        endTime: 60,
      })
      .returning()

    // Test 0.0 similarity
    const [zero] = await db
      .insert(schema.relationships)
      .values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 0.0,
      })
      .returning()

    expect(zero).toBeDefined()
    expect(zero!.similarity).toBe(0.0)

    // Clean up for next test
    await db.delete(schema.relationships).where(eq(schema.relationships.id, zero!.id))

    // Test 1.0 similarity
    const [one] = await db
      .insert(schema.relationships)
      .values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: 1.0,
      })
      .returning()

    expect(one).toBeDefined()
    expect(one!.similarity).toBe(1.0)
  })

  it('handles negative similarity values', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
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
        content: 'Chunk 1',
        startTime: 0,
        endTime: 30,
      })
      .returning()

    const [chunk2] = await db
      .insert(schema.chunks)
      .values({
        videoId: video!.id,
        content: 'Chunk 2',
        startTime: 30,
        endTime: 60,
      })
      .returning()

    // PostgreSQL real type allows negative values
    const [negative] = await db
      .insert(schema.relationships)
      .values({
        sourceChunkId: chunk1!.id,
        targetChunkId: chunk2!.id,
        similarity: -0.5,
      })
      .returning()

    expect(negative).toBeDefined()
    expect(negative!.similarity).toBe(-0.5)
  })

  it('handles multiple relationships from same source', async () => {
    const db = getTestDb()

    // Create video and chunks
    const [video] = await db
      .insert(schema.videos)
      .values({
        youtubeId: 'vid1',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
        duration: 600,
      })
      .returning()

    const chunks = await db
      .insert(schema.chunks)
      .values([
        {
          videoId: video!.id,
          content: 'Source chunk',
          startTime: 0,
          endTime: 30,
        },
        {
          videoId: video!.id,
          content: 'Target 1',
          startTime: 30,
          endTime: 60,
        },
        {
          videoId: video!.id,
          content: 'Target 2',
          startTime: 60,
          endTime: 90,
        },
        {
          videoId: video!.id,
          content: 'Target 3',
          startTime: 90,
          endTime: 120,
        },
      ])
      .returning()

    const sourceId = chunks[0]!.id

    // Create multiple relationships
    await db.insert(schema.relationships).values([
      { sourceChunkId: sourceId, targetChunkId: chunks[1]!.id, similarity: 0.9 },
      { sourceChunkId: sourceId, targetChunkId: chunks[2]!.id, similarity: 0.8 },
      { sourceChunkId: sourceId, targetChunkId: chunks[3]!.id, similarity: 0.7 },
    ])

    const results = await db
      .select()
      .from(schema.relationships)
      .where(eq(schema.relationships.sourceChunkId, sourceId))

    expect(results).toHaveLength(3)
  })
})
