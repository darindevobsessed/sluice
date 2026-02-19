/** Minimum video count before suggesting a persona for a channel */
export const PERSONA_THRESHOLD = 5

import { eq, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { db as database, videos, chunks, personas } from '@/lib/db'
import type * as schema from '@/lib/db/schema'
import type { Persona } from '@/lib/db/schema'
import { computeChannelCentroid } from '@/lib/channels/similarity'
import { query } from '@anthropic-ai/claude-agent-sdk'

/**
 * Generates a persona system prompt by analyzing the creator's content.
 *
 * Samples transcripts from the channel's videos and uses Claude to analyze
 * writing style, expertise, and tone to generate a persona description.
 *
 * @param channelName - Name of the channel
 * @param db - Database instance (defaults to singleton)
 * @returns Generated system prompt
 * @throws Error if no transcripts found or API fails
 */
export async function generatePersonaSystemPrompt(
  channelName: string,
  db: NodePgDatabase<typeof schema> = database
): Promise<string> {
  // Fetch sample transcripts (limit to 5 for analysis)
  const transcriptSamples = await db
    .select({
      transcript: videos.transcript,
    })
    .from(videos)
    .innerJoin(chunks, eq(chunks.videoId, videos.id))
    .where(
      sql`${videos.channel} = ${channelName} AND ${videos.transcript} IS NOT NULL`
    )
    .limit(5)

  if (transcriptSamples.length === 0) {
    throw new Error('No transcripts found for channel')
  }

  // Combine samples for analysis
  const combinedTranscripts = transcriptSamples
    .map((s) => s.transcript)
    .filter(Boolean)
    .join('\n\n---\n\n')

  // Build prompt for Claude to analyze content
  const analysisPrompt = `Analyze the following video transcripts from the YouTube creator "${channelName}" and generate a system prompt that captures their expertise, teaching style, and tone.

Transcripts:
${combinedTranscripts.slice(0, 5000)} ${combinedTranscripts.length > 5000 ? '...' : ''}

Generate a system prompt in this format:
"You are [creator name]. Your expertise is in [key topics]. You speak in a [style description] way. Answer questions based on your content from your YouTube channel."

Keep it concise (2-3 sentences) and focus on their unique voice and expertise.`

  try {
    // Use Claude Agent SDK to generate system prompt
    const agentQuery = query({
      prompt: analysisPrompt,
      options: {
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1,
        tools: [],
        persistSession: false,
      },
    })

    let generatedPrompt = ''

    for await (const sdkMessage of agentQuery) {
      if (sdkMessage.type === 'assistant') {
        for (const block of sdkMessage.message.content) {
          if (block.type === 'text') {
            generatedPrompt = block.text
            break
          }
        }
      }
    }

    if (!generatedPrompt) {
      throw new Error('Failed to generate system prompt from Claude API')
    }

    return generatedPrompt.trim()
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Unknown error during system prompt generation')
  }
}

/**
 * Extracts top expertise topics from channel chunks.
 *
 * Analyzes chunk content to identify the most common topics and themes
 * discussed by the creator.
 *
 * @param channelName - Name of the channel
 * @param db - Database instance (defaults to singleton)
 * @returns Array of topic strings (max 10)
 */
export async function extractExpertiseTopics(
  channelName: string,
  db: NodePgDatabase<typeof schema> = database
): Promise<string[]> {
  // Fetch chunk content for this channel
  const channelChunks = await db
    .select({
      content: chunks.content,
    })
    .from(chunks)
    .innerJoin(videos, eq(chunks.videoId, videos.id))
    .where(sql`${videos.channel} = ${channelName}`)

  if (channelChunks.length === 0) {
    return []
  }

  // Simple topic extraction: find most common meaningful words
  // This is a basic implementation - could be enhanced with NLP
  const wordFrequency = new Map<string, number>()
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'be',
    'this',
    'that',
    'it',
    'you',
    'we',
    'they',
    'can',
    'will',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
  ])

  for (const chunk of channelChunks) {
    const words = chunk.content
      .toLowerCase()
      .match(/\b[a-z]{3,}\b/g) || []

    for (const word of words) {
      if (!stopWords.has(word)) {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1)
      }
    }
  }

  // Sort by frequency and take top 10
  const topics = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)

  return topics
}

/**
 * Computes expertise embedding from top representative chunks.
 *
 * Uses the channel centroid (average of all chunk embeddings) as the
 * expertise embedding for semantic routing.
 *
 * @param channelName - Name of the channel
 * @param db - Database instance (defaults to singleton)
 * @returns 384-dimensional embedding vector, or null if no embeddings found
 */
export async function computeExpertiseEmbedding(
  channelName: string,
  db: NodePgDatabase<typeof schema> = database
): Promise<number[] | null> {
  // Reuse the existing computeChannelCentroid function
  return computeChannelCentroid(channelName, db)
}

/**
 * Creates a persona from a YouTube channel.
 *
 * Orchestrates the full persona creation flow:
 * 1. Count videos/transcripts
 * 2. Generate system prompt via Claude
 * 3. Extract expertise topics
 * 4. Compute expertise embedding
 * 5. Insert into database
 *
 * @param channelName - Name of the channel
 * @param db - Database instance (defaults to singleton)
 * @returns Created persona
 * @throws Error if channel has no videos or creation fails
 */
export async function createPersona(
  channelName: string,
  db: NodePgDatabase<typeof schema> = database
): Promise<Persona> {
  // Count videos for this channel
  const videoRecords = await db
    .select({
      id: videos.id,
    })
    .from(videos)
    .where(eq(videos.channel, channelName))

  const transcriptCount = videoRecords.length

  if (transcriptCount === 0) {
    throw new Error('No videos found for channel')
  }

  // Generate system prompt
  const systemPrompt = await generatePersonaSystemPrompt(channelName, db)

  // Extract expertise topics
  const expertiseTopics = await extractExpertiseTopics(channelName, db)

  // Compute expertise embedding
  const expertiseEmbedding = await computeExpertiseEmbedding(channelName, db)

  // Insert persona into database
  const [persona] = await db
    .insert(personas)
    .values({
      channelName,
      name: channelName, // Use channel name as display name by default
      systemPrompt,
      expertiseTopics,
      expertiseEmbedding,
      transcriptCount,
    })
    .returning()

  if (!persona) {
    throw new Error('Failed to insert persona into database')
  }

  return persona
}
