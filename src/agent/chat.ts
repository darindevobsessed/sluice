/**
 * WebSocket adapter for insight generation.
 * Wraps the transport-agnostic handler with WebSocket-specific send logic.
 */
import type { WebSocket } from 'ws'
import { handleInsightRequest as handleInsight, cancelInsight, type InsightRequest } from '../lib/agent/insight-handler'

export type { InsightRequest }

/**
 * Handle an insight generation request via WebSocket.
 * Wraps the transport-agnostic handler with WebSocket-specific sending.
 */
export async function handleInsightRequest(
  ws: WebSocket,
  message: InsightRequest
) {
  const { id } = message

  // Create WebSocket-specific send function
  const send = (event: object) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify({ type: 'insight_stream', id, ...event }))
    }
  }

  // Delegate to transport-agnostic handler
  await handleInsight(send, message)
}

// Re-export cancelInsight from shared handler
export { cancelInsight }
