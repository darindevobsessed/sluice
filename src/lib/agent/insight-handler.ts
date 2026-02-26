/**
 * Transport-agnostic insight handler for Claude API integration.
 * Extracted from WebSocket-specific implementation to enable reuse across
 * different transport layers (WebSocket, SSE, etc.).
 */
import { streamText } from '@/lib/claude/client'

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
    const stream = streamText(
      `${systemPrompt}\n\n---\n\n${prompt}`,
      { signal: abortController.signal }
    )

    let currentText = ''

    stream.on('text', (delta) => {
      if (abortController.signal.aborted) return
      if (delta) {
        currentText += delta
        send({ event: 'text', content: delta })
      }
    })

    // Wait for stream to complete
    const finalMessage = await stream.finalMessage()

    if (abortController.signal.aborted) {
      send({ event: 'cancelled' })
      return
    }

    // If we didn't get streaming deltas, use the final message text
    if (!currentText) {
      for (const block of finalMessage.content) {
        if (block.type === 'text' && block.text) {
          currentText = block.text
          send({ event: 'text', content: block.text })
          break
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
