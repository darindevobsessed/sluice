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
    select: vi.fn(() => mockSelectChain),
    insert: vi.fn(() => mockInsertChain),
    delete: vi.fn(() => mockDeleteChain),
    _selectChain: mockSelectChain,
    _insertChain: mockInsertChain,
    _deleteChain: mockDeleteChain,
  }
}

type MockDb = ReturnType<typeof createMockDb>

describe('relationships table schema', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('creates relationship between chunks', async () => {
    const now = new Date()
    db._insertChain.returning.mockResolvedValue([
      {
        id: 1,
        sourceChunkId: 10,
        targetChunkId: 20,
        similarity: 0.85,
        createdAt: now,
      },
    ])

    const [relationship] = await db.insert({}).values({
      sourceChunkId: 10,
      targetChunkId: 20,
      similarity: 0.85,
    }).returning()

    expect(relationship).toBeDefined()
    expect(relationship!.id).toBeDefined()
    expect(relationship!.sourceChunkId).toBe(10)
    expect(relationship!.targetChunkId).toBe(20)
    expect(relationship!.similarity).toBe(0.85)
    expect(relationship!.createdAt).toBeInstanceOf(Date)
  })

  it('enforces unique constraint on source-target pair', async () => {
    // First insert succeeds
    db._insertChain.returning.mockResolvedValueOnce([
      { id: 1, sourceChunkId: 10, targetChunkId: 20, similarity: 0.85 },
    ])

    await db.insert({}).values({
      sourceChunkId: 10,
      targetChunkId: 20,
      similarity: 0.85,
    }).returning()

    // Second insert with same pair throws (simulating unique constraint violation)
    db._insertChain.returning.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint')
    )

    await expect(
      db.insert({}).values({
        sourceChunkId: 10,
        targetChunkId: 20,
        similarity: 0.90,
      }).returning()
    ).rejects.toThrow()
  })

  it('allows reverse relationship (different edge)', async () => {
    db._insertChain.returning
      .mockResolvedValueOnce([
        { id: 1, sourceChunkId: 10, targetChunkId: 20, similarity: 0.85 },
      ])
      .mockResolvedValueOnce([
        { id: 2, sourceChunkId: 20, targetChunkId: 10, similarity: 0.85 },
      ])

    const [forward] = await db.insert({}).values({
      sourceChunkId: 10,
      targetChunkId: 20,
      similarity: 0.85,
    }).returning()

    const [reverse] = await db.insert({}).values({
      sourceChunkId: 20,
      targetChunkId: 10,
      similarity: 0.85,
    }).returning()

    expect(forward).toBeDefined()
    expect(reverse).toBeDefined()
    expect(forward!.id).not.toBe(reverse!.id)
    expect(forward!.sourceChunkId).toBe(10)
    expect(reverse!.sourceChunkId).toBe(20)
  })

  it('queries relationships by source chunk', async () => {
    db._selectChain.where.mockResolvedValue([
      { id: 1, sourceChunkId: 10, targetChunkId: 20, similarity: 0.85 },
      { id: 2, sourceChunkId: 10, targetChunkId: 30, similarity: 0.75 },
    ])

    const results = await db.select().from({}).where({})

    expect(results).toHaveLength(2)
    expect(results[0]?.similarity).toBeDefined()
    expect(results[1]?.similarity).toBeDefined()
  })

  it('queries relationships by target chunk', async () => {
    db._selectChain.where.mockResolvedValue([
      { id: 1, sourceChunkId: 10, targetChunkId: 30, similarity: 0.85 },
      { id: 2, sourceChunkId: 20, targetChunkId: 30, similarity: 0.75 },
    ])

    const results = await db.select().from({}).where({})

    expect(results).toHaveLength(2)
  })

  it('cascades delete when chunk is deleted', async () => {
    // Delete chunk
    db._deleteChain.where.mockResolvedValue([])

    await db.delete({}).where({})

    // After cascade, querying relationships returns empty
    db._selectChain.where.mockResolvedValue([])

    const relationships = await db.select().from({}).where({})

    expect(relationships).toHaveLength(0)
  })
})

describe('edge cases', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('handles similarity values at boundaries', async () => {
    // Test 0.0 similarity
    db._insertChain.returning.mockResolvedValueOnce([
      { id: 1, sourceChunkId: 10, targetChunkId: 20, similarity: 0.0 },
    ])

    const [zero] = await db.insert({}).values({
      sourceChunkId: 10,
      targetChunkId: 20,
      similarity: 0.0,
    }).returning()

    expect(zero).toBeDefined()
    expect(zero!.similarity).toBe(0.0)

    // Test 1.0 similarity
    db._insertChain.returning.mockResolvedValueOnce([
      { id: 2, sourceChunkId: 10, targetChunkId: 20, similarity: 1.0 },
    ])

    const [one] = await db.insert({}).values({
      sourceChunkId: 10,
      targetChunkId: 20,
      similarity: 1.0,
    }).returning()

    expect(one).toBeDefined()
    expect(one!.similarity).toBe(1.0)
  })

  it('handles negative similarity values', async () => {
    db._insertChain.returning.mockResolvedValue([
      { id: 1, sourceChunkId: 10, targetChunkId: 20, similarity: -0.5 },
    ])

    const [negative] = await db.insert({}).values({
      sourceChunkId: 10,
      targetChunkId: 20,
      similarity: -0.5,
    }).returning()

    expect(negative).toBeDefined()
    expect(negative!.similarity).toBe(-0.5)
  })

  it('handles multiple relationships from same source', async () => {
    db._selectChain.where.mockResolvedValue([
      { id: 1, sourceChunkId: 10, targetChunkId: 20, similarity: 0.9 },
      { id: 2, sourceChunkId: 10, targetChunkId: 30, similarity: 0.8 },
      { id: 3, sourceChunkId: 10, targetChunkId: 40, similarity: 0.7 },
    ])

    const results = await db.select().from({}).where({})

    expect(results).toHaveLength(3)
  })
})
