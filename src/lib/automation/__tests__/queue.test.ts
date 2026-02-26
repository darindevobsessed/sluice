/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database module
const mockTx = {
  select: vi.fn(),
  update: vi.fn(),
}
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
}

const mockJobs = {
  id: 'id',
  type: 'type',
  payload: 'payload',
  status: 'status',
  attempts: 'attempts',
  maxAttempts: 'maxAttempts',
  error: 'error',
  createdAt: 'createdAt',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
}

vi.mock('@/lib/db', () => ({
  db: mockDb,
  jobs: mockJobs,
}))

// Import after mocking
const { enqueueJob, claimNextJob, completeJob, failJob, getJobsByStatus, recoverStaleJobs, failEmbeddingJob, getBackoffMs } = await import('../queue')

describe('getBackoffMs', () => {
  it('returns 0 for 0 attempts', () => {
    expect(getBackoffMs(0)).toBe(0)
  })

  it('returns 5 minutes for 1 attempt', () => {
    expect(getBackoffMs(1)).toBe(5 * 60 * 1000)
  })

  it('returns 10 minutes for 2 attempts', () => {
    expect(getBackoffMs(2)).toBe(10 * 60 * 1000)
  })

  it('returns 20 minutes for 3 attempts', () => {
    expect(getBackoffMs(3)).toBe(20 * 60 * 1000)
  })

  it('returns 40 minutes for 4 attempts (below cap)', () => {
    expect(getBackoffMs(4)).toBe(40 * 60 * 1000)
  })

  it('caps at 1 hour for high attempt counts', () => {
    const oneHour = 60 * 60 * 1000
    expect(getBackoffMs(10)).toBe(oneHour)
    expect(getBackoffMs(100)).toBe(oneHour)
  })

  it('returns 0 for negative attempts', () => {
    expect(getBackoffMs(-1)).toBe(0)
  })
})

describe('enqueueJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a job with correct type and payload', async () => {
    const mockValues = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([{ id: 1 }])

    mockDb.insert.mockReturnValue({
      values: mockValues,
      returning: mockReturning,
    })

    const payload = { videoId: 123, youtubeId: 'abc123' }
    await enqueueJob('fetch_transcript', payload)

    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockValues).toHaveBeenCalledWith({
      type: 'fetch_transcript',
      payload,
    })
    expect(mockReturning).toHaveBeenCalled()
  })

  it('returns the job ID', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 42 }]),
    })

    const payload = { videoId: 123 }
    const jobId = await enqueueJob('generate_embeddings', payload)

    expect(jobId).toBe(42)
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }

    const payload = { test: true }
    await enqueueJob('fetch_transcript', payload, customDb as any)

    expect(customDb.insert).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })
})

describe('claimNextJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no pending jobs', async () => {
    // Mock transaction with select returning empty array
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([])

    mockTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    const job = await claimNextJob()

    expect(job).toBeNull()
    expect(mockDb.transaction).toHaveBeenCalled()
    expect(mockTx.select).toHaveBeenCalled()
  })

  it('claims the oldest pending job atomically', async () => {
    const pendingJob = {
      id: 1,
      type: 'fetch_transcript',
      payload: { videoId: 123 },
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    }

    const claimedJob = {
      ...pendingJob,
      status: 'processing',
      attempts: 1,
      startedAt: new Date(),
    }

    // Mock select chain
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([pendingJob])

    mockTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    // Mock update chain
    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([claimedJob])

    mockTx.update.mockReturnValue({
      set: mockSet,
      where: mockUpdateWhere,
      returning: mockReturning,
    })

    const job = await claimNextJob()

    expect(job).toBeDefined()
    expect(job?.id).toBe(1)
    expect(job?.status).toBe('processing')
    expect(job?.attempts).toBe(1)
    expect(mockDb.transaction).toHaveBeenCalled()
  })

  it('filters by type when specified', async () => {
    // Mock select chain
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([])

    mockTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    await claimNextJob('generate_embeddings')

    expect(mockDb.transaction).toHaveBeenCalled()
    expect(mockTx.select).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
  })

  it('atomically claims job with correct attempts increment', async () => {
    const pendingJob = {
      id: 5,
      type: 'fetch_transcript',
      payload: {},
      status: 'pending',
      attempts: 2,
      maxAttempts: 3,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    }

    const claimedJob = {
      ...pendingJob,
      status: 'processing',
      attempts: 3,
      startedAt: new Date(),
    }

    // Mock select chain
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([pendingJob])

    mockTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    // Mock update chain
    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([claimedJob])

    mockTx.update.mockReturnValue({
      set: mockSet,
      where: mockUpdateWhere,
      returning: mockReturning,
    })

    const job = await claimNextJob()

    expect(job?.attempts).toBe(3)
    expect(job?.status).toBe('processing')
  })

  it('uses custom db instance when provided', async () => {
    const customTx = {
      select: vi.fn(),
      update: vi.fn(),
    }
    const customDb = {
      transaction: vi.fn(async (cb: (tx: typeof customTx) => Promise<unknown>) => cb(customTx)),
    }

    // Mock select chain
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([])

    customTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    await claimNextJob(undefined, customDb as any)

    expect(customDb.transaction).toHaveBeenCalledTimes(1)
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('skips generate_embeddings job still in backoff window', async () => {
    // Job with attempts=1, startedAt=30 seconds ago — backoff is 5 minutes, so still in window
    const startedAt = new Date(Date.now() - 30 * 1000)
    const pendingJob = {
      id: 10,
      type: 'generate_embeddings',
      payload: { videoId: 99 },
      status: 'pending',
      attempts: 1,
      maxAttempts: 999,
      error: null,
      createdAt: new Date(),
      startedAt,
      completedAt: null,
    }

    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([pendingJob])

    mockTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    const job = await claimNextJob()

    // Should return null — job is in backoff window
    expect(job).toBeNull()
    // Update should NOT have been called
    expect(mockTx.update).not.toHaveBeenCalled()
  })

  it('claims generate_embeddings job past the backoff window', async () => {
    // Job with attempts=1, startedAt=10 minutes ago — backoff is 5 minutes, so past window
    const startedAt = new Date(Date.now() - 10 * 60 * 1000)
    const pendingJob = {
      id: 11,
      type: 'generate_embeddings',
      payload: { videoId: 100 },
      status: 'pending',
      attempts: 1,
      maxAttempts: 999,
      error: null,
      createdAt: new Date(),
      startedAt,
      completedAt: null,
    }

    const claimedJob = {
      ...pendingJob,
      status: 'processing',
      attempts: 2,
      startedAt: new Date(),
    }

    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([pendingJob])

    mockTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([claimedJob])

    mockTx.update.mockReturnValue({
      set: mockSet,
      where: mockUpdateWhere,
      returning: mockReturning,
    })

    const job = await claimNextJob()

    // Should claim the job — backoff window has passed
    expect(job).not.toBeNull()
    expect(job?.id).toBe(11)
    expect(mockTx.update).toHaveBeenCalled()
  })

  it('does NOT apply backoff to fetch_transcript jobs', async () => {
    // fetch_transcript job with attempts=2 and recent startedAt — should NOT be blocked
    const startedAt = new Date(Date.now() - 30 * 1000)
    const pendingJob = {
      id: 12,
      type: 'fetch_transcript',
      payload: { videoId: 101 },
      status: 'pending',
      attempts: 2,
      maxAttempts: 3,
      error: null,
      createdAt: new Date(),
      startedAt,
      completedAt: null,
    }

    const claimedJob = {
      ...pendingJob,
      status: 'processing',
      attempts: 3,
      startedAt: new Date(),
    }

    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([pendingJob])

    mockTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([claimedJob])

    mockTx.update.mockReturnValue({
      set: mockSet,
      where: mockUpdateWhere,
      returning: mockReturning,
    })

    const job = await claimNextJob()

    // Should claim the job — fetch_transcript is not subject to backoff
    expect(job).not.toBeNull()
    expect(job?.id).toBe(12)
    expect(mockTx.update).toHaveBeenCalled()
  })

  it('does not apply backoff when generate_embeddings has 0 attempts', async () => {
    // First-time run: attempts=0, no startedAt — should claim immediately
    const pendingJob = {
      id: 13,
      type: 'generate_embeddings',
      payload: { videoId: 102 },
      status: 'pending',
      attempts: 0,
      maxAttempts: 999,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    }

    const claimedJob = {
      ...pendingJob,
      status: 'processing',
      attempts: 1,
      startedAt: new Date(),
    }

    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockFor = vi.fn().mockResolvedValue([pendingJob])

    mockTx.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      for: mockFor,
    })

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([claimedJob])

    mockTx.update.mockReturnValue({
      set: mockSet,
      where: mockUpdateWhere,
      returning: mockReturning,
    })

    const job = await claimNextJob()

    expect(job).not.toBeNull()
    expect(job?.id).toBe(13)
    expect(mockTx.update).toHaveBeenCalled()
  })
})

describe('completeJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets status to completed with timestamp', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
    })

    await completeJob(1)

    expect(mockDb.update).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith({
      status: 'completed',
      completedAt: expect.any(Date),
    })
    expect(mockWhere).toHaveBeenCalled()
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }),
    }

    await completeJob(1, customDb as any)

    expect(customDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})

describe('failJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets to pending when under max attempts', async () => {
    const job = {
      id: 1,
      attempts: 1,
      maxAttempts: 3,
    }

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([job]),
    })

    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
    })

    await failJob(1, 'Test error')

    expect(mockSet).toHaveBeenCalledWith({
      status: 'pending',
      error: 'Test error',
    })
  })

  it('marks as failed permanently when at max attempts', async () => {
    const job = {
      id: 1,
      attempts: 3,
      maxAttempts: 3,
    }

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([job]),
    })

    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
    })

    await failJob(1, 'Max attempts reached')

    expect(mockSet).toHaveBeenCalledWith({
      status: 'failed',
      error: 'Max attempts reached',
    })
  })

  it('records error message', async () => {
    const job = {
      id: 1,
      attempts: 0,
      maxAttempts: 3,
    }

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([job]),
    })

    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
    })

    const errorMessage = 'Network timeout'
    await failJob(1, errorMessage)

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        error: errorMessage,
      })
    )
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ id: 1, attempts: 1, maxAttempts: 3 }]),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }),
    }

    await failJob(1, 'Test error', customDb as any)

    expect(customDb.select).toHaveBeenCalledTimes(1)
    expect(customDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})

describe('failEmbeddingJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('always sets status to pending regardless of attempts', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
    })

    await failEmbeddingJob(1, 'ONNX model failed')

    expect(mockDb.update).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith({
      status: 'pending',
      error: 'ONNX model failed',
      startedAt: expect.any(Date),
    })
    expect(mockWhere).toHaveBeenCalled()
  })

  it('resets to pending even after many attempts (retry-forever)', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
    })

    // High attempt count — still resets to pending
    await failEmbeddingJob(99, 'Embedding model unavailable')

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    )
  })

  it('updates startedAt for backoff calculation', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
    })

    const before = Date.now()
    await failEmbeddingJob(5, 'timeout')
    const after = Date.now()

    const setArg = mockSet.mock.calls[0]?.[0] as { startedAt: Date }
    expect(setArg.startedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(setArg.startedAt.getTime()).toBeLessThanOrEqual(after)
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }),
    }

    await failEmbeddingJob(1, 'Test error', customDb as any)

    expect(customDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})

describe('recoverStaleJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets stale processing jobs to pending', async () => {
    const staleJobs = [
      { id: 1, status: 'processing', type: 'generate_embeddings' },
      { id: 2, status: 'processing', type: 'fetch_transcript' },
    ]

    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue(staleJobs)

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    })

    const count = await recoverStaleJobs()

    expect(mockDb.update).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith({
      status: 'pending',
      error: 'Recovered: job exceeded 10 minute processing timeout',
    })
    expect(mockReturning).toHaveBeenCalled()
    expect(count).toBe(2)
  })

  it('returns 0 when no stale jobs exist', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    })

    const count = await recoverStaleJobs()

    expect(count).toBe(0)
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      }),
    }

    const count = await recoverStaleJobs(customDb as any)

    expect(customDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.update).not.toHaveBeenCalled()
    expect(count).toBe(0)
  })

  it('filters by processing status only', async () => {
    const mockSet = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockReturning = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockWhere,
      returning: mockReturning,
    })

    await recoverStaleJobs()

    // The where clause should have been called (with and() combining status + startedAt conditions)
    expect(mockWhere).toHaveBeenCalled()
  })
})

describe('getJobsByStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns jobs filtered by status', async () => {
    const completedJobs = [
      { id: 1, status: 'completed', type: 'fetch_transcript' },
      { id: 2, status: 'completed', type: 'generate_embeddings' },
    ]

    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockResolvedValue(completedJobs)

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
    })

    const result = await getJobsByStatus('completed')

    expect(mockDb.select).toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
    expect(mockOrderBy).toHaveBeenCalled()
    expect(result).toEqual(completedJobs)
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }

    await getJobsByStatus('pending', customDb as any)

    expect(customDb.select).toHaveBeenCalledTimes(1)
    expect(mockDb.select).not.toHaveBeenCalled()
  })
})
