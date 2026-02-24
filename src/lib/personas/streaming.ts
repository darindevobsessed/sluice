import type { Persona } from '@/lib/db/schema'
import type { SearchResult } from '@/lib/search/types'
import { formatContextForPrompt } from './context'
import { query } from '@anthropic-ai/claude-agent-sdk'

const MODEL = 'claude-sonnet-4-20250514'

/**
 * Estimates token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Limits context to fit within token budget (~3K tokens)
 */
function limitContextTokens(context: SearchResult[], maxTokens = 3000): SearchResult[] {
  const limited: SearchResult[] = []
  let totalTokens = 0

  for (const result of context) {
    const tokens = estimateTokens(result.content)
    if (totalTokens + tokens > maxTokens) {
      break
    }
    limited.push(result)
    totalTokens += tokens
  }

  return limited
}

/**
 * Builds the system prompt with persona description and relevant context.
 */
function buildSystemPrompt(persona: Persona, context: SearchResult[]): string {
  const limitedContext = limitContextTokens(context)
  const formattedContext = formatContextForPrompt(limitedContext)

  const parts = [persona.systemPrompt]

  if (formattedContext) {
    parts.push(
      '\n\nContext from your content:\n' + formattedContext,
      '\n\nAnswer based on your content and expertise.'
    )
  }

  return parts.join('')
}

interface StreamPersonaResponseParams {
  persona: Persona
  question: string
  context: SearchResult[]
  signal?: AbortSignal
}

/**
 * Streams a persona response using Agent SDK.
 *
 * Uses the Agent SDK's query() with:
 * - Persona's system prompt + relevant context
 * - User's question
 * - Streaming enabled via includePartialMessages
 *
 * Returns a ReadableStream that emits SSE-formatted events compatible with ensemble.ts.
 *
 * @param params - Persona, question, context, and optional abort signal
 * @returns ReadableStream of SSE events
 * @throws Error if request fails or signal aborts
 */
export async function streamPersonaResponse(
  params: StreamPersonaResponseParams
): Promise<ReadableStream<Uint8Array>> {
  const { persona, question, context, signal } = params

  // Build system prompt with persona + context
  const systemPrompt = buildSystemPrompt(persona, context)

  // Concatenate system prompt and question (same pattern as service.ts)
  const prompt = `${systemPrompt}\n\n---\n\n${question}`

  // Create AbortController for Agent SDK
  const abortController = new AbortController()

  // Wire incoming signal to our abort controller
  if (signal) {
    signal.addEventListener('abort', () => {
      abortController.abort()
    }, { once: true })
  }

  // Start the Agent SDK query
  const agentQuery = query({
    prompt,
    options: {
      model: MODEL,
      maxTurns: 1, // Single response, no tool use
      tools: [], // No tools - pure text generation
      includePartialMessages: true, // Get streaming events
      abortController,
      persistSession: false, // Don't save to disk
    },
  })

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const sdkMessage of agentQuery) {
          // Handle streaming text events
          if (sdkMessage.type === 'stream_event') {
            const event = sdkMessage.event
            // Emit content_block_delta events in SSE format
            // ensemble.ts expects: data.type === 'content_block_delta' with data.delta?.text
            if (event.type === 'content_block_delta') {
              const sseData = `data: ${JSON.stringify(event)}\n\n`
              controller.enqueue(encoder.encode(sseData))
            }
          }
        }

        // Emit done event when iteration completes
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
