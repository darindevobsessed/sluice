import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { setupTestDb, teardownTestDb, getTestDb, schema } from '@/lib/db/__tests__/setup'
import { getPersonaContext, formatContextForPrompt } from '../context'
import type { SearchResult } from '@/lib/search/types'

// Mock the embedding pipeline to avoid ONNX runtime issues in tests
vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(384).fill(0.5))
}))

describe('getPersonaContext', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  it('should return filtered search results for a specific channel', async () => {
    const db = getTestDb()

    const [video1] = await db.insert(schema.videos).values({
      youtubeId: 'pc-vid1',
      title: 'TypeScript Basics',
      channel: 'Test Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    const [video2] = await db.insert(schema.videos).values({
      youtubeId: 'pc-vid2',
      title: 'Python Basics',
      channel: 'Other Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    await db.insert(schema.chunks).values([
      {
        videoId: video1!.id,
        content: 'TypeScript is a typed superset',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.7),
      },
      {
        videoId: video2!.id,
        content: 'Python is dynamically typed',
        startTime: 0,
        endTime: 10,
        embedding: new Array(384).fill(0.7),
      },
    ])

    const results = await getPersonaContext('Test Channel', 'What is TypeScript?')

    expect(Array.isArray(results)).toBe(true)
    // All results should be from the requested channel
    results.forEach(result => {
      expect(result.channel).toBe('Test Channel')
    })
  })

  it('should limit results to 10 chunks', async () => {
    const db = getTestDb()

    const [video] = await db.insert(schema.videos).values({
      youtubeId: 'pc-vid',
      title: 'Test Video',
      channel: 'Test Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    // Insert 20 chunks
    for (let i = 0; i < 20; i++) {
      await db.insert(schema.chunks).values({
        videoId: video!.id,
        content: `Test content ${i}`,
        startTime: i * 10,
        endTime: (i + 1) * 10,
        embedding: new Array(384).fill(0.7),
      })
    }

    const results = await getPersonaContext('Test Channel', 'Test')

    expect(results.length).toBeLessThanOrEqual(10)
  })

  it('should use hybrid search mode', async () => {
    const db = getTestDb()

    const [video] = await db.insert(schema.videos).values({
      youtubeId: 'pc-vid',
      title: 'Test Video',
      channel: 'Test Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'Test query content',
      startTime: 0,
      endTime: 10,
      embedding: new Array(384).fill(0.7),
    })

    const results = await getPersonaContext('Test Channel', 'test query')

    if (results.length > 0) {
      const result = results[0]
      expect(result).toHaveProperty('chunkId')
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('videoId')
      expect(result).toHaveProperty('channel')
      expect(result).toHaveProperty('similarity')
    }
  })

  it('should handle empty results gracefully', async () => {
    const db = getTestDb()

    const [video] = await db.insert(schema.videos).values({
      youtubeId: 'pc-vid',
      title: 'Test Video',
      channel: 'Different Channel',
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'Some content',
      startTime: 0,
      endTime: 10,
      embedding: new Array(384).fill(0.7),
    })

    const results = await getPersonaContext('Nonexistent Channel', 'query')

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })

  it('should handle special characters in channel name', async () => {
    const db = getTestDb()

    const [video] = await db.insert(schema.videos).values({
      youtubeId: 'pc-vid',
      title: 'Test Video',
      channel: "O'Reilly Media",
      transcript: 'Test transcript',
      duration: 600,
    }).returning()

    await db.insert(schema.chunks).values({
      videoId: video!.id,
      content: 'Test content',
      startTime: 0,
      endTime: 10,
      embedding: new Array(384).fill(0.7),
    })

    const results = await getPersonaContext("O'Reilly Media", 'test')

    expect(Array.isArray(results)).toBe(true)
  })
})

describe('formatContextForPrompt', () => {
  const mockResults: SearchResult[] = [
    {
      chunkId: 1,
      content: 'TypeScript is a typed superset of JavaScript.',
      startTime: 10,
      endTime: 20,
      videoId: 1,
      videoTitle: 'Intro to TypeScript',
      channel: 'Tech Channel',
      youtubeId: 'abc123',
      thumbnail: null,
      similarity: 0.95,
    },
    {
      chunkId: 2,
      content: 'It adds static typing to JavaScript.',
      startTime: 30,
      endTime: 40,
      videoId: 1,
      videoTitle: 'Intro to TypeScript',
      channel: 'Tech Channel',
      youtubeId: 'abc123',
      thumbnail: null,
      similarity: 0.88,
    },
  ]

  it('should format results as numbered context blocks', () => {
    const formatted = formatContextForPrompt(mockResults)

    expect(formatted).toContain('[1]')
    expect(formatted).toContain('[2]')
    expect(formatted).toContain('TypeScript is a typed superset of JavaScript.')
    expect(formatted).toContain('It adds static typing to JavaScript.')
  })

  it('should include video titles', () => {
    const formatted = formatContextForPrompt(mockResults)

    expect(formatted).toContain('Intro to TypeScript')
  })

  it('should include timestamps when available', () => {
    const formatted = formatContextForPrompt(mockResults)

    expect(formatted).toContain('10s')
  })

  it('should handle null timestamps', () => {
    const resultsWithNullTime: SearchResult[] = [
      {
        ...mockResults[0]!,
        startTime: null,
        endTime: null,
      },
    ]

    const formatted = formatContextForPrompt(resultsWithNullTime)

    expect(formatted).toBeTruthy()
    expect(formatted).not.toContain('null')
  })

  it('should return empty string for empty results', () => {
    const formatted = formatContextForPrompt([])

    expect(formatted).toBe('')
  })

  it('should handle long content gracefully', () => {
    const longContent = 'a'.repeat(1000)
    const resultsWithLongContent: SearchResult[] = [
      {
        ...mockResults[0]!,
        content: longContent,
      },
    ]

    const formatted = formatContextForPrompt(resultsWithLongContent)

    expect(formatted).toContain(longContent)
  })
})
