import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getExtractionForVideo,
  upsertExtraction,
  deleteExtraction,
} from '../insights'
import type { ExtractionResult } from '@/lib/claude/prompts/types'

const createMockDb = () => {
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockDb = ReturnType<typeof createMockDb>

const makeExtraction = (overrides: Partial<ExtractionResult> = {}): ExtractionResult => ({
  contentType: 'dev',
  summary: {
    tldr: 'Test TLDR',
    overview: 'Test overview',
    keyPoints: ['Point 1', 'Point 2'],
  },
  insights: [
    {
      title: 'Test Insight',
      timestamp: '00:05:30',
      explanation: 'Test explanation',
      actionable: 'Test action',
    },
  ],
  actionItems: {
    immediate: ['Task 1'],
    shortTerm: ['Task 2'],
    longTerm: ['Task 3'],
    resources: [{ name: 'Resource 1', description: 'Description 1' }],
  },
  claudeCode: {
    applicable: true,
    skills: [],
    commands: [],
    agents: [],
    hooks: [],
    rules: [],
  },
  ...overrides,
})

describe('getExtractionForVideo', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('returns null when no extraction exists', async () => {
    db._selectChain.limit.mockResolvedValue([])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getExtractionForVideo(1, db as any)
    expect(result).toBeNull()
    expect(db.select).toHaveBeenCalled()
  })

  it('returns extraction with correct data', async () => {
    const extraction = makeExtraction()
    const now = new Date()
    db._selectChain.limit.mockResolvedValue([
      {
        id: 'abc-123',
        videoId: 1,
        contentType: 'dev',
        extraction,
        createdAt: now,
        updatedAt: now,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getExtractionForVideo(1, db as any)
    expect(result).not.toBeNull()
    expect(result?.videoId).toBe(1)
    expect(result?.contentType).toBe('dev')
    expect(result?.extraction.summary.tldr).toBe('Test TLDR')
    expect(result?.extraction.insights).toHaveLength(1)
  })
})

describe('upsertExtraction', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('creates new extraction when none exists', async () => {
    const extraction = makeExtraction({ contentType: 'educational' })
    const now = new Date()

    db._insertChain.returning.mockResolvedValue([
      {
        id: 'new-id-123',
        videoId: 1,
        contentType: 'educational',
        extraction,
        createdAt: now,
        updatedAt: now,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await upsertExtraction(1, extraction, db as any)

    expect(result.videoId).toBe(1)
    expect(result.contentType).toBe('educational')
    expect(result.id).toBeDefined()
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
    expect(db.insert).toHaveBeenCalled()
    expect(db._insertChain.onConflictDoUpdate).toHaveBeenCalled()
  })

  it('updates existing extraction', async () => {
    const firstTime = new Date('2024-01-01T00:00:00Z')
    const secondTime = new Date('2024-01-01T00:01:00Z')

    const initialExtraction = makeExtraction({ contentType: 'dev' })
    const updatedExtraction = makeExtraction({ contentType: 'meeting' })

    db._insertChain.returning
      .mockResolvedValueOnce([
        {
          id: 'same-id',
          videoId: 1,
          contentType: 'dev',
          extraction: initialExtraction,
          createdAt: firstTime,
          updatedAt: firstTime,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'same-id',
          videoId: 1,
          contentType: 'meeting',
          extraction: { ...updatedExtraction, summary: { ...updatedExtraction.summary, tldr: 'Updated TLDR' } },
          createdAt: firstTime,
          updatedAt: secondTime,
        },
      ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = await upsertExtraction(1, initialExtraction, db as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await upsertExtraction(1, updatedExtraction, db as any)

    expect(second.id).toBe(first.id)
    expect(second.contentType).toBe('meeting')
    expect(second.extraction.summary.tldr).toBe('Updated TLDR')
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime())
  })

  it('enforces one extraction per video via onConflictDoUpdate', async () => {
    const extraction = makeExtraction()
    const now = new Date()

    db._insertChain.returning.mockResolvedValue([
      {
        id: 'same-id',
        videoId: 1,
        contentType: 'dev',
        extraction,
        createdAt: now,
        updatedAt: now,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await upsertExtraction(1, extraction, db as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await upsertExtraction(1, extraction, db as any)

    // Both calls should use onConflictDoUpdate to enforce one-per-video
    expect(db._insertChain.onConflictDoUpdate).toHaveBeenCalledTimes(2)
  })
})

describe('deleteExtraction', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('deletes extraction', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteExtraction(1, db as any)

    expect(db.delete).toHaveBeenCalled()
    expect(db._deleteChain.where).toHaveBeenCalled()
  })

  it('does not throw when deleting non-existent extraction', async () => {
    db._deleteChain.where.mockResolvedValue([])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(deleteExtraction(999, db as any)).resolves.not.toThrow()
  })
})

describe('edge cases', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  it('handles empty arrays in extraction', async () => {
    const extraction = makeExtraction({
      contentType: 'general',
      summary: { tldr: 'Test TLDR', overview: 'Test overview', keyPoints: [] },
      insights: [],
      actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
    })
    const now = new Date()

    db._selectChain.limit.mockResolvedValue([
      {
        id: 'abc',
        videoId: 1,
        contentType: 'general',
        extraction,
        createdAt: now,
        updatedAt: now,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getExtractionForVideo(1, db as any)
    expect(result?.extraction.insights).toEqual([])
    expect(result?.extraction.summary.keyPoints).toEqual([])
    expect(result?.extraction.actionItems.immediate).toEqual([])
  })

  it('handles large extraction data', async () => {
    const insights = Array.from({ length: 100 }, (_, i) => ({
      title: `Insight ${i}`,
      timestamp: '00:05:30',
      explanation: `Explanation ${i} `.repeat(50),
      actionable: `Action ${i}`,
    }))

    const extraction = makeExtraction({
      summary: {
        tldr: 'Test TLDR',
        overview: 'Test overview '.repeat(100),
        keyPoints: Array.from({ length: 50 }, (_, i) => `Key point ${i}`),
      },
      insights,
      actionItems: {
        immediate: Array.from({ length: 20 }, (_, i) => `Immediate ${i}`),
        shortTerm: Array.from({ length: 20 }, (_, i) => `Short term ${i}`),
        longTerm: Array.from({ length: 20 }, (_, i) => `Long term ${i}`),
        resources: Array.from({ length: 20 }, (_, i) => ({
          name: `Resource ${i}`,
          description: `Description ${i}`,
        })),
      },
    })
    const now = new Date()

    db._selectChain.limit.mockResolvedValue([
      {
        id: 'abc',
        videoId: 1,
        contentType: 'dev',
        extraction,
        createdAt: now,
        updatedAt: now,
      },
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getExtractionForVideo(1, db as any)
    expect(result?.extraction.insights).toHaveLength(100)
    expect(result?.extraction.summary.keyPoints).toHaveLength(50)
    expect(result?.extraction.actionItems.immediate).toHaveLength(20)
  })
})
