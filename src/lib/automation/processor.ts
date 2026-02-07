import { db } from '@/lib/db'
import { videos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { fetchTranscript } from '@/lib/youtube/transcript'
import { parseTranscript } from '@/lib/transcript/parse'
import { chunkTranscript } from '@/lib/embeddings/chunker'
import { embedChunks } from '@/lib/embeddings/service'
import { enqueueJob } from './queue'
import type { Job } from '@/lib/db/schema'
import type { TranscriptSegment } from '@/lib/embeddings/types'

export interface TranscriptJobPayload {
  videoId: number
  youtubeId: string
}

export interface EmbeddingsJobPayload {
  videoId: number
}

export async function processJob(job: Job): Promise<void> {
  switch (job.type) {
    case 'fetch_transcript':
      await processFetchTranscript(job.payload)
      break
    case 'generate_embeddings':
      await processGenerateEmbeddings(job.payload)
      break
    default:
      throw new Error(`Unknown job type: ${job.type}`)
  }
}

async function processFetchTranscript(payload: unknown): Promise<void> {
  // Validate payload shape
  const data = payload as Record<string, unknown>
  const videoId = data.videoId
  const youtubeId = data.youtubeId

  if (typeof videoId !== 'number' || typeof youtubeId !== 'string') {
    throw new Error('Invalid transcript job payload')
  }

  // Fetch transcript using existing youtube-transcript library
  const result = await fetchTranscript(youtubeId)

  if (!result.success || !result.transcript) {
    throw new Error(`Transcript fetch failed: ${result.error || 'No transcript available'}`)
  }

  // Store transcript in database
  await db.update(videos)
    .set({
      transcript: result.transcript,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId))

  // Queue embedding generation as next step
  await enqueueJob('generate_embeddings', { videoId })
}

async function processGenerateEmbeddings(payload: unknown): Promise<void> {
  // Validate payload
  const data = payload as Record<string, unknown>
  const videoId = data.videoId

  if (typeof videoId !== 'number') {
    throw new Error('Invalid embeddings job payload')
  }

  // Get the video to check it has a transcript
  const result = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1)
  const video = result[0]

  if (!video || !video.transcript) {
    throw new Error(`Video ${videoId} not found or has no transcript`)
  }

  // Parse transcript and chunk it
  const parsedSegments = parseTranscript(video.transcript)
  const segments: TranscriptSegment[] = parsedSegments.map(seg => ({
    text: seg.text,
    offset: seg.seconds * 1000, // Convert seconds to milliseconds
  }))
  const chunkedSegments = chunkTranscript(segments)

  if (chunkedSegments.length === 0) {
    throw new Error('No chunks generated from transcript')
  }

  // Generate embeddings using existing service
  await embedChunks(chunkedSegments, undefined, videoId)
}
