import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  generatePersonaSystemPrompt,
  extractExpertiseTopics,
  computeExpertiseEmbedding,
  createPersona,
} from '../service'
import { db } from '@/lib/db'
import { query } from '@anthropic-ai/claude-agent-sdk'

// Mock dependencies
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual('@/lib/db')
  return {
    ...actual,
    db: {
      select: vi.fn(),
      insert: vi.fn(),
    },
  }
})

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}))

vi.mock('@/lib/channels/similarity', () => ({
  computeChannelCentroid: vi.fn(),
}))

const mockDb = vi.mocked(db)
const mockQuery = vi.mocked(query)

describe('generatePersonaSystemPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generates a system prompt from channel content', async () => {
    const channelName = 'Test Creator'

    // Mock transcript samples
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { transcript: 'Sample transcript about React and TypeScript...' },
              { transcript: 'Another video about testing and best practices...' },
            ]),
          }),
        }),
      }),
    } as never)

    // Mock Claude API response
    const mockAssistantMessage = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'text',
            text: 'You are Test Creator, a software engineering educator. Your expertise is in React, TypeScript, and testing. You speak in a clear, practical way, focusing on real-world applications. Answer questions based on your content from your YouTube channel.',
          },
        ],
      },
    }

    mockQuery.mockReturnValue(
      (async function* () {
        yield mockAssistantMessage
      })() as never
    )

    const systemPrompt = await generatePersonaSystemPrompt(channelName)

    expect(systemPrompt).toContain('Test Creator')
    expect(systemPrompt).toContain('expertise')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Test Creator'),
      })
    )
  })

  it('throws error when no transcripts found', async () => {
    const channelName = 'Empty Channel'

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as never)

    await expect(generatePersonaSystemPrompt(channelName)).rejects.toThrow(
      'No transcripts found for channel'
    )
  })

  it('handles Claude API errors gracefully', async () => {
    const channelName = 'Test Creator'

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { transcript: 'Sample transcript...' },
            ]),
          }),
        }),
      }),
    } as never)

    mockQuery.mockReturnValue(
      (async function* () {
        throw new Error('API error')
      })() as never
    )

    await expect(generatePersonaSystemPrompt(channelName)).rejects.toThrow(
      'API error'
    )
  })
})

describe('extractExpertiseTopics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts top topics from channel chunks', async () => {
    const channelName = 'Test Creator'

    // Mock chunk content data
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { content: 'React hooks and state management patterns' },
            { content: 'TypeScript best practices and type safety' },
            { content: 'Testing with Jest and React Testing Library' },
            { content: 'React performance optimization techniques' },
            { content: 'TypeScript generics and advanced types' },
          ]),
        }),
      }),
    } as never)

    const topics = await extractExpertiseTopics(channelName)

    expect(Array.isArray(topics)).toBe(true)
    expect(topics.length).toBeGreaterThan(0)
    expect(topics.length).toBeLessThanOrEqual(10)
  })

  it('returns empty array when no chunks found', async () => {
    const channelName = 'Empty Channel'

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    const topics = await extractExpertiseTopics(channelName)

    expect(topics).toEqual([])
  })
})

describe('computeExpertiseEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes expertise embedding from top chunks', async () => {
    const channelName = 'Test Creator'

    // Mock the computeChannelCentroid function
    const { computeChannelCentroid } = await import('@/lib/channels/similarity')
    const mockComputeChannelCentroid = vi.mocked(computeChannelCentroid)

    // Create a mock 384-dimensional embedding
    const mockEmbedding = new Array(384).fill(0).map((_, i) => i / 384)
    mockComputeChannelCentroid.mockResolvedValue(mockEmbedding)

    const embedding = await computeExpertiseEmbedding(channelName)

    expect(embedding).toHaveLength(384)
    expect(mockComputeChannelCentroid).toHaveBeenCalledWith(channelName, db)
  })

  it('returns null when no embeddings found', async () => {
    const channelName = 'Empty Channel'

    const { computeChannelCentroid } = await import('@/lib/channels/similarity')
    const mockComputeChannelCentroid = vi.mocked(computeChannelCentroid)
    mockComputeChannelCentroid.mockResolvedValue(null)

    const embedding = await computeExpertiseEmbedding(channelName)

    expect(embedding).toBeNull()
  })
})

describe('createPersona', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a complete persona with all fields', async () => {
    const channelName = 'Test Creator'

    // Mock video count
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ]),
      }),
    } as never)

    // Mock transcript samples for system prompt
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { transcript: 'Sample transcript...' },
            ]),
          }),
        }),
      }),
    } as never)

    // Mock Claude API response
    const mockAssistantMessage = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'text',
            text: 'You are Test Creator, an expert in React and TypeScript.',
          },
        ],
      },
    }

    mockQuery.mockReturnValue(
      (async function* () {
        yield mockAssistantMessage
      })() as never
    )

    // Mock chunk content for topics
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { content: 'React hooks tutorial' },
            { content: 'TypeScript patterns' },
          ]),
        }),
      }),
    } as never)

    // Mock embedding computation
    const { computeChannelCentroid } = await import('@/lib/channels/similarity')
    const mockComputeChannelCentroid = vi.mocked(computeChannelCentroid)
    const mockEmbedding = new Array(384).fill(0).map((_, i) => i / 384)
    mockComputeChannelCentroid.mockResolvedValue(mockEmbedding)

    // Mock insert
    const mockPersona = {
      id: 1,
      channelName: 'Test Creator',
      name: 'Test Creator',
      systemPrompt: 'You are Test Creator, an expert in React and TypeScript.',
      expertiseTopics: ['React', 'TypeScript'],
      expertiseEmbedding: mockEmbedding,
      transcriptCount: 3,
      createdAt: new Date(),
    }

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockPersona]),
      }),
    } as never)

    const persona = await createPersona(channelName)

    expect(persona).toMatchObject({
      channelName: 'Test Creator',
      name: 'Test Creator',
      systemPrompt: expect.stringContaining('Test Creator'),
      transcriptCount: 3,
    })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('throws error when channel has no videos', async () => {
    const channelName = 'Empty Channel'

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    await expect(createPersona(channelName)).rejects.toThrow(
      'No videos found for channel'
    )
  })

  it('uses channelName as display name by default', async () => {
    const channelName = 'Test Creator'

    // Mock video count
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    } as never)

    // Mock transcript samples
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { transcript: 'Sample...' },
            ]),
          }),
        }),
      }),
    } as never)

    // Mock Claude API
    const mockAssistantMessage = {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'System prompt...' }],
      },
    }

    mockQuery.mockReturnValue(
      (async function* () {
        yield mockAssistantMessage
      })() as never
    )

    // Mock topics
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { content: 'Content...' },
          ]),
        }),
      }),
    } as never)

    // Mock embedding
    const { computeChannelCentroid } = await import('@/lib/channels/similarity')
    const mockComputeChannelCentroid = vi.mocked(computeChannelCentroid)
    mockComputeChannelCentroid.mockResolvedValue(new Array(384).fill(0.5))

    // Mock insert
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            channelName: 'Test Creator',
            name: 'Test Creator',
            systemPrompt: 'System prompt...',
            expertiseTopics: [],
            expertiseEmbedding: new Array(384).fill(0.5),
            transcriptCount: 1,
            createdAt: new Date(),
          },
        ]),
      }),
    } as never)

    const persona = await createPersona(channelName)

    expect(persona.name).toBe('Test Creator')
  })
})
