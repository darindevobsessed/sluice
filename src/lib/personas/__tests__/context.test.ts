import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SearchResult } from '@/lib/search/types'

// Mock the hybrid search
const mockHybridSearch = vi.fn()
vi.mock('@/lib/search/hybrid-search', () => ({
  hybridSearch: (...args: unknown[]) => mockHybridSearch(...args),
}))

// Import after mocking
const { getPersonaContext, formatContextForPrompt } = await import('../context')

describe('getPersonaContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHybridSearch.mockResolvedValue({ results: [], degraded: false })
  })

  it('should return filtered search results for a specific channel', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'TypeScript is a typed superset',
        startTime: 0,
        endTime: 10,
        videoId: 1,
        videoTitle: 'TypeScript Basics',
        channel: 'Test Channel',
        youtubeId: 'pc-vid1',
        thumbnail: null,
        similarity: 0.85,
      },
      {
        chunkId: 2,
        content: 'Python is dynamically typed',
        startTime: 0,
        endTime: 10,
        videoId: 2,
        videoTitle: 'Python Basics',
        channel: 'Other Channel',
        youtubeId: 'pc-vid2',
        thumbnail: null,
        similarity: 0.80,
      },
    ], degraded: false })

    const results = await getPersonaContext('Test Channel', 'What is TypeScript?')

    expect(Array.isArray(results)).toBe(true)
    // All results should be from the requested channel
    results.forEach(result => {
      expect(result.channel).toBe('Test Channel')
    })
    // Should filter out 'Other Channel'
    expect(results).toHaveLength(1)
  })

  it('should limit results to 10 chunks', async () => {
    // Return 20 results from the target channel
    const results = Array.from({ length: 20 }, (_, i) => ({
      chunkId: i + 1,
      content: `Test content ${i}`,
      startTime: i * 10,
      endTime: (i + 1) * 10,
      videoId: 1,
      videoTitle: 'Test Video',
      channel: 'Test Channel',
      youtubeId: 'pc-vid',
      thumbnail: null,
      similarity: 0.7,
    }))
    mockHybridSearch.mockResolvedValue({ results, degraded: false })

    const contextResults = await getPersonaContext('Test Channel', 'Test')

    expect(contextResults.length).toBeLessThanOrEqual(10)
  })

  it('should call hybridSearch with correct parameters', async () => {
    await getPersonaContext('Test Channel', 'test query')

    expect(mockHybridSearch).toHaveBeenCalledWith('test query', {
      mode: 'hybrid',
      limit: 50,
    })
  })

  it('should handle empty results gracefully', async () => {
    mockHybridSearch.mockResolvedValue({ results: [], degraded: false })

    const results = await getPersonaContext('Nonexistent Channel', 'query')

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })

  it('should handle results where no chunks match the channel', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'Some content',
        startTime: 0,
        endTime: 10,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Different Channel',
        youtubeId: 'pc-vid',
        thumbnail: null,
        similarity: 0.7,
      },
    ], degraded: false })

    const results = await getPersonaContext('Nonexistent Channel', 'query')

    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })

  it('should return results with correct properties', async () => {
    mockHybridSearch.mockResolvedValue({ results: [
      {
        chunkId: 1,
        content: 'Test query content',
        startTime: 0,
        endTime: 10,
        videoId: 1,
        videoTitle: 'Test Video',
        channel: 'Test Channel',
        youtubeId: 'pc-vid',
        thumbnail: null,
        similarity: 0.85,
      },
    ], degraded: false })

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
