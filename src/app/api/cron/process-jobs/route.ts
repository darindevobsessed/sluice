import { NextResponse } from 'next/server'
import { claimNextJob, completeJob, failJob } from '@/lib/automation/queue'
import { processJob } from '@/lib/automation/processor'
import { verifyCronSecret } from '@/lib/auth-guards'

export async function GET(request: Request) {
  // Verify cron secret (timing-safe, rejects when env unset)
  const authResult = verifyCronSecret(request)
  if (!authResult.valid) {
    return authResult.response
  }

  const results = { processed: 0, failed: 0 }
  const maxJobs = 5 // Process up to 5 jobs per invocation (conservative for Vercel timeout)

  try {
    for (let i = 0; i < maxJobs; i++) {
      const job = await claimNextJob()
      if (!job) break

      try {
        await processJob(job)
        await completeJob(job.id)
        results.processed++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await failJob(job.id, message)
        results.failed++
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
export const maxDuration = 60
