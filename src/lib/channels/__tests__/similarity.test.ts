import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { setupTestDb, teardownTestDb, getTestDb, schema } from '@/lib/db/__tests__/setup'
import { computeChannelCentroid, findSimilarChannels } from '../similarity'

describe('computeChannelCentroid', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('computes average embedding vector for a channel', async () => {
    const db = getTestDb()

    // Insert video for channel
    const [video] = await db.insert(schema.videos).values({
      youtubeId: 'test-vid-1',
      title: 'Test Video 1',
      channel: 'Test Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    // Insert chunks with embeddings
    const embedding1 = new Array(384).fill(0.5)
    const embedding2 = new Array(384).fill(0.7)

    await db.insert(schema.chunks).values([
      {
        videoId: video!.id,
        content: 'Chunk 1',
        startTime: 0,
        endTime: 10,
        embedding: embedding1,
      },
      {
        videoId: video!.id,
        content: 'Chunk 2',
        startTime: 10,
        endTime: 20,
        embedding: embedding2,
      },
    ])

    // Compute centroid
    const centroid = await computeChannelCentroid('Test Channel', db)

    // Centroid should be average of embedding1 and embedding2
    expect(centroid).not.toBeNull()
    expect(centroid!.length).toBe(384)
    expect(centroid![0]).toBeCloseTo(0.6, 5) // Average of 0.5 and 0.7
  })

  it('computes centroid across multiple videos from same channel', async () => {
    const db = getTestDb()

    // Insert 2 videos for same channel
    const [video1] = await db.insert(schema.videos).values({
      youtubeId: 'test-vid-1',
      title: 'Test Video 1',
      channel: 'Multi Video Channel',
      transcript: 'Test transcript 1',
      duration: 600,
    }).returning()

    const [video2] = await db.insert(schema.videos).values({
      youtubeId: 'test-vid-2',
      title: 'Test Video 2',
      channel: 'Multi Video Channel',
      transcript: 'Test transcript 2',
      duration: 600,
    }).returning()

    // Insert chunks for both videos
    const embedding = new Array(384).fill(0.8)

    await db.insert(schema.chunks).values([
      {
        videoId: video1!.id,
        content: 'Chunk from video 1',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      },
      {
        videoId: video2!.id,
        content: 'Chunk from video 2',
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      },
    ])

    // Compute centroid
    const centroid = await computeChannelCentroid('Multi Video Channel', db)

    expect(centroid).not.toBeNull()
    expect(centroid!.length).toBe(384)
    expect(centroid![0]).toBeCloseTo(0.8, 5)
  })

  it('returns null for channel with no videos', async () => {
    const db = getTestDb()

    const centroid = await computeChannelCentroid('Nonexistent Channel', db)

    expect(centroid).toBeNull()
  })

  it('returns null for channel with no embeddings', async () => {
    const db = getTestDb()

    // Insert video but no chunks
    await db.insert(schema.videos).values({
      youtubeId: 'test-vid',
      title: 'Test Video',
      channel: 'No Embeddings Channel',
      transcript: 'Test transcript',
      duration: 600,
    })

    const centroid = await computeChannelCentroid('No Embeddings Channel', db)

    expect(centroid).toBeNull()
  })

  it('handles chunks with null embeddings', async () => {
    const db = getTestDb()

    const [video] = await db.insert(schema.videos).values({
      youtubeId: 'test-vid',
      title: 'Test Video',
      channel: 'Partial Embeddings Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    // Insert chunks with mix of null and valid embeddings
    await db.insert(schema.chunks).values([
      {
        videoId: video!.id,
        content: 'Chunk with embedding',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.5),
      },
      {
        videoId: video!.id,
        content: 'Chunk without embedding',
        startTime: 10,
        endTime: 20,
        embedding: null,
      },
    ])

    const centroid = await computeChannelCentroid('Partial Embeddings Channel', db)

    // Should compute centroid from only the non-null embedding
    expect(centroid).toBeDefined()
    expect(centroid!.length).toBe(384)
    expect(centroid![0]).toBeCloseTo(0.5, 5)
  })
})

describe('findSimilarChannels', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('finds similar channels based on content similarity', async () => {
    const db = getTestDb()

    // Create followed channel
    await db.insert(schema.channels).values({
      channelId: 'followed-channel-id',
      name: 'Followed Channel',
      feedUrl: 'https://example.com/feed',
    })

    // Insert video and chunks for followed channel
    const [followedVideo] = await db.insert(schema.videos).values({
      youtubeId: 'followed-vid',
      title: 'Followed Video',
      channel: 'Followed Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    const followedEmbedding = new Array(384).fill(0.9)
    await db.insert(schema.chunks).values([
      {
        videoId: followedVideo!.id,
        content: 'Followed chunk 1',
        startTime: 0,
        endTime: 10,
        embedding: followedEmbedding,
      },
      {
        videoId: followedVideo!.id,
        content: 'Followed chunk 2',
        startTime: 10,
        endTime: 20,
        embedding: [...followedEmbedding],
      },
      {
        videoId: followedVideo!.id,
        content: 'Followed chunk 3',
        startTime: 20,
        endTime: 30,
        embedding: [...followedEmbedding],
      },
    ])

    // Insert similar channel (not followed) with 3+ embedded videos
    const similarEmbedding = new Array(384).fill(0.85) // Very similar

    for (let i = 0; i < 3; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `similar-vid-${i}`,
        title: `Similar Video ${i}`,
        channel: 'Similar Channel',
        transcript: 'Similar transcript',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Similar chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...similarEmbedding],
      })
    }

    // Insert dissimilar channel
    const dissimilarEmbedding = new Array(384).fill(-0.9)
    for (let i = 0; i < 3; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `dissimilar-vid-${i}`,
        title: `Dissimilar Video ${i}`,
        channel: 'Dissimilar Channel',
        transcript: 'Dissimilar transcript',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Dissimilar chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...dissimilarEmbedding],
      })
    }

    // Find similar channels
    const similar = await findSimilarChannels(['Followed Channel'], undefined, db)

    expect(similar.length).toBeGreaterThan(0)
    expect(similar[0]!.channelName).toBe('Similar Channel')
    expect(similar[0]!.similarity).toBeGreaterThan(0.6)
    expect(similar[0]!.videoCount).toBeGreaterThanOrEqual(3)
    expect(similar[0]!.sampleTitles.length).toBeGreaterThan(0)

    // Dissimilar channel should not appear (below threshold)
    expect(similar.find(c => c.channelName === 'Dissimilar Channel')).toBeUndefined()
  })

  it('filters out already-followed channels', async () => {
    const db = getTestDb()

    // Create two followed channels
    await db.insert(schema.channels).values([
      {
        channelId: 'followed-1-id',
        name: 'Followed Channel 1',
        feedUrl: 'https://example.com/feed1',
      },
      {
        channelId: 'followed-2-id',
        name: 'Followed Channel 2',
        feedUrl: 'https://example.com/feed2',
      },
    ])

    // Both have very similar content (3+ embedded videos each)
    const embedding = new Array(384).fill(0.9)

    for (const channelName of ['Followed Channel 1', 'Followed Channel 2']) {
      for (let i = 0; i < 3; i++) {
        const [video] = await db.insert(schema.videos).values({
          youtubeId: `${channelName}-vid-${i}`,
          title: `${channelName} Video ${i}`,
          channel: channelName,
          transcript: 'Test transcript',
          duration: 600,
        }).returning()

        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `Chunk ${i}`,
          startTime: 0,
          endTime: 10,
          embedding: [...embedding],
        })
      }
    }

    // Find similar channels for Followed Channel 1
    const similar = await findSimilarChannels(['Followed Channel 1'], undefined, db)

    // Should NOT include Followed Channel 2 (already being followed)
    expect(similar.find(c => c.channelName === 'Followed Channel 2')).toBeUndefined()
  })

  it('excludes channels with fewer than 3 embedded videos', async () => {
    const db = getTestDb()

    // Create followed channel with 3+ videos
    await db.insert(schema.channels).values({
      channelId: 'followed-id',
      name: 'Followed Channel',
      feedUrl: 'https://example.com/feed',
    })

    const embedding = new Array(384).fill(0.9)

    for (let i = 0; i < 3; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `followed-vid-${i}`,
        title: `Followed Video ${i}`,
        channel: 'Followed Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      })
    }

    // Create similar channel but with only 2 embedded videos
    for (let i = 0; i < 2; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `few-vids-${i}`,
        title: `Few Videos ${i}`,
        channel: 'Few Videos Channel',
        transcript: 'Similar transcript',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Similar chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      })
    }

    const similar = await findSimilarChannels(['Followed Channel'], undefined, db)

    // Should NOT include channel with < 3 videos
    expect(similar.find(c => c.channelName === 'Few Videos Channel')).toBeUndefined()
  })

  it('respects custom threshold', async () => {
    const db = getTestDb()

    await db.insert(schema.channels).values({
      channelId: 'followed-id',
      name: 'Followed Channel',
      feedUrl: 'https://example.com/feed',
    })

    const followedEmbedding = new Array(384).fill(0.9)
    for (let i = 0; i < 3; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `followed-vid-${i}`,
        title: `Followed Video ${i}`,
        channel: 'Followed Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...followedEmbedding],
      })
    }

    // Create high similarity channel (similarity > 0.95)
    const highSimilarityEmbedding = new Array(384).fill(0.85)
    for (let i = 0; i < 3; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `high-sim-vid-${i}`,
        title: `High Similarity Video ${i}`,
        channel: 'High Similarity Channel',
        transcript: 'High similarity',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...highSimilarityEmbedding],
      })
    }

    // With low threshold 0.5, should appear
    const similarLow = await findSimilarChannels(['Followed Channel'], { threshold: 0.5 }, db)
    expect(similarLow.find(c => c.channelName === 'High Similarity Channel')).toBeDefined()

    // With threshold 1.0, should not appear (nothing can have similarity > 1.0)
    const similarVeryHigh = await findSimilarChannels(['Followed Channel'], { threshold: 1.0 }, db)
    expect(similarVeryHigh.find(c => c.channelName === 'High Similarity Channel')).toBeUndefined()
  })

  it('respects custom limit', async () => {
    const db = getTestDb()

    await db.insert(schema.channels).values({
      channelId: 'followed-id',
      name: 'Followed Channel',
      feedUrl: 'https://example.com/feed',
    })

    const embedding = new Array(384).fill(0.9)
    for (let i = 0; i < 3; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `followed-vid-${i}`,
        title: `Followed Video ${i}`,
        channel: 'Followed Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      })
    }

    // Create 5 similar channels
    for (let channelIdx = 0; channelIdx < 5; channelIdx++) {
      for (let i = 0; i < 3; i++) {
        const [video] = await db.insert(schema.videos).values({
          youtubeId: `channel-${channelIdx}-vid-${i}`,
          title: `Channel ${channelIdx} Video ${i}`,
          channel: `Similar Channel ${channelIdx}`,
          transcript: 'Similar transcript',
          duration: 600,
        }).returning()

        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `Chunk ${i}`,
          startTime: 0,
          endTime: 10,
          embedding: [...embedding],
        })
      }
    }

    // Default limit should return up to 10
    const similarDefault = await findSimilarChannels(['Followed Channel'], undefined, db)
    expect(similarDefault.length).toBeLessThanOrEqual(10)

    // Custom limit of 2
    const similarLimited = await findSimilarChannels(['Followed Channel'], { limit: 2 }, db)
    expect(similarLimited.length).toBeLessThanOrEqual(2)
  })

  it('returns empty array when no similar channels found', async () => {
    const db = getTestDb()

    await db.insert(schema.channels).values({
      channelId: 'followed-id',
      name: 'Followed Channel',
      feedUrl: 'https://example.com/feed',
    })

    const embedding = new Array(384).fill(0.9)
    for (let i = 0; i < 3; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `followed-vid-${i}`,
        title: `Followed Video ${i}`,
        channel: 'Followed Channel',
        transcript: 'Test transcript',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...embedding],
      })
    }

    // No other channels exist
    const similar = await findSimilarChannels(['Followed Channel'], undefined, db)

    expect(similar).toEqual([])
  })

  it('handles multiple followed channels', async () => {
    const db = getTestDb()

    // Create two followed channels
    await db.insert(schema.channels).values([
      {
        channelId: 'followed-1-id',
        name: 'Followed Channel 1',
        feedUrl: 'https://example.com/feed1',
      },
      {
        channelId: 'followed-2-id',
        name: 'Followed Channel 2',
        feedUrl: 'https://example.com/feed2',
      },
    ])

    // Create videos for both followed channels
    for (const channelName of ['Followed Channel 1', 'Followed Channel 2']) {
      const embedding = new Array(384).fill(0.9)
      for (let i = 0; i < 3; i++) {
        const [video] = await db.insert(schema.videos).values({
          youtubeId: `${channelName}-vid-${i}`,
          title: `${channelName} Video ${i}`,
          channel: channelName,
          transcript: 'Test transcript',
          duration: 600,
        }).returning()

        await db.insert(schema.chunks).values({
          videoId: video!.id,
          content: `Chunk ${i}`,
          startTime: 0,
          endTime: 10,
          embedding: [...embedding],
        })
      }
    }

    // Create similar channel
    const similarEmbedding = new Array(384).fill(0.85)
    for (let i = 0; i < 3; i++) {
      const [video] = await db.insert(schema.videos).values({
        youtubeId: `similar-vid-${i}`,
        title: `Similar Video ${i}`,
        channel: 'Similar Channel',
        transcript: 'Similar transcript',
        duration: 600,
      }).returning()

      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Chunk ${i}`,
        startTime: 0,
        endTime: 10,
        embedding: [...similarEmbedding],
      })
    }

    const similar = await findSimilarChannels(
      ['Followed Channel 1', 'Followed Channel 2'],
      undefined,
      db
    )

    // Should find similar channel relative to both followed channels
    expect(similar.find(c => c.channelName === 'Similar Channel')).toBeDefined()
  })

  it('returns empty array when followed channel has no embeddings', async () => {
    const db = getTestDb()

    await db.insert(schema.channels).values({
      channelId: 'followed-id',
      name: 'Followed Channel',
      feedUrl: 'https://example.com/feed',
    })

    // Insert video but no chunks
    await db.insert(schema.videos).values({
      youtubeId: 'followed-vid',
      title: 'Followed Video',
      channel: 'Followed Channel',
      transcript: 'Test transcript',
      duration: 600,
    })

    const similar = await findSimilarChannels(['Followed Channel'], undefined, db)

    expect(similar).toEqual([])
  })
})
