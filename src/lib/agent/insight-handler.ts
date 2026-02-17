/**
 * Transport-agnostic insight handler for Claude Agent SDK integration.
 * Extracted from WebSocket-specific implementation to enable reuse across
 * different transport layers (WebSocket, SSE, etc.).
 */
import { query } from '@anthropic-ai/claude-agent-sdk'

const activeRequests = new Map<string, AbortController>()

export interface InsightRequest {
  id: string
  type: string
  prompt: string
  systemPrompt: string
}

export type SendFn = (event: object) => void

/**
 * Handle an insight generation request.
 * Streams the response through the provided send function.
 */
export async function handleInsightRequest(
  send: SendFn,
  message: InsightRequest
) {
  const { id, prompt, systemPrompt } = message
  const abortController = new AbortController()
  activeRequests.set(id, abortController)

  try {
    // Use the Claude Agent SDK to query Claude
    // Using no tools and single turn for pure text generation
    const agentQuery = query({
      prompt: `${systemPrompt}\n\n---\n\n${prompt}`,
      options: {
        model: 'claude-sonnet-4-20250514',
        maxTurns: 1, // Single response, no tool use
        tools: [], // No tools - pure text generation
        includePartialMessages: true, // Get streaming events
        abortController,
        persistSession: false, // Don't save to disk
      },
    })

    let currentText = ''

    for await (const sdkMessage of agentQuery) {
      if (abortController.signal.aborted) {
        send({ event: 'cancelled' })
        break
      }

      // Handle streaming text events
      if (sdkMessage.type === 'stream_event') {
        const event = sdkMessage.event
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const delta = event.delta.text
          if (delta) {
            currentText += delta
            send({ event: 'text', content: delta })
          }
        }
      }

      // Handle complete assistant message
      if (sdkMessage.type === 'assistant') {
        // Extract text from the message content
        for (const block of sdkMessage.message.content) {
          if (block.type === 'text') {
            // If we didn't get streaming, use the full text
            if (!currentText) {
              currentText = block.text
              send({ event: 'text', content: block.text })
            }
          }
        }
      }
    }

    send({ event: 'done', fullContent: currentText })
  } catch (error) {
    if (abortController.signal.aborted) {
      send({ event: 'cancelled' })
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[Agent] Error generating insight:', errorMessage)
      send({ event: 'error', error: errorMessage })
    }
  } finally {
    activeRequests.delete(id)
  }
}

/**
 * Cancel an in-progress insight generation.
 */
export function cancelInsight(id: string): boolean {
  const controller = activeRequests.get(id)
  if (controller) {
    controller.abort()
    activeRequests.delete(id)
    return true
  }
  return false
}
