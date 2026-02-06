import { describe, it, expect } from 'vitest'
import type { ChunkRelationship, RelatedChunk } from '../types'

describe('ChunkRelationship type', () => {
  it('has correct structure', () => {
    const relationship: ChunkRelationship = {
      sourceChunkId: 1,
      targetChunkId: 2,
      similarity: 0.85,
    }

    expect(relationship.sourceChunkId).toBe(1)
    expect(relationship.targetChunkId).toBe(2)
    expect(relationship.similarity).toBe(0.85)
  })

  it('accepts boundary similarity values', () => {
    const zero: ChunkRelationship = {
      sourceChunkId: 1,
      targetChunkId: 2,
      similarity: 0.0,
    }

    const one: ChunkRelationship = {
      sourceChunkId: 1,
      targetChunkId: 2,
      similarity: 1.0,
    }

    expect(zero.similarity).toBe(0.0)
    expect(one.similarity).toBe(1.0)
  })

  it('accepts negative similarity values', () => {
    const negative: ChunkRelationship = {
      sourceChunkId: 1,
      targetChunkId: 2,
      similarity: -0.5,
    }

    expect(negative.similarity).toBe(-0.5)
  })
})

describe('RelatedChunk type', () => {
  it('has correct structure', () => {
    const relatedChunk: RelatedChunk = {
      chunkId: 1,
      content: 'Test chunk content',
      startTime: 0,
      endTime: 30,
      similarity: 0.85,
      video: {
        id: 1,
        title: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'abc123',
      },
    }

    expect(relatedChunk.chunkId).toBe(1)
    expect(relatedChunk.content).toBe('Test chunk content')
    expect(relatedChunk.startTime).toBe(0)
    expect(relatedChunk.endTime).toBe(30)
    expect(relatedChunk.similarity).toBe(0.85)
    expect(relatedChunk.video.id).toBe(1)
    expect(relatedChunk.video.title).toBe('Test Video')
    expect(relatedChunk.video.channel).toBe('Test Channel')
    expect(relatedChunk.video.youtubeId).toBe('abc123')
  })

  it('handles optional time values', () => {
    const chunk: RelatedChunk = {
      chunkId: 1,
      content: 'Test content',
      startTime: 0,
      endTime: 0,
      similarity: 0.85,
      video: {
        id: 1,
        title: 'Test',
        channel: 'Channel',
        youtubeId: 'abc',
      },
    }

    expect(chunk.startTime).toBe(0)
    expect(chunk.endTime).toBe(0)
  })

  it('handles long content', () => {
    const longContent = 'This is a very long chunk content. '.repeat(100)

    const chunk: RelatedChunk = {
      chunkId: 1,
      content: longContent,
      startTime: 0,
      endTime: 300,
      similarity: 0.85,
      video: {
        id: 1,
        title: 'Test',
        channel: 'Channel',
        youtubeId: 'abc',
      },
    }

    expect(chunk.content.length).toBeGreaterThan(1000)
  })

  it('handles empty content', () => {
    const chunk: RelatedChunk = {
      chunkId: 1,
      content: '',
      startTime: 0,
      endTime: 30,
      similarity: 0.85,
      video: {
        id: 1,
        title: 'Test',
        channel: 'Channel',
        youtubeId: 'abc',
      },
    }

    expect(chunk.content).toBe('')
  })

  it('handles special characters in video metadata', () => {
    const chunk: RelatedChunk = {
      chunkId: 1,
      content: 'Test',
      startTime: 0,
      endTime: 30,
      similarity: 0.85,
      video: {
        id: 1,
        title: 'Test & "Special" <Characters>',
        channel: "O'Reilly Media",
        youtubeId: 'abc-123_XYZ',
      },
    }

    expect(chunk.video.title).toContain('&')
    expect(chunk.video.channel).toContain("'")
    expect(chunk.video.youtubeId).toContain('-')
    expect(chunk.video.youtubeId).toContain('_')
  })
})

describe('type compatibility', () => {
  it('ChunkRelationship maps to database insert', () => {
    const relationship: ChunkRelationship = {
      sourceChunkId: 1,
      targetChunkId: 2,
      similarity: 0.85,
    }

    // This should be compatible with NewRelationship type from schema
    const dbInsert = {
      sourceChunkId: relationship.sourceChunkId,
      targetChunkId: relationship.targetChunkId,
      similarity: relationship.similarity,
    }

    expect(dbInsert.sourceChunkId).toBe(1)
    expect(dbInsert.targetChunkId).toBe(2)
    expect(dbInsert.similarity).toBe(0.85)
  })

  it('RelatedChunk can be constructed from database join', () => {
    // Simulate database query result
    const dbResult = {
      chunk: {
        id: 1,
        content: 'Test content',
        startTime: 0,
        endTime: 30,
      },
      relationship: {
        similarity: 0.85,
      },
      video: {
        id: 1,
        title: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'abc123',
      },
    }

    const relatedChunk: RelatedChunk = {
      chunkId: dbResult.chunk.id,
      content: dbResult.chunk.content,
      startTime: dbResult.chunk.startTime,
      endTime: dbResult.chunk.endTime,
      similarity: dbResult.relationship.similarity,
      video: {
        id: dbResult.video.id,
        title: dbResult.video.title,
        channel: dbResult.video.channel,
        youtubeId: dbResult.video.youtubeId,
      },
    }

    expect(relatedChunk.chunkId).toBe(1)
    expect(relatedChunk.similarity).toBe(0.85)
  })
})
