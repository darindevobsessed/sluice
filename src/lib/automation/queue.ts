import { db as defaultDb } from '@/lib/db'
import { jobs, videos, chunks } from '@/lib/db/schema'
import type { Job } from '@/lib/db/schema'
import { eq, and, asc, lt, sql } from 'drizzle-orm'
import type { JobType } from './types'

/**
 * Compute exponential backoff delay for a given attempt count.
 * Base: 5 minutes, multiplier: 2x per retry, cap: 1 hour.
 * Returns 0 for attempts <= 0 (no delay on first run).
 */
export function getBackoffMs(attempts: number): number {
  const BASE_MS = 5 * 60 * 1000 // 5 minutes
  const CAP_MS = 60 * 60 * 1000 // 1 hour
  if (attempts <= 0) return 0
  return Math.min(BASE_MS * Math.pow(2, attempts - 1), CAP_MS)
}

/**
 * Enqueue a new job
 * @param type - Job type (fetch_transcript | generate_embeddings)
 * @param payload - Job-specific data
 * @param dbInstance - Database instance (for testing)
 * @returns Job ID
 */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  dbInstance = defaultDb
): Promise<number> {
  const result = await dbInstance.insert(jobs).values({ type, payload }).returning()
  const job = result[0]
  if (!job) throw new Error('Failed to create job')
  return job.id
}

/**
 * Claim the next pending job for processing (atomically)
 * Uses SELECT FOR UPDATE SKIP LOCKED in a transaction to prevent race conditions.
 * For generate_embeddings jobs with prior attempts, respects exponential backoff
 * using the startedAt timestamp from the last attempt.
 * @param type - Optional job type filter
 * @param dbInstance - Database instance (for testing)
 * @returns Job or null if none available
 */
export async function claimNextJob(
  type?: JobType,
  dbInstance = defaultDb
): Promise<Job | null> {
  return dbInstance.transaction(async (tx) => {
    // Build WHERE conditions
    const conditions = [eq(jobs.status, 'pending')]
    if (type) conditions.push(eq(jobs.type, type))

    // SELECT with FOR UPDATE SKIP LOCKED
    const [nextJob] = await tx.select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(asc(jobs.createdAt))
      .limit(1)
      .for('update', { skipLocked: true })

    if (!nextJob) return null

    // Apply backoff for generate_embeddings jobs on retry attempts
    if (
      nextJob.type === 'generate_embeddings' &&
      nextJob.attempts > 0 &&
      nextJob.startedAt
    ) {
      const backoffMs = getBackoffMs(nextJob.attempts)
      if (nextJob.startedAt.getTime() + backoffMs > Date.now()) {
        return null
      }
    }

    // UPDATE the claimed job
    const [claimed] = await tx.update(jobs)
      .set({
        status: 'processing',
        startedAt: new Date(),
        attempts: nextJob.attempts + 1,
      })
      .where(eq(jobs.id, nextJob.id))
      .returning()

    return claimed ?? null
  })
}

/**
 * Mark a job as completed
 * @param jobId - Job ID
 * @param dbInstance - Database instance (for testing)
 */
export async function completeJob(jobId: number, dbInstance = defaultDb): Promise<void> {
  await dbInstance.update(jobs)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(jobs.id, jobId))
}

/**
 * Mark a job as failed
 * If attempts < maxAttempts, reset to pending for retry
 * Otherwise, mark as failed permanently
 * @param jobId - Job ID
 * @param error - Error message
 * @param dbInstance - Database instance (for testing)
 */
export async function failJob(jobId: number, error: string, dbInstance = defaultDb): Promise<void> {
  // Get the job to check attempts vs maxAttempts
  const result = await dbInstance.select().from(jobs).where(eq(jobs.id, jobId))
  const job = result[0]
  if (!job) return

  // If attempts >= maxAttempts, mark as failed permanently
  // Otherwise, reset to pending for retry
  const newStatus = job.attempts >= job.maxAttempts ? 'failed' : 'pending'

  await dbInstance.update(jobs)
    .set({ status: newStatus, error })
    .where(eq(jobs.id, jobId))
}

/**
 * Fail an embedding job and reset to pending for retry-forever semantics.
 * Unlike failJob, this never permanently fails — ONNX is free local infrastructure
 * so embedding jobs always get retried. Updates startedAt so backoff is calculated
 * from this failure timestamp.
 * @param jobId - Job ID
 * @param error - Error message
 * @param dbInstance - Database instance (for testing)
 */
export async function failEmbeddingJob(
  jobId: number,
  error: string,
  dbInstance = defaultDb
): Promise<void> {
  await dbInstance.update(jobs)
    .set({
      status: 'pending',
      error,
      startedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
}

/**
 * Get all jobs with a specific status
 * @param status - Job status to filter by
 * @param dbInstance - Database instance (for testing)
 * @returns Array of jobs
 */
export async function getJobsByStatus(
  status: string,
  dbInstance = defaultDb
) {
  return dbInstance.select()
    .from(jobs)
    .where(eq(jobs.status, status))
    .orderBy(asc(jobs.createdAt))
}

const STALE_JOB_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Recover jobs stuck in processing state beyond the stale timeout.
 * A job is considered stale if it has been processing for more than 10 minutes
 * (indicates a crashed worker or unhandled error). Resets them to pending so
 * they can be claimed again.
 * @param dbInstance - Database instance (for testing)
 * @returns Number of jobs recovered
 */
export async function recoverStaleJobs(dbInstance = defaultDb): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_JOB_TIMEOUT_MS)
  const result = await dbInstance.update(jobs)
    .set({ status: 'pending', error: 'Recovered: job exceeded 10 minute processing timeout' })
    .where(
      and(
        eq(jobs.status, 'processing'),
        lt(jobs.startedAt, cutoff)
      )
    )
    .returning()
  return result.length
}

/**
 * Detect orphan videos: have a transcript but zero chunks and no pending/processing
 * embedding job. These are videos where embedding failed silently.
 * Enqueues a generate_embeddings job for each orphan.
 * Returns the count of jobs enqueued.
 */
export async function detectOrphanVideos(dbInstance = defaultDb): Promise<number> {
  // Find videos that:
  // 1. Have a non-null, non-empty transcript
  // 2. Have zero chunks
  // 3. Have no pending or processing generate_embeddings job
  const orphans = await dbInstance.execute(sql`
    SELECT v.id
    FROM videos v
    LEFT JOIN chunks c ON c.video_id = v.id
    WHERE v.transcript IS NOT NULL
      AND v.transcript != ''
      AND c.id IS NULL
      AND v.id NOT IN (
        SELECT (j.payload->>'videoId')::int
        FROM jobs j
        WHERE j.type = 'generate_embeddings'
          AND j.status IN ('pending', 'processing')
      )
  `)

  let enqueued = 0
  for (const row of orphans.rows) {
    const videoId = (row as { id: number }).id
    await enqueueJob('generate_embeddings', { videoId }, dbInstance)
    enqueued++
  }

  return enqueued
}
