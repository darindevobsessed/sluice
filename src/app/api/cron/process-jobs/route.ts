import { NextResponse } from 'next/server'
import { claimNextJob, completeJob, failJob, recoverStaleJobs, detectOrphanVideos, failEmbeddingJob } from '@/lib/automation/queue'
import { processJob } from '@/lib/automation/processor'
import { verifyCronSecret } from '@/lib/auth-guards'

export async function GET(request: Request) {
  // Verify cron secret (timing-safe, rejects when env unset)
  const authResult = verifyCronSecret(request)
  if (!authResult.valid) {
    return authResult.response
  }

  const results = {
    recovered: 0,
    orphansEnqueued: 0,
    embeddingsProcessed: 0,
    embeddingsFailed: 0,
    otherProcessed: 0,
    otherFailed: 0,
  }

  try {
    // Phase 1: Recover stale jobs (processing > 10 min -> pending)
    results.recovered = await recoverStaleJobs()

    // Phase 2: Detect orphan videos (transcript + 0 chunks + no pending job -> enqueue)
    results.orphansEnqueued = await detectOrphanVideos()

    // Phase 3a: Process ONE embedding job (heavy -- avoid Lambda timeout)
    const embeddingJob = await claimNextJob('generate_embeddings')
    if (embeddingJob) {
      try {
        await processJob(embeddingJob)
        await completeJob(embeddingJob.id)
        results.embeddingsProcessed++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await failEmbeddingJob(embeddingJob.id, message)
        results.embeddingsFailed++
      }
    }

    // Phase 3b: Process up to 5 lighter jobs (fetch_transcript, etc.)
    const maxOtherJobs = 5
    for (let i = 0; i < maxOtherJobs; i++) {
      const job = await claimNextJob('fetch_transcript')
      if (!job) break

      try {
        await processJob(job)
        await completeJob(job.id)
        results.otherProcessed++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await failJob(job.id, message)
        results.otherFailed++
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error in process-jobs cron:', error)
    return NextResponse.json(
      { error: 'Failed to process jobs' },
      { status: 500 }
    )
  }
}

/**
 * Configure route segment for Vercel
 * maxDuration allows longer-running operations (requires Pro plan)
 */
export const maxDuration = 300
