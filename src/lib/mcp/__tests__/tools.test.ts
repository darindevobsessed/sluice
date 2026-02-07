import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { registerSearchRag, registerGetListOfCreators } from '../tools'
import type { SearchResult } from '@/lib/search/types'
import type { VideoResult } from '@/lib/search/aggregate'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// Mock dependencies
vi.mock('@/lib/search/hybrid-search', () => ({
  hybridSearch: vi.fn(),
}))

vi.mock('@/lib/search/aggregate', () => ({
  aggregateByVideo: vi.fn(),
}))

vi.mock('@/lib/db/search', () => ({
  getDistinctChannels: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {},
  chunks: {},
  videos: {},
}))

vi.mock('@/lib/embeddings/pipeline', () => ({
  generateEmbedding: vi.fn(),
}))

// Import mocked functions
import { hybridSearch } from '@/lib/search/hybrid-search'
import { aggregateByVideo } from '@/lib/search/aggregate'
import { getDistinctChannels } from '@/lib/db/search'

describe('registerSearchRag', () => {
  let mockServer: {
    registerTool: Mock
  }
  let toolHandler: (params: { topic: string; creator?: string; limit?: number }) => Promise<{
    content: Array<{ type: string; text: string }>
  }>

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock server that captures the tool handler
    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        toolHandler = handler
      }),
    }

    // Register the tool
    registerSearchRag(mockServer as unknown as McpServer)
  })

  it('registers search_rag tool with correct configuration', () => {
    expect(mockServer.registerTool).toHaveBeenCalledTimes(1)
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'search_rag',
      expect.objectContaining({
        title: 'Search RAG',
        description: expect.any(String),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function)
    )
  })

  it('searches knowledge base with topic only', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        chunkId: 1,
        content: 'TypeScript is great',
        startTime: 0,
        endTime: 10,
        similarity: 0.9,
        videoId: 1,
        videoTitle: 'TypeScript Basics',
        channel: 'Dev Channel',
        youtubeId: 'abc123',
        thumbnail: 'https://example.com/thumb.jpg',
        publishedAt: null,
      },
    ]

    const mockVideoResults: VideoResult[] = [
      {
        videoId: 1,
        youtubeId: 'abc123',
        title: 'TypeScript Basics',
        channel: 'Dev Channel',
        thumbnail: 'https://example.com/thumb.jpg',
        score: 0.9,
        matchedChunks: 1,
        bestChunk: {
          content: 'TypeScript is great',
          startTime: 0,
          similarity: 0.9,
        },
      },
    ]

    ;(hybridSearch as Mock).mockResolvedValue(mockSearchResults)
    ;(aggregateByVideo as Mock).mockReturnValue(mockVideoResults)

    const result = await toolHandler({ topic: 'TypeScript' })

    expect(hybridSearch).toHaveBeenCalledWith('TypeScript', { limit: 10 })
    expect(aggregateByVideo).toHaveBeenCalledWith(mockSearchResults)
    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify(mockVideoResults, null, 2) }],
    })
  })

  it('filters by creator when provided', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        chunkId: 1,
        content: 'React hooks',
        startTime: 0,
        endTime: 10,
        similarity: 0.9,
        videoId: 1,
        videoTitle: 'React Tutorial',
        channel: 'Dev Channel',
        youtubeId: 'abc123',
        thumbnail: 'https://example.com/thumb1.jpg',
        publishedAt: null,
      },
      {
        chunkId: 2,
        content: 'React state',
        startTime: 0,
        endTime: 10,
        similarity: 0.8,
        videoId: 2,
        videoTitle: 'React Advanced',
        channel: 'JS Channel',
        youtubeId: 'def456',
        thumbnail: 'https://example.com/thumb2.jpg',
        publishedAt: null,
      },
    ]

    const mockVideoResults: VideoResult[] = [
      {
        videoId: 1,
        youtubeId: 'abc123',
        title: 'React Tutorial',
        channel: 'Dev Channel',
        thumbnail: 'https://example.com/thumb1.jpg',
        score: 0.9,
        matchedChunks: 1,
        bestChunk: {
          content: 'React hooks',
          startTime: 0,
          similarity: 0.9,
        },
      },
    ]

    ;(hybridSearch as Mock).mockResolvedValue(mockSearchResults)
    ;(aggregateByVideo as Mock).mockReturnValue(mockVideoResults)

    const result = await toolHandler({ topic: 'React', creator: 'Dev' })

    expect(hybridSearch).toHaveBeenCalledWith('React', { limit: 10 })
    // aggregateByVideo should be called with filtered results (only Dev Channel)
    expect(aggregateByVideo).toHaveBeenCalledWith([mockSearchResults[0]])
    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify(mockVideoResults, null, 2) }],
    })
  })

  it('filters by creator case-insensitively', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        chunkId: 1,
        content: 'Content',
        startTime: 0,
        endTime: 10,
        similarity: 0.9,
        videoId: 1,
        videoTitle: 'Video 1',
        channel: 'JavaScript Mastery',
        youtubeId: 'abc123',
        thumbnail: null,
      },
      {
        chunkId: 2,
        content: 'Content',
        startTime: 0,
        endTime: 10,
        similarity: 0.8,
        videoId: 2,
        videoTitle: 'Video 2',
        channel: 'Python Pro',
        youtubeId: 'def456',
        thumbnail: null,
      },
    ]

    ;(hybridSearch as Mock).mockResolvedValue(mockSearchResults)
    ;(aggregateByVideo as Mock).mockReturnValue([])

    await toolHandler({ topic: 'test', creator: 'MASTERY' })

    // Should filter to only JavaScript Mastery (case-insensitive)
    expect(aggregateByVideo).toHaveBeenCalledWith([mockSearchResults[0]])
  })

  it('respects custom limit parameter', async () => {
    const mockSearchResults: SearchResult[] = []
    const mockVideoResults: VideoResult[] = []

    ;(hybridSearch as Mock).mockResolvedValue(mockSearchResults)
    ;(aggregateByVideo as Mock).mockReturnValue(mockVideoResults)

    await toolHandler({ topic: 'test', limit: 25 })

    expect(hybridSearch).toHaveBeenCalledWith('test', { limit: 25 })
  })

  it('uses default limit of 10 when not provided', async () => {
    const mockSearchResults: SearchResult[] = []
    const mockVideoResults: VideoResult[] = []

    ;(hybridSearch as Mock).mockResolvedValue(mockSearchResults)
    ;(aggregateByVideo as Mock).mockReturnValue(mockVideoResults)

    await toolHandler({ topic: 'test' })

    expect(hybridSearch).toHaveBeenCalledWith('test', { limit: 10 })
  })

  it('handles empty search results', async () => {
    ;(hybridSearch as Mock).mockResolvedValue([])
    ;(aggregateByVideo as Mock).mockReturnValue([])

    const result = await toolHandler({ topic: 'nonexistent' })

    expect(aggregateByVideo).toHaveBeenCalledWith([])
    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify([], null, 2) }],
    })
  })

  it('filters out all results when creator does not match', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        chunkId: 1,
        content: 'Content',
        startTime: 0,
        endTime: 10,
        similarity: 0.9,
        videoId: 1,
        videoTitle: 'Video 1',
        channel: 'Channel A',
        youtubeId: 'abc123',
        thumbnail: null,
      },
    ]

    ;(hybridSearch as Mock).mockResolvedValue(mockSearchResults)
    ;(aggregateByVideo as Mock).mockReturnValue([])

    await toolHandler({ topic: 'test', creator: 'Channel B' })

    // Should filter out all results
    expect(aggregateByVideo).toHaveBeenCalledWith([])
  })

  it('handles null thumbnail gracefully', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        chunkId: 1,
        content: 'Content',
        startTime: 0,
        endTime: 10,
        similarity: 0.9,
        videoId: 1,
        videoTitle: 'Video 1',
        channel: 'Channel A',
        youtubeId: 'abc123',
        thumbnail: null,
      },
    ]

    const mockVideoResults: VideoResult[] = [
      {
        videoId: 1,
        youtubeId: 'abc123',
        title: 'Video 1',
        channel: 'Channel A',
        thumbnail: null,
        score: 0.9,
        matchedChunks: 1,
        bestChunk: {
          content: 'Content',
          startTime: 0,
          similarity: 0.9,
        },
      },
    ]

    ;(hybridSearch as Mock).mockResolvedValue(mockSearchResults)
    ;(aggregateByVideo as Mock).mockReturnValue(mockVideoResults)

    const result = await toolHandler({ topic: 'test' })

    expect(result.content[0]?.text).toContain('"thumbnail": null')
  })

  it('handles null startTime gracefully', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        chunkId: 1,
        content: 'Content',
        startTime: null,
        endTime: null,
        similarity: 0.9,
        videoId: 1,
        videoTitle: 'Video 1',
        channel: 'Channel A',
        youtubeId: 'abc123',
        thumbnail: null,
      },
    ]

    const mockVideoResults: VideoResult[] = [
      {
        videoId: 1,
        youtubeId: 'abc123',
        title: 'Video 1',
        channel: 'Channel A',
        thumbnail: null,
        score: 0.9,
        matchedChunks: 1,
        bestChunk: {
          content: 'Content',
          startTime: null,
          similarity: 0.9,
        },
      },
    ]

    ;(hybridSearch as Mock).mockResolvedValue(mockSearchResults)
    ;(aggregateByVideo as Mock).mockReturnValue(mockVideoResults)

    const result = await toolHandler({ topic: 'test' })

    expect(result.content[0]?.text).toContain('"startTime": null')
  })
})

describe('registerGetListOfCreators', () => {
  let mockServer: {
    registerTool: Mock
  }
  let toolHandler: () => Promise<{
    content: Array<{ type: string; text: string }>
  }>

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock server that captures the tool handler
    mockServer = {
      registerTool: vi.fn((name, config, handler) => {
        toolHandler = handler
      }),
    }

    // Register the tool
    registerGetListOfCreators(mockServer as unknown as McpServer)
  })

  it('registers get_list_of_creators tool with correct configuration', () => {
    expect(mockServer.registerTool).toHaveBeenCalledTimes(1)
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'get_list_of_creators',
      expect.objectContaining({
        title: 'Get List of Creators',
        description: expect.any(String),
        inputSchema: {},
      }),
      expect.any(Function)
    )
  })

  it('returns creators with video counts sorted by count descending', async () => {
    const mockCreators = [
      { channel: 'JavaScript Mastery', videoCount: 15 },
      { channel: 'Fireship', videoCount: 10 },
      { channel: 'Web Dev Simplified', videoCount: 5 },
    ]

    ;(getDistinctChannels as Mock).mockResolvedValue(mockCreators)

    const result = await toolHandler()

    expect(getDistinctChannels).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify(mockCreators, null, 2) }],
    })
  })

  it('returns empty array when no videos exist', async () => {
    ;(getDistinctChannels as Mock).mockResolvedValue([])

    const result = await toolHandler()

    expect(getDistinctChannels).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify([], null, 2) }],
    })
  })

  it('handles single creator correctly', async () => {
    const mockCreators = [
      { channel: 'Solo Creator', videoCount: 1 },
    ]

    ;(getDistinctChannels as Mock).mockResolvedValue(mockCreators)

    const result = await toolHandler()

    expect(result.content[0]?.text).toContain('Solo Creator')
    expect(result.content[0]?.text).toContain('"videoCount": 1')
  })

  it('preserves exact order from database query', async () => {
    const mockCreators = [
      { channel: 'Creator A', videoCount: 100 },
      { channel: 'Creator B', videoCount: 50 },
      { channel: 'Creator C', videoCount: 25 },
    ]

    ;(getDistinctChannels as Mock).mockResolvedValue(mockCreators)

    const result = await toolHandler()
    const parsed = JSON.parse(result.content[0]?.text ?? '[]')

    expect(parsed).toEqual(mockCreators)
    expect(parsed[0]?.channel).toBe('Creator A')
    expect(parsed[2]?.channel).toBe('Creator C')
  })
})
