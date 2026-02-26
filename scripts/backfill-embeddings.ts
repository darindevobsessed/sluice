/**
 * Backfill embeddings for all videos that have transcripts but no chunks.
 * Runs locally using native ONNX, writes directly to the target database.
 *
 * Usage: npx tsx scripts/backfill-embeddings.ts
 * Set DATABASE_URL in .env to point at Neon for production backfill.
 */
import 'dotenv/config'
import pg from 'pg'

// Raw imports to avoid Next.js path aliases
import { parseTranscript } from '../src/lib/transcript/parse'
import { chunkTranscript } from '../src/lib/embeddings/chunker'
import { EmbeddingPipeline } from '../src/lib/embeddings/pipeline'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Find videos with transcripts but no chunks
  const { rows: videos } = await pool.query(`
    SELECT v.id, v.title, v.transcript
    FROM videos v
    LEFT JOIN chunks c ON c.video_id = v.id
    WHERE v.transcript IS NOT NULL
    GROUP BY v.id
    HAVING count(c.id) = 0
    ORDER BY v.id
  `)

  if (videos.length === 0) {
    console.log('All videos already have embeddings.')
    await pool.end()
    return
  }

  console.log(`Found ${videos.length} videos needing embeddings.\n`)

  // Warm up the embedding pipeline once
  console.log('Loading embedding model...')
  const pipeline = await EmbeddingPipeline.getInstance()
  console.log('Model loaded.\n')

  for (const video of videos) {
    const label = `Video ${video.id}: ${video.title}`
    console.log(`--- ${label} ---`)

    // Parse transcript into segments and map to chunker format
    const rawSegments = parseTranscript(video.transcript)
    if (rawSegments.length === 0) {
      console.log('  No parseable segments, skipping.\n')
      continue
    }

    // Map transcript segments (seconds) to embedding segments (offset in ms)
    const segments = rawSegments.map((s) => ({
      text: s.text,
      offset: s.seconds * 1000,
    }))

    // Chunk the transcript
    const chunkData = chunkTranscript(segments)
    console.log(`  ${segments.length} segments → ${chunkData.length} chunks`)

    // Generate embeddings and insert one at a time
    for (let i = 0; i < chunkData.length; i++) {
      const chunk = chunkData[i]!
      const embedding = await pipeline.embed(chunk.content)
      const embeddingStr = `[${Array.from(embedding).join(',')}]`

      await pool.query(
        `INSERT INTO chunks (video_id, content, start_time, end_time, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [
          video.id,
          chunk.content,
          Math.round(chunk.startTime / 1000) || 0,
          Math.round(chunk.endTime / 1000) || 0,
          embeddingStr,
        ]
      )

      process.stdout.write(`  Chunk ${i + 1}/${chunkData.length}\r`)
    }

    console.log(`  Done: ${chunkData.length} chunks embedded and inserted.\n`)
  }

  console.log('Backfill complete.')
  await pool.end()
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  pool.end()
  process.exit(1)
})
