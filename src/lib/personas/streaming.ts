import type { Persona } from '@/lib/db/schema'
import type { SearchResult } from '@/lib/search/types'
import { formatContextForPrompt } from './context'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MAX_TOKENS = 4096
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
 * Streams a persona response from Claude API.
 *
 * Makes a streaming request to the Anthropic Messages API with:
 * - Persona's system prompt + relevant context
 * - User's question
 * - Streaming enabled
 *
 * Returns a ReadableStream that emits SSE-formatted events from Claude.
 *
 * @param params - Persona, question, context, and optional abort signal
 * @returns ReadableStream of SSE events
 * @throws Error if API key missing, request fails, or signal aborts
 */
export async function streamPersonaResponse(
  params: StreamPersonaResponseParams
): Promise<ReadableStream<Uint8Array>> {
  const { persona, question, context, signal } = params

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required')
  }

  // Check if already aborted
  if (signal?.aborted) {
    throw new Error('Request aborted before starting')
  }

  const systemPrompt = buildSystemPrompt(persona, context)

  const requestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    stream: true,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: question,
      },
    ],
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  })

  if (!response.ok) {
    // Try to extract specific error message from response body
    let errorMessage = `Anthropic API error: ${response.status}`
    try {
      const errorData = await response.json()
      if (errorData.error?.message) {
        errorMessage = errorData.error.message
      }
    } catch {
      // If we can't parse the error, use status-based message
      if (response.status === 429) {
        errorMessage = 'Rate limit exceeded'
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed'
      } else if (response.status >= 500) {
        errorMessage = 'Claude API temporarily unavailable'
      }
    }
    throw new Error(`Anthropic API error: ${response.status} ${errorMessage}`)
  }

  if (!response.body) {
    throw new Error('Response body is null')
  }

  // Transform the Claude SSE stream into our own SSE format
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // Send done event
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
            controller.close()
            break
          }

          // Forward SSE chunks as-is (Claude's format)
          // Parse to transform if needed
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data:')) {
              // Forward the data line
              controller.enqueue(encoder.encode(line + '\n\n'))
            }
          }
        }
      } catch (error) {
        controller.error(error)
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}
