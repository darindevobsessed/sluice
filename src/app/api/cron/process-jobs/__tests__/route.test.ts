import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from '../route'

// Mock all dependencies
vi.mock('@/lib/automation/queue', () => ({
  claimNextJob: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
}))

vi.mock('@/lib/automation/processor', () => ({
  processJob: vi.fn(),
}))

import { claimNextJob, completeJob, failJob } from '@/lib/automation/queue'
import { processJob } from '@/lib/automation/processor'

function mockJob(overrides: { id: number, type: string, payload: unknown }) {
  return {
    ...overrides,
    status: 'processing' as const,
    attempts: 1,
    maxAttempts: 3,
    error: null,
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
  }
}

describe('GET /api/cron/process-jobs', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret' }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 when no auth header', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const text = await response.text()
    expect(text).toBe('Unauthorized')
  })

  it('returns 401 when wrong auth', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer wrong-secret',
      },
    })
    const response = await GET(request)

    expect(response.status).toBe(401)
    const text = await response.text()
    expect(text).toBe('Unauthorized')
  })

  it('returns success with 0 processed when no pending jobs', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer test-secret',
      },
    })

    vi.mocked(claimNextJob).mockResolvedValue(null)

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ processed: 0, failed: 0 })
  })

  it('processes multiple jobs successfully', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer test-secret',
      },
    })

    const job1 = mockJob({ id: 1, type: 'fetch_transcript', payload: { videoId: 123, youtubeId: 'abc123' } })
    const job2 = mockJob({ id: 2, type: 'generate_embeddings', payload: { videoId: 456 } })

    // Mock claiming two jobs, then no more jobs
    vi.mocked(claimNextJob)
      .mockResolvedValueOnce(job1)
      .mockResolvedValueOnce(job2)
      .mockResolvedValueOnce(null)

    vi.mocked(processJob).mockResolvedValue(undefined)
    vi.mocked(completeJob).mockResolvedValue(undefined)

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ processed: 2, failed: 0 })

    expect(claimNextJob).toHaveBeenCalledTimes(3)
    expect(processJob).toHaveBeenCalledTimes(2)
    expect(processJob).toHaveBeenCalledWith(job1)
    expect(processJob).toHaveBeenCalledWith(job2)
    expect(completeJob).toHaveBeenCalledTimes(2)
    expect(completeJob).toHaveBeenCalledWith(1)
    expect(completeJob).toHaveBeenCalledWith(2)
  })

  it('handles job failure and calls failJob', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer test-secret',
      },
    })

    const job = mockJob({ id: 1, type: 'fetch_transcript', payload: { videoId: 123, youtubeId: 'abc123' } })

    vi.mocked(claimNextJob).mockResolvedValueOnce(job).mockResolvedValueOnce(null)

    vi.mocked(processJob).mockRejectedValueOnce(new Error('Transcript fetch failed'))
    vi.mocked(failJob).mockResolvedValue(undefined)

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ processed: 0, failed: 1 })

    expect(processJob).toHaveBeenCalledWith(job)
    expect(failJob).toHaveBeenCalledWith(1, 'Transcript fetch failed')
    expect(completeJob).not.toHaveBeenCalled()
  })

  it('stops processing after maxJobs', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer test-secret',
      },
    })

    // Create 6 jobs (more than maxJobs of 5)
    const jobs = Array.from({ length: 6 }, (_, i) =>
      mockJob({ id: i + 1, type: 'fetch_transcript', payload: { videoId: i + 1, youtubeId: `video${i + 1}` } })
    )

    // Mock claiming jobs - all 6 available
    vi.mocked(claimNextJob).mockImplementation(async () => {
      const job = jobs.shift()
      return job ?? null
    })

    vi.mocked(processJob).mockResolvedValue(undefined)
    vi.mocked(completeJob).mockResolvedValue(undefined)

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    // Should only process 5, not 6
    expect(data).toEqual({ processed: 5, failed: 0 })

    expect(claimNextJob).toHaveBeenCalledTimes(5)
    expect(processJob).toHaveBeenCalledTimes(5)
  })

  it('returns 500 on critical error', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer test-secret',
      },
    })

    // Mock a critical error at the top level
    vi.mocked(claimNextJob).mockRejectedValue(new Error('Database connection failed'))

    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toEqual({ error: 'Failed to process jobs' })
  })

  it('handles mixed success and failure', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer test-secret',
      },
    })

    const job1 = mockJob({ id: 1, type: 'fetch_transcript', payload: { videoId: 123, youtubeId: 'abc123' } })
    const job2 = mockJob({ id: 2, type: 'generate_embeddings', payload: { videoId: 456 } })
    const job3 = mockJob({ id: 3, type: 'fetch_transcript', payload: { videoId: 789, youtubeId: 'xyz789' } })

    vi.mocked(claimNextJob)
      .mockResolvedValueOnce(job1)
      .mockResolvedValueOnce(job2)
      .mockResolvedValueOnce(job3)
      .mockResolvedValueOnce(null)

    // job1 succeeds, job2 fails, job3 succeeds
    vi.mocked(processJob)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Embedding failed'))
      .mockResolvedValueOnce(undefined)

    vi.mocked(completeJob).mockResolvedValue(undefined)
    vi.mocked(failJob).mockResolvedValue(undefined)

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ processed: 2, failed: 1 })

    expect(completeJob).toHaveBeenCalledTimes(2)
    expect(completeJob).toHaveBeenCalledWith(1)
    expect(completeJob).toHaveBeenCalledWith(3)
    expect(failJob).toHaveBeenCalledTimes(1)
    expect(failJob).toHaveBeenCalledWith(2, 'Embedding failed')
  })

  it('handles non-Error thrown values', async () => {
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: {
        authorization: 'Bearer test-secret',
      },
    })

    const job = mockJob({ id: 1, type: 'fetch_transcript', payload: { videoId: 123, youtubeId: 'abc123' } })

    vi.mocked(claimNextJob).mockResolvedValueOnce(job).mockResolvedValueOnce(null)

    // Throw a non-Error value
    vi.mocked(processJob).mockRejectedValueOnce('String error')
    vi.mocked(failJob).mockResolvedValue(undefined)

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ processed: 0, failed: 1 })

    expect(failJob).toHaveBeenCalledWith(1, 'Unknown error')
  })
})
