import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database module
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
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
const { enqueueJob, claimNextJob, completeJob, failJob, getJobsByStatus } = await import('../queue')

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
    })

    const job = await claimNextJob()

    expect(job).toBeNull()
  })

  it('claims the oldest pending job', async () => {
    const pendingJob = {
      id: 1,
      type: 'fetch_transcript',
      payload: { videoId: 123 },
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    }

    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([pendingJob])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
    })

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockUpdateWhere,
    })

    const job = await claimNextJob()

    expect(job).toBeDefined()
    expect(job?.id).toBe(1)
    expect(job?.status).toBe('processing')
    expect(job?.attempts).toBe(1)
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith({
      status: 'processing',
      startedAt: expect.any(Date),
      attempts: 1,
    })
  })

  it('filters by type when specified', async () => {
    const mockFrom = vi.fn().mockReturnThis()
    const mockWhere = vi.fn().mockReturnThis()
    const mockOrderBy = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockResolvedValue([])

    mockDb.select.mockReturnValue({
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
    })

    await claimNextJob('generate_embeddings')

    expect(mockDb.select).toHaveBeenCalled()
    expect(mockWhere).toHaveBeenCalled()
  })

  it('sets status to processing and increments attempts', async () => {
    const pendingJob = {
      id: 5,
      type: 'fetch_transcript',
      payload: {},
      status: 'pending',
      attempts: 2,
      createdAt: new Date(),
    }

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([pendingJob]),
    })

    const mockSet = vi.fn().mockReturnThis()
    const mockUpdateWhere = vi.fn().mockResolvedValue([])

    mockDb.update.mockReturnValue({
      set: mockSet,
      where: mockUpdateWhere,
    })

    const job = await claimNextJob()

    expect(job?.attempts).toBe(3)
    expect(mockSet).toHaveBeenCalledWith({
      status: 'processing',
      startedAt: expect.any(Date),
      attempts: 3,
    })
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await claimNextJob(undefined, customDb as any)

    expect(customDb.select).toHaveBeenCalledTimes(1)
    expect(mockDb.select).not.toHaveBeenCalled()
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await failJob(1, 'Test error', customDb as any)

    expect(customDb.select).toHaveBeenCalledTimes(1)
    expect(customDb.update).toHaveBeenCalledTimes(1)
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getJobsByStatus('pending', customDb as any)

    expect(customDb.select).toHaveBeenCalledTimes(1)
    expect(mockDb.select).not.toHaveBeenCalled()
  })
})
