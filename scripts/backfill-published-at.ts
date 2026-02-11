#!/usr/bin/env npx tsx
/**
 * Backfill publishedAt metadata for existing videos
 *
 * Usage:
 *   npm run db:backfill-published-at           # Run backfill
 *   npm run db:backfill-published-at -- --dry-run  # Preview without writing
 *   npm run db:backfill-published-at -- --delay 2000  # 2 second delay between requests
 */
import 'dotenv/config'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, isNull, isNotNull, and } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'
import { fetchVideoPageMetadata } from '../src/lib/youtube/metadata'

const isDryRun = process.argv.includes('--dry-run')

// Parse delay flag: --delay 2000
const delayIndex = process.argv.indexOf('--delay')
const defaultDelay = 1500 // 1.5 seconds
const delayArg = delayIndex !== -1 ? process.argv[delayIndex + 1] : undefined
const delayMs = delayArg ? parseInt(delayArg, 10) : defaultDelay

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function backfill() {
  console.log(isDryRun ? '🔍 DRY RUN MODE - No data will be written\n' : '🚀 Starting backfill...\n')
  console.log(`⏱️  Delay between requests: ${delayMs}ms\n`)

  // Check DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set')
    console.error('   Make sure .env file exists with DATABASE_URL=postgresql://...')
    process.exit(1)
  }

  // Create database connection
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })

  try {
    // Test database connection
    try {
      await pool.query('SELECT 1')
    } catch (error) {
      console.error('❌ Cannot connect to Postgres database')
      console.error('   Make sure Docker container is running: docker compose up -d')
      throw error
    }

    // Query videos where publishedAt IS NULL and youtubeId IS NOT NULL
    const videosToBackfill = await db
      .select({
        id: schema.videos.id,
        youtubeId: schema.videos.youtubeId,
        title: schema.videos.title,
        description: schema.videos.description,
        duration: schema.videos.duration,
        publishedAt: schema.videos.publishedAt,
      })
      .from(schema.videos)
      .where(
        and(
          isNull(schema.videos.publishedAt),
          isNotNull(schema.videos.youtubeId)
        )
      )

    const total = videosToBackfill.length
    console.log(`📹 Found ${total} videos to backfill\n`)

    if (total === 0) {
      console.log('✅ No videos need backfilling')
      return
    }

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < videosToBackfill.length; i++) {
      const video = videosToBackfill[i]!
      const progress = `[${i + 1}/${total}]`

      try {
        // Fetch metadata from YouTube
        const metadata = await fetchVideoPageMetadata(video.youtubeId!)

        // Determine which fields need updating (only update null fields)
        const updates: Partial<{
          publishedAt: Date
          description: string
          duration: number
        }> = {}

        if (metadata.publishedAt && !video.publishedAt) {
          updates.publishedAt = new Date(metadata.publishedAt)
        }

        if (metadata.description && !video.description) {
          updates.description = metadata.description
        }

        if (metadata.duration !== null && video.duration === null) {
          updates.duration = metadata.duration
        }

        // Update database (only if there are fields to update)
        if (Object.keys(updates).length > 0 && !isDryRun) {
          await db
            .update(schema.videos)
            .set(updates)
            .where(eq(schema.videos.id, video.id))
        }

        // Build log message showing what was updated
        const updatedFields: string[] = []
        if (updates.publishedAt) {
          updatedFields.push(`published ${updates.publishedAt.toISOString().split('T')[0]}`)
        }
        if (updates.description) {
          updatedFields.push('description')
        }
        if (updates.duration !== undefined) {
          updatedFields.push('duration')
        }

        const fieldsStr = updatedFields.length > 0
          ? ` — ${updatedFields.join(', ')}`
          : ' — no new metadata found'

        console.log(`${progress} ${isDryRun ? 'Would update' : 'Updated'} "${video.title.substring(0, 60)}"${fieldsStr}`)

        if (Object.keys(updates).length > 0) {
          successCount++
        }

        // Delay between requests (except for last item)
        if (i < videosToBackfill.length - 1) {
          await sleep(delayMs)
        }
      } catch (error) {
        failCount++
        console.error(`${progress} ❌ Failed "${video.title.substring(0, 60)}" — ${error instanceof Error ? error.message : 'Unknown error'}`)

        // Continue with delay even on error
        if (i < videosToBackfill.length - 1) {
          await sleep(delayMs)
        }
      }
    }

    console.log(`\n${isDryRun ? '✅ Dry run complete' : '✅ Backfill complete'}`)
    console.log(`   Updated: ${successCount}/${total}`)
    if (failCount > 0) {
      console.log(`   Failed: ${failCount}`)
    }
  } catch (error) {
    console.error('\n❌ Backfill failed:', error)
    throw error
  } finally {
    await pool.end()
  }
}

backfill().catch((err) => {
  console.error(err)
  process.exit(1)
})
