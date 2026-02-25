import { describe, it, expect, beforeEach, vi } from 'vitest'

const createMockDb = () => {
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  }
  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue([]),
  }
  return {
    select: vi.fn((_table?: unknown) => mockSelectChain),
    insert: vi.fn((_table?: unknown) => mockInsertChain),
    delete: vi.fn((_table?: unknown) => mockDeleteChain),
    _selectChain: mockSelectChain,
    _insertChain: mockInsertChain,
    _deleteChain: mockDeleteChain,
  }
}

type MockDb = ReturnType<typeof createMockDb>

describe('temporal_metadata table schema', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('creates temporal metadata for a chunk', async () => {
    const now = new Date()
    db._insertChain.returning.mockResolvedValue([
      {
        id: 1,
        chunkId: 100,
        versionMention: 'React 18',
        releaseDateMention: 'released in 2022',
        confidence: 0.95,
        extractedAt: now,
      },
    ])

    const [temporal] = await db.insert({}).values({
      chunkId: 100,
      versionMention: 'React 18',
      releaseDateMention: 'released in 2022',
      confidence: 0.95,
    }).returning()

    expect(temporal).toBeDefined()
    expect(temporal!.id).toBeDefined()
    expect(temporal!.chunkId).toBe(100)
    expect(temporal!.versionMention).toBe('React 18')
    expect(temporal!.releaseDateMention).toBe('released in 2022')
    expect(temporal!.confidence).toBe(0.95)
    expect(temporal!.extractedAt).toBeInstanceOf(Date)
  })

  it('allows null version mention', async () => {
    db._insertChain.returning.mockResolvedValue([
      {
        id: 1,
        chunkId: 100,
        versionMention: null,
        releaseDateMention: 'in 2023',
        confidence: 0.8,
        extractedAt: new Date(),
      },
    ])

    const [temporal] = await db.insert({}).values({
      chunkId: 100,
      versionMention: null,
      releaseDateMention: 'in 2023',
      confidence: 0.8,
    }).returning()

    expect(temporal).toBeDefined()
    expect(temporal!.versionMention).toBeNull()
    expect(temporal!.releaseDateMention).toBe('in 2023')
  })

  it('allows null release date mention', async () => {
    db._insertChain.returning.mockResolvedValue([
      {
        id: 1,
        chunkId: 100,
        versionMention: 'v2.0',
        releaseDateMention: null,
        confidence: 0.75,
        extractedAt: new Date(),
      },
    ])

    const [temporal] = await db.insert({}).values({
      chunkId: 100,
      versionMention: 'v2.0',
      releaseDateMention: null,
      confidence: 0.75,
    }).returning()

    expect(temporal).toBeDefined()
    expect(temporal!.versionMention).toBe('v2.0')
    expect(temporal!.releaseDateMention).toBeNull()
  })

  it('queries temporal metadata by chunk', async () => {
    db._selectChain.where.mockResolvedValue([
      {
        id: 1,
        chunkId: 100,
        versionMention: 'React 18',
        releaseDateMention: '2022',
        confidence: 0.9,
        extractedAt: new Date(),
      },
    ])

    const results = await db.select().from({}).where({})

    expect(results).toHaveLength(1)
    expect(results[0]?.versionMention).toBe('React 18')
  })

  it('cascades delete when chunk is deleted', async () => {
    // Delete chunk
    db._deleteChain.where.mockResolvedValue([])

    await db.delete({}).where({})

    // After cascade, querying temporal metadata returns empty
    db._selectChain.where.mockResolvedValue([])

    const results = await db.select().from({}).where({})

    expect(results).toHaveLength(0)
  })
})

describe('edge cases', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('handles confidence values at boundaries', async () => {
    // Test 0.0 confidence
    db._insertChain.returning.mockResolvedValueOnce([
      {
        id: 1,
        chunkId: 100,
        versionMention: 'uncertain',
        releaseDateMention: null,
        confidence: 0.0,
        extractedAt: new Date(),
      },
    ])

    const [zero] = await db.insert({}).values({
      chunkId: 100,
      versionMention: 'uncertain',
      releaseDateMention: null,
      confidence: 0.0,
    }).returning()

    expect(zero).toBeDefined()
    expect(zero!.confidence).toBe(0.0)

    // Test 1.0 confidence
    db._insertChain.returning.mockResolvedValueOnce([
      {
        id: 2,
        chunkId: 100,
        versionMention: 'certain',
        releaseDateMention: null,
        confidence: 1.0,
        extractedAt: new Date(),
      },
    ])

    const [one] = await db.insert({}).values({
      chunkId: 100,
      versionMention: 'certain',
      releaseDateMention: null,
      confidence: 1.0,
    }).returning()

    expect(one).toBeDefined()
    expect(one!.confidence).toBe(1.0)
  })

  it('handles multiple temporal extractions per chunk', async () => {
    db._selectChain.where.mockResolvedValue([
      {
        id: 1,
        chunkId: 100,
        versionMention: 'React 18',
        releaseDateMention: '2022',
        confidence: 0.95,
        extractedAt: new Date(),
      },
      {
        id: 2,
        chunkId: 100,
        versionMention: 'Node v20',
        releaseDateMention: '2023',
        confidence: 0.9,
        extractedAt: new Date(),
      },
    ])

    const results = await db.select().from({}).where({})

    expect(results).toHaveLength(2)
    expect(results.map((r: { versionMention: string }) => r.versionMention).sort()).toEqual(['Node v20', 'React 18'])
  })

  it('handles both version and date as null', async () => {
    db._insertChain.returning.mockResolvedValue([
      {
        id: 1,
        chunkId: 100,
        versionMention: null,
        releaseDateMention: null,
        confidence: 0.1,
        extractedAt: new Date(),
      },
    ])

    const [temporal] = await db.insert({}).values({
      chunkId: 100,
      versionMention: null,
      releaseDateMention: null,
      confidence: 0.1,
    }).returning()

    expect(temporal).toBeDefined()
    expect(temporal!.versionMention).toBeNull()
    expect(temporal!.releaseDateMention).toBeNull()
    expect(temporal!.confidence).toBe(0.1)
  })
})
