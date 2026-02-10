/**
 * Browser WebSocket client for connecting to the local agent.
 */
import { nanoid } from 'nanoid'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

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

  async connect(token: string): Promise<void> {
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      callbacks.onError?.('Not connected to agent')
      return ''
    }

    const id = nanoid()
    this.activeInsights.set(id, { id, callbacks })

    this.ws.send(JSON.stringify({
      type: 'generate_insight',
      id,
      ...options
    }))

    callbacks.onStart?.()
    return id
  }

  cancelInsight(id: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    this.ws.send(JSON.stringify({
      type: 'cancel_insight',
      id
    }))
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
