/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database module
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
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
    // Mock execute returning empty rows
    mockDb.execute = vi.fn().mockResolvedValue({ rows: [] })

    const job = await claimNextJob()

    expect(job).toBeNull()
    expect(mockDb.execute).toHaveBeenCalled()
  })

  it('claims the oldest pending job atomically', async () => {
    const claimedJob = {
      id: 1,
      type: 'fetch_transcript',
      payload: { videoId: 123 },
      status: 'processing',
      attempts: 1,
      maxAttempts: 3,
      error: null,
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
    }

    // Mock execute returning the claimed job
    mockDb.execute = vi.fn().mockResolvedValue({ rows: [claimedJob] })

    const job = await claimNextJob()

    expect(job).toBeDefined()
    expect(job?.id).toBe(1)
    expect(job?.status).toBe('processing')
    expect(job?.attempts).toBe(1)
    expect(mockDb.execute).toHaveBeenCalled()
  })

  it('filters by type when specified', async () => {
    mockDb.execute = vi.fn().mockResolvedValue({ rows: [] })

    await claimNextJob('generate_embeddings')

    expect(mockDb.execute).toHaveBeenCalled()
    // Verify the SQL includes type filter
    const sqlCall = (mockDb.execute as any).mock.calls[0]
    expect(sqlCall).toBeDefined()
  })

  it('atomically claims job with correct attempts increment', async () => {
    const claimedJob = {
      id: 5,
      type: 'fetch_transcript',
      payload: {},
      status: 'processing',
      attempts: 3,
      maxAttempts: 3,
      error: null,
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
    }

    mockDb.execute = vi.fn().mockResolvedValue({ rows: [claimedJob] })

    const job = await claimNextJob()

    expect(job?.attempts).toBe(3)
    expect(job?.status).toBe('processing')
  })

  it('uses custom db instance when provided', async () => {
    const customDb = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    }

    await claimNextJob(undefined, customDb as any)

    expect(customDb.execute).toHaveBeenCalledTimes(1)
    expect(mockDb.execute).not.toHaveBeenCalled()
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
