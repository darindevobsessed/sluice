import type { Persona } from '@/lib/db/schema'
import { generateEmbedding } from '@/lib/embeddings/pipeline'
import { cosineSimilarity } from '@/lib/graph/compute-relationships'
import { getPersonaContext } from './context'
import { streamPersonaResponse } from './streaming'

export interface BestPersonaResult {
  persona: Persona
  score: number
}

/**
 * Finds the best matching personas for a question using expertise embeddings.
 *
 * Embeds the question and compares against each persona's expertiseEmbedding
 * using cosine similarity. Returns top N personas sorted by match score.
 *
 * @param question - User's question to match against persona expertise
 * @param personas - Array of personas to rank
 * @param limit - Maximum number of personas to return (default: 3)
 * @returns Array of personas with scores, sorted by score descending
 */
export async function findBestPersonas(
  question: string,
  personas: Persona[],
  limit = 3
): Promise<BestPersonaResult[]> {
  // Early return for empty personas
  if (personas.length === 0) {
    return []
  }

  // Filter to only personas with expertise embeddings
  const personasWithEmbeddings = personas.filter(
    p => p.expertiseEmbedding !== null && Array.isArray(p.expertiseEmbedding)
  )

  if (personasWithEmbeddings.length === 0) {
    return []
  }

  // Generate embedding for the question
  const questionEmbedding = await generateEmbedding(question)
  const questionVector = Array.from(questionEmbedding)

  // Compute similarity score for each persona
  const results: BestPersonaResult[] = personasWithEmbeddings.map(persona => {
    const expertiseVector = persona.expertiseEmbedding as unknown as number[]
    const score = cosineSimilarity(questionVector, expertiseVector)

    return {
      persona,
      score,
    }
  })

  // Sort by score descending and take top N
  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

interface StreamEnsembleParams {
  question: string
  personas: Persona[]
  signal?: AbortSignal
}

interface SSEEvent {
  type: string
  [key: string]: unknown
}

/**
 * Streams ensemble responses from multiple personas in parallel.
 *
 * Creates a single ReadableStream that merges persona-tagged responses
 * from multiple Claude API streams running concurrently. Emits SSE events
 * for best match, persona start/done, deltas, sources, and errors.
 *
 * Event flow:
 * 1. best_match - Top persona by similarity score
 * 2. persona_start (x N) - One per persona
 * 3. delta (x many) - Persona-tagged text chunks
 * 4. sources (x N) - Context chunks used
 * 5. persona_done (x N) - One per persona completion
 * 6. persona_error (if failures) - Per failed persona
 * 7. all_done - Final event
 *
 * @param params - Question, personas array, and optional abort signal
 * @returns ReadableStream of SSE-formatted events
 */
export async function streamEnsembleResponse(
  params: StreamEnsembleParams
): Promise<ReadableStream<Uint8Array>> {
  const { question, personas, signal } = params
  const encoder = new TextEncoder()

  // Helper to format SSE events
  const formatSSE = (event: SSEEvent): Uint8Array => {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
  }

  return new ReadableStream({
    async start(controller) {
      try {
        // Check if already aborted
        if (signal?.aborted) {
          throw new Error('Request aborted')
        }

        // Find best persona for "who's best" routing
        if (personas.length > 0) {
          const bestMatches = await findBestPersonas(question, personas, 1)
          if (bestMatches.length > 0) {
            const best = bestMatches[0]!
            controller.enqueue(
              formatSSE({
                type: 'best_match',
                personaId: best.persona.id,
                personaName: best.persona.name,
                score: best.score,
              })
            )
          }
        }

        // Handle empty personas case
        if (personas.length === 0) {
          controller.enqueue(formatSSE({ type: 'all_done' }))
          controller.close()
          return
        }

        // Process each persona in parallel
        const personaPromises = personas.map(async (persona, index) => {
          // Stagger starts by 100ms to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, index * 100))

          try {
            // Emit persona_start
            controller.enqueue(
              formatSSE({
                type: 'persona_start',
                personaId: persona.id,
                personaName: persona.name,
              })
            )

            // Get context for this persona
            const context = await getPersonaContext(persona.channelName, question)

            // Start streaming response
            const stream = await streamPersonaResponse({
              persona,
              question,
              context,
              signal,
            })

            // Read and relay chunks with personaId tag
            const reader = stream.getReader()
            const decoder = new TextDecoder()

            while (true) {
              const { done, value } = await reader.read()

              if (done) break

              // Parse the SSE chunk from Claude API
              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  const dataStr = line.substring(5).trim()

                  if (!dataStr) continue

                  try {
                    const data = JSON.parse(dataStr)

                    // Transform Claude events to persona-tagged events
                    if (data.type === 'content_block_delta') {
                      controller.enqueue(
                        formatSSE({
                          type: 'delta',
                          personaId: persona.id,
                          text: data.delta?.text || '',
                        })
                      )
                    } else if (data.type === 'done') {
                      // Skip Claude's done event, we'll emit our own
                      continue
                    }
                  } catch {
                    // Skip malformed JSON
                    continue
                  }
                }
              }
            }

            // Emit sources
            controller.enqueue(
              formatSSE({
                type: 'sources',
                personaId: persona.id,
                chunks: context.map(c => ({
                  chunkId: c.chunkId,
                  content: c.content,
                  videoTitle: c.videoTitle,
                  startTime: c.startTime,
                })),
              })
            )

            // Emit persona_done
            controller.enqueue(
              formatSSE({
                type: 'persona_done',
                personaId: persona.id,
              })
            )
          } catch (error) {
            // Emit error event but don't fail the whole stream
            let errorMessage = 'Unable to generate response'

            if (error instanceof Error) {
              // Provide more specific error messages based on error type
              if (error.message.includes('Anthropic API error')) {
                // Extract status code for specific messages
                if (error.message.includes('429')) {
                  errorMessage = 'Rate limit exceeded. Please try again in a moment.'
                } else if (error.message.includes('401')) {
                  errorMessage = 'Authentication error. Please check API configuration.'
                } else if (error.message.includes('500') || error.message.includes('503')) {
                  errorMessage = 'Claude API is temporarily unavailable. Please try again later.'
                } else {
                  errorMessage = error.message
                }
              } else if (error.message.includes('embedding')) {
                errorMessage = 'Unable to process your question. Please try again.'
              } else {
                errorMessage = error.message
              }
            }

            controller.enqueue(
              formatSSE({
                type: 'persona_error',
                personaId: persona.id,
                error: errorMessage,
              })
            )
          }
        })

        // Wait for all personas to complete
        await Promise.allSettled(personaPromises)

        // Emit final event
        controller.enqueue(formatSSE({ type: 'all_done' }))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
    cancel() {
      // Stream cancelled by client
    },
  })
}
