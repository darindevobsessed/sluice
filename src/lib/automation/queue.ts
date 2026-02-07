import { db as defaultDb } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import type { JobType } from './types'

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
 * Claim the next pending job for processing
 * @param type - Optional job type filter
 * @param dbInstance - Database instance (for testing)
 * @returns Job or null if none available
 */
export async function claimNextJob(
  type?: JobType,
  dbInstance = defaultDb
) {
  // Build the WHERE conditions
  const conditions = [eq(jobs.status, 'pending')]
  if (type) {
    conditions.push(eq(jobs.type, type))
  }

  // Find next pending job
  const pending = await dbInstance.select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(asc(jobs.createdAt))
    .limit(1)

  const job = pending[0]
  if (!job) return null

  // Claim it
  await dbInstance.update(jobs)
    .set({
      status: 'processing',
      startedAt: new Date(),
      attempts: job.attempts + 1,
    })
    .where(eq(jobs.id, job.id))

  return { ...job, status: 'processing' as const, attempts: job.attempts + 1, startedAt: new Date() }
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
