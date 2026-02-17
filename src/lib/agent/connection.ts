/**
 * Browser WebSocket client for connecting to the local agent.
 */
import { nanoid } from 'nanoid'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export type TransportMode = 'websocket' | 'sse'

interface InsightOptions {
  insightType: string
  prompt: string
  systemPrompt: string
}

interface InsightCallbacks {
  onStart?: () => void
  onText?: (text: string) => void
  onDone?: (fullContent: string) => void
  onError?: (error: string) => void
  onCancel?: () => void
}

interface ActiveInsight {
  id: string
  callbacks: InsightCallbacks
}

export class AgentConnection {
  private ws: WebSocket | null = null
  private status: ConnectionStatus = 'disconnected'
  private statusListeners = new Set<(status: ConnectionStatus) => void>()
  private activeInsights = new Map<string, ActiveInsight>()
  private transport: TransportMode = 'websocket'
  private token: string = ''
  private activeAbortControllers = new Map<string, AbortController>()

  getStatus(): ConnectionStatus {
    return this.status
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status
    this.statusListeners.forEach(listener => listener(status))
  }

  async connect(token: string, transport: TransportMode = 'websocket'): Promise<void> {
    this.transport = transport
    this.token = token

    if (transport === 'sse') {
      // SSE mode: mark as connected immediately (no persistent connection)
      this.setStatus('connected')
      return
    }

    // WebSocket mode: use existing logic
    return this.connectWebSocket(token)
  }

  private async connectWebSocket(token: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.setStatus('connecting')

    return new Promise((resolve, reject) => {
      const agentPort = process.env.NEXT_PUBLIC_AGENT_PORT || '9333'
      const ws = new WebSocket(`ws://localhost:${agentPort}`)
      ws.onopen = () => {
        // Send authentication
        ws.send(JSON.stringify({ type: 'auth', token }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          // Handle authentication response
          if (message.type === 'auth_success') {
            this.ws = ws
            this.setStatus('connected')
            resolve()
            return
          }

          if (message.type === 'auth_error') {
            this.setStatus('error')
            reject(new Error(message.error))
            ws.close()
            return
          }

          // Route insight stream messages
          if (message.type === 'insight_stream') {
            this.handleInsightStream(message)
          }

          // Handle cancel response
          if (message.type === 'cancel_response') {
            const insight = this.activeInsights.get(message.id)
            if (insight && message.cancelled) {
              insight.callbacks.onCancel?.()
              this.activeInsights.delete(message.id)
            }
          }

          // Handle general errors
          if (message.type === 'error') {
            console.error('[AgentConnection] Error:', message.error)
          }
        } catch (error) {
          console.error('[AgentConnection] Failed to parse message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('[AgentConnection] WebSocket error:', error)
        this.setStatus('error')
        reject(new Error('WebSocket connection failed'))
      }

      ws.onclose = () => {
        this.ws = null
        this.setStatus('disconnected')
        // Cancel all active insights
        this.activeInsights.forEach(insight => {
          insight.callbacks.onError?.('Connection closed')
        })
        this.activeInsights.clear()
      }
    })
  }

  private handleInsightStream(message: {
    id: string
    event: string
    content?: string
    fullContent?: string
    error?: string
  }) {
    const insight = this.activeInsights.get(message.id)
    if (!insight) return

    switch (message.event) {
      case 'text':
        if (message.content) {
          insight.callbacks.onText?.(message.content)
        }
        break

      case 'done':
        if (message.fullContent) {
          insight.callbacks.onDone?.(message.fullContent)
        }
        this.activeInsights.delete(message.id)
        break

      case 'error':
        if (message.error) {
          insight.callbacks.onError?.(message.error)
        }
        this.activeInsights.delete(message.id)
        break

      case 'cancelled':
        insight.callbacks.onCancel?.()
        this.activeInsights.delete(message.id)
        break
    }
  }

  generateInsight(options: InsightOptions, callbacks: InsightCallbacks): string {
    if (this.transport === 'sse') {
      return this.generateInsightSSE(options, callbacks)
    }
    return this.generateInsightWS(options, callbacks)
  }

  private generateInsightWS(options: InsightOptions, callbacks: InsightCallbacks): string {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      callbacks.onError?.('Not connected to agent')
      return ''
    }

    const id = nanoid()
    this.activeInsights.set(id, { id, callbacks })

    try {
      this.ws.send(JSON.stringify({
        type: 'generate_insight',
        id,
        ...options
      }))

      callbacks.onStart?.()
      return id
    } catch (error) {
      // WebSocket send failed, clean up and notify
      this.activeInsights.delete(id)
      callbacks.onError?.(error instanceof Error ? error.message : 'Failed to send message')
      return id
    }
  }

  private generateInsightSSE(options: InsightOptions, callbacks: InsightCallbacks): string {
    const id = nanoid()
    this.activeInsights.set(id, { id, callbacks })

    const abortController = new AbortController()
    this.activeAbortControllers.set(id, abortController)

    // Start SSE stream
    this.streamSSE(id, options, callbacks, abortController.signal)
      .catch((error) => {
        if (error.name === 'AbortError') {
          // Request was cancelled, callback already fired
          return
        }
        callbacks.onError?.(error instanceof Error ? error.message : 'Stream failed')
      })
      .finally(() => {
        this.activeInsights.delete(id)
        this.activeAbortControllers.delete(id)
      })

    callbacks.onStart?.()
    return id
  }

  private async streamSSE(
    id: string,
    options: InsightOptions,
    callbacks: InsightCallbacks,
    signal: AbortSignal
  ): Promise<void> {
    const response = await fetch('/api/agent/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        prompt: options.prompt,
        systemPrompt: options.systemPrompt,
        token: this.token,
      }),
      signal,
    })

    if (!response.ok) {
      throw new Error(response.statusText)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      // Append chunk to buffer
      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      // Keep incomplete line in buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6) // Remove 'data: ' prefix
          if (data.trim()) {
            try {
              const message = JSON.parse(data)
              this.handleSSEMessage(message, callbacks)
            } catch (error) {
              console.error('[AgentConnection] Failed to parse SSE message:', error)
            }
          }
        }
      }
    }
  }

  private handleSSEMessage(
    message: {
      type: string
      content?: string
      fullContent?: string
      error?: string
    },
    callbacks: InsightCallbacks
  ) {
    switch (message.type) {
      case 'text':
        if (message.content) {
          callbacks.onText?.(message.content)
        }
        break

      case 'done':
        if (message.fullContent) {
          callbacks.onDone?.(message.fullContent)
        }
        break

      case 'error':
        if (message.error) {
          callbacks.onError?.(message.error)
        }
        break

      case 'cancelled':
        callbacks.onCancel?.()
        break
    }
  }

  cancelInsight(id: string) {
    if (this.transport === 'sse') {
      this.cancelInsightSSE(id)
    } else {
      this.cancelInsightWS(id)
    }
  }

  private cancelInsightWS(id: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    this.ws.send(JSON.stringify({
      type: 'cancel_insight',
      id
    }))
  }

  private cancelInsightSSE(id: string) {
    const abortController = this.activeAbortControllers.get(id)
    if (abortController) {
      abortController.abort()
      this.activeAbortControllers.delete(id)
    }

    // Also notify server to cancel
    fetch('/api/agent/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, token: this.token }),
    }).catch((error) => {
      console.error('[AgentConnection] Failed to send cancel request:', error)
    })
  }

  disconnect() {
    // Abort all active SSE requests
    this.activeAbortControllers.forEach((controller) => {
      controller.abort()
    })
    this.activeAbortControllers.clear()

    // Close WebSocket if present
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.setStatus('disconnected')
  }
}
