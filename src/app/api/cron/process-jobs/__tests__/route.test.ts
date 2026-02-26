import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from '../route'

vi.mock('@/lib/automation/queue', () => ({
  claimNextJob: vi.fn(),
  completeJob: vi.fn(),
  failJob: vi.fn(),
  recoverStaleJobs: vi.fn(),
  detectOrphanVideos: vi.fn(),
  failEmbeddingJob: vi.fn(),
}))

vi.mock('@/lib/automation/processor', () => ({
  processJob: vi.fn(),
}))

import { claimNextJob, completeJob, failJob, recoverStaleJobs, detectOrphanVideos, failEmbeddingJob } from '@/lib/automation/queue'
import { processJob } from '@/lib/automation/processor'

function authedRequest() {
  return new Request('http://localhost/api/cron/process-jobs', {
    headers: { authorization: 'Bearer test-secret' },
  })
}

function mockJob(overrides: { id: number; type: string; payload: unknown }) {
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
    vi.mocked(recoverStaleJobs).mockResolvedValue(0)
    vi.mocked(detectOrphanVideos).mockResolvedValue(0)
    vi.mocked(claimNextJob).mockResolvedValue(null)
    vi.mocked(completeJob).mockResolvedValue(undefined)
    vi.mocked(failJob).mockResolvedValue(undefined)
    vi.mocked(failEmbeddingJob).mockResolvedValue(undefined)
    vi.mocked(processJob).mockResolvedValue(undefined)
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
      headers: { authorization: 'Bearer wrong-secret' },
    })
    const response = await GET(request)

    expect(response.status).toBe(401)
    const text = await response.text()
    expect(text).toBe('Unauthorized')
  })

  it('returns 401 when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const request = new Request('http://localhost/api/cron/process-jobs', {
      headers: { authorization: 'Bearer undefined' },
    })
    const response = await GET(request)

    expect(response.status).toBe(401)
    const text = await response.text()
    expect(text).toBe('Unauthorized')
  })

  it('runs all three phases with no work to do and returns all zeros', async () => {
    const response = await GET(authedRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({
      recovered: 0,
      orphansEnqueued: 0,
      embeddingsProcessed: 0,
      embeddingsFailed: 0,
      otherProcessed: 0,
      otherFailed: 0,
    })

    expect(recoverStaleJobs).toHaveBeenCalledTimes(1)
    expect(detectOrphanVideos).toHaveBeenCalledTimes(1)
    expect(claimNextJob).toHaveBeenCalledWith('generate_embeddings')
    expect(claimNextJob).toHaveBeenCalledWith('fetch_transcript')
  })

  it('reports stale recovery and orphan counts in response', async () => {
    vi.mocked(recoverStaleJobs).mockResolvedValue(3)
    vi.mocked(detectOrphanVideos).mockResolvedValue(2)

    const response = await GET(authedRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.recovered).toBe(3)
    expect(data.orphansEnqueued).toBe(2)
  })

  it('processes one embedding job per invocation', async () => {
    const embeddingJob = mockJob({ id: 1, type: 'generate_embeddings', payload: { videoId: 42 } })

    vi.mocked(claimNextJob)
      .mockImplementation(async (type) => {
        if (type === 'generate_embeddings') return embeddingJob
        return null
      })

    const response = await GET(authedRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.embeddingsProcessed).toBe(1)
    expect(data.embeddingsFailed).toBe(0)

    expect(processJob).toHaveBeenCalledWith(embeddingJob)
    expect(completeJob).toHaveBeenCalledWith(embeddingJob.id)
    // claimNextJob for embeddings called exactly once
    expect(claimNextJob).toHaveBeenCalledWith('generate_embeddings')
  })

  it('uses failEmbeddingJob for embedding failures, not failJob', async () => {
    const embeddingJob = mockJob({ id: 7, type: 'generate_embeddings', payload: { videoId: 99 } })

    vi.mocked(claimNextJob)
      .mockImplementation(async (type) => {
        if (type === 'generate_embeddings') return embeddingJob
        return null
      })
    vi.mocked(processJob).mockRejectedValueOnce(new Error('ONNX crash'))

    const response = await GET(authedRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.embeddingsFailed).toBe(1)
    expect(data.embeddingsProcessed).toBe(0)

    expect(failEmbeddingJob).toHaveBeenCalledWith(7, 'ONNX crash')
    expect(failJob).not.toHaveBeenCalled()
  })

  it('uses regular failJob for fetch_transcript failures', async () => {
    const transcriptJob = mockJob({ id: 5, type: 'fetch_transcript', payload: { videoId: 10, youtubeId: 'abc' } })

    // Return the job once, then null so the loop stops after one job
    vi.mocked(claimNextJob)
      .mockImplementation(async (type) => {
        if (type === 'generate_embeddings') return null
        return null
      })
    vi.mocked(claimNextJob)
      .mockResolvedValueOnce(null)         // generate_embeddings call
      .mockResolvedValueOnce(transcriptJob) // first fetch_transcript call
      .mockResolvedValue(null)              // subsequent fetch_transcript calls

    vi.mocked(processJob).mockRejectedValueOnce(new Error('Network timeout'))

    const response = await GET(authedRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.otherFailed).toBe(1)
    expect(data.otherProcessed).toBe(0)

    expect(failJob).toHaveBeenCalledWith(5, 'Network timeout')
    expect(failEmbeddingJob).not.toHaveBeenCalled()
  })

  it('processes embedding and transcript jobs in same invocation', async () => {
    const embeddingJob = mockJob({ id: 1, type: 'generate_embeddings', payload: { videoId: 42 } })
    const transcriptJob = mockJob({ id: 2, type: 'fetch_transcript', payload: { videoId: 10, youtubeId: 'abc' } })

    vi.mocked(claimNextJob)
      .mockImplementation(async (type) => {
        if (type === 'generate_embeddings') return embeddingJob
        if (type === 'fetch_transcript') return transcriptJob
        return null
      })

    // Second call for fetch_transcript returns null (only one transcript job)
    let transcriptCallCount = 0
    vi.mocked(claimNextJob)
      .mockImplementation(async (type) => {
        if (type === 'generate_embeddings') return embeddingJob
        if (type === 'fetch_transcript') {
          transcriptCallCount++
          return transcriptCallCount === 1 ? transcriptJob : null
        }
        return null
      })

    const response = await GET(authedRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.embeddingsProcessed).toBe(1)
    expect(data.otherProcessed).toBe(1)
    expect(completeJob).toHaveBeenCalledWith(embeddingJob.id)
    expect(completeJob).toHaveBeenCalledWith(transcriptJob.id)
  })

  it('processes up to 5 fetch_transcript jobs per invocation', async () => {
    const transcriptJobs = Array.from({ length: 6 }, (_, i) =>
      mockJob({ id: i + 1, type: 'fetch_transcript', payload: { videoId: i + 1, youtubeId: `vid${i + 1}` } })
    )

    let callCount = 0
    vi.mocked(claimNextJob)
      .mockImplementation(async (type) => {
        if (type === 'generate_embeddings') return null
        if (type === 'fetch_transcript') {
          return transcriptJobs[callCount++] ?? null
        }
        return null
      })

    const response = await GET(authedRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.otherProcessed).toBe(5)
    expect(data.otherFailed).toBe(0)
    expect(processJob).toHaveBeenCalledTimes(5)
  })

  it('returns 500 on critical error', async () => {
    vi.mocked(recoverStaleJobs).mockRejectedValue(new Error('Database connection failed'))

    const response = await GET(authedRequest())

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toEqual({ error: 'Failed to process jobs' })
  })

  it('handles non-Error thrown values', async () => {
    const transcriptJob = mockJob({ id: 1, type: 'fetch_transcript', payload: { videoId: 1, youtubeId: 'abc' } })

    let callCount = 0
    vi.mocked(claimNextJob)
      .mockImplementation(async (type) => {
        if (type === 'fetch_transcript') {
          callCount++
          return callCount === 1 ? transcriptJob : null
        }
        return null
      })
    vi.mocked(processJob).mockRejectedValueOnce('String error')

    const response = await GET(authedRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.otherFailed).toBe(1)

    expect(failJob).toHaveBeenCalledWith(1, 'Unknown error')
  })
})
