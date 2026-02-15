import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock modules
vi.mock('@/lib/graph/compute-relationships', () => ({
  computeRelationships: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  const mockDb = {
    delete: vi.fn(() => mockDb),
    execute: vi.fn(),
  }
  return {
    db: mockDb,
    relationships: {},
    chunks: {},
  }
})

// Import after mocking
const { POST } = await import('../route')
const { computeRelationships } = await import('@/lib/graph/compute-relationships')
const { db } = await import('@/lib/db')

describe('POST /api/graph/backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes all relationships and recomputes for all videos', async () => {
    vi.mocked(db.delete).mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    } as any)

    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        { video_id: 1 },
        { video_id: 2 },
        { video_id: 3 },
      ],
    } as any)

    vi.mocked(computeRelationships)
      .mockResolvedValueOnce({ created: 10, skipped: 0 })
      .mockResolvedValueOnce({ created: 15, skipped: 2 })
      .mockResolvedValueOnce({ created: 8, skipped: 1 })

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      videosProcessed: 3,
      relationshipsCreated: 33,
    })

    expect(db.delete).toHaveBeenCalledOnce()
    expect(computeRelationships).toHaveBeenCalledTimes(3)
    expect(computeRelationships).toHaveBeenCalledWith(1)
    expect(computeRelationships).toHaveBeenCalledWith(2)
    expect(computeRelationships).toHaveBeenCalledWith(3)
  })

  it('returns zero counts when no videos have chunks', async () => {
    vi.mocked(db.delete).mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    } as any)

    vi.mocked(db.execute).mockResolvedValue({
      rows: [],
    } as any)

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      videosProcessed: 0,
      relationshipsCreated: 0,
    })

    expect(db.delete).toHaveBeenCalledOnce()
    expect(computeRelationships).not.toHaveBeenCalled()
  })

  it('handles single video with chunks', async () => {
    vi.mocked(db.delete).mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    } as any)

    vi.mocked(db.execute).mockResolvedValue({
      rows: [{ video_id: 42 }],
    } as any)

    vi.mocked(computeRelationships).mockResolvedValue({ created: 5, skipped: 0 })

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      videosProcessed: 1,
      relationshipsCreated: 5,
    })

    expect(computeRelationships).toHaveBeenCalledOnce()
    expect(computeRelationships).toHaveBeenCalledWith(42)
  })

  it('accumulates relationships from all videos', async () => {
    vi.mocked(db.delete).mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    } as any)

    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        { video_id: 10 },
        { video_id: 20 },
      ],
    } as any)

    vi.mocked(computeRelationships)
      .mockResolvedValueOnce({ created: 100, skipped: 20 })
      .mockResolvedValueOnce({ created: 50, skipped: 10 })

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      videosProcessed: 2,
      relationshipsCreated: 150,
    })
  })

  it('returns 500 on database error during delete', async () => {
    vi.mocked(db.delete).mockImplementation(() => {
      throw new Error('Database connection failed')
    })

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Internal server error' })
  })

  it('returns 500 on database error during video query', async () => {
    vi.mocked(db.delete).mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    } as any)

    vi.mocked(db.execute).mockRejectedValue(new Error('Query timeout'))

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Internal server error' })
  })

  it('returns 500 on error during computeRelationships', async () => {
    vi.mocked(db.delete).mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    } as any)

    vi.mocked(db.execute).mockResolvedValue({
      rows: [{ video_id: 1 }],
    } as any)

    vi.mocked(computeRelationships).mockRejectedValue(new Error('Embedding error'))

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Internal server error' })
  })

  it('handles videos where computeRelationships creates zero relationships', async () => {
    vi.mocked(db.delete).mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    } as any)

    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        { video_id: 1 },
        { video_id: 2 },
      ],
    } as any)

    vi.mocked(computeRelationships)
      .mockResolvedValueOnce({ created: 10, skipped: 0 })
      .mockResolvedValueOnce({ created: 0, skipped: 0 })

    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      videosProcessed: 2,
      relationshipsCreated: 10,
    })
  })
})
