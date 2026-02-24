/**
 * WebSocket server for local agent communication.
 * Accepts connections on port 9334, validates tokens, and routes messages.
 */
import { WebSocketServer, type WebSocket } from 'ws'
import { validateToken } from './auth.js'
import { handleInsightRequest, cancelInsight } from './chat.js'
import chalk from 'chalk'

const PORT = parseInt(process.env.AGENT_PORT || '9334', 10)

interface AgentMessage {
  type: string
  [key: string]: unknown
}

export class AgentServer {
  private wss: WebSocketServer | null = null
  private activeClient: WebSocket | null = null
  private expectedToken: string
  private authenticatedClients = new WeakSet<WebSocket>()

  constructor(token: string) {
    this.expectedToken = token
  }

  start() {
    this.wss = new WebSocketServer({ port: PORT })

    this.wss.on('connection', (ws: WebSocket) => {
      console.log(chalk.gray('Client connecting...'))

      // Only allow one active client
      if (this.activeClient && this.activeClient.readyState === 1) {
        console.log(chalk.yellow('Rejected connection: client already connected'))
        ws.send(JSON.stringify({ type: 'error', error: 'Another client is already connected' }))
        ws.close()
        return
      }

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as AgentMessage

          // Handle authentication first
          if (message.type === 'auth') {
            const token = message.token as string
            if (validateToken(token, this.expectedToken)) {
              this.authenticatedClients.add(ws)
              this.activeClient = ws
              ws.send(JSON.stringify({ type: 'auth_success' }))
              console.log(chalk.green('Client authenticated'))
            } else {
              ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }))
              console.log(chalk.red('Authentication failed: invalid token'))
              ws.close()
            }
            return
          }

          // Require authentication for all other messages
          if (!this.authenticatedClients.has(ws)) {
            ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }))
            return
          }

          // Route authenticated messages
          switch (message.type) {
            case 'generate_insight':
              handleInsightRequest(ws, {
                id: message.id as string,
                type: message.type,
                prompt: message.prompt as string,
                systemPrompt: message.systemPrompt as string,
              })
              break

            case 'cancel_insight':
              const id = message.id as string
              const cancelled = cancelInsight(id)
              ws.send(JSON.stringify({
                type: 'cancel_response',
                id,
                cancelled
              }))
              break

            default:
              ws.send(JSON.stringify({
                type: 'error',
                error: `Unknown message type: ${message.type}`
              }))
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(chalk.red('Error processing message:'), errorMessage)
          ws.send(JSON.stringify({ type: 'error', error: errorMessage }))
        }
      })

      ws.on('close', () => {
        if (this.activeClient === ws) {
          this.activeClient = null
          console.log(chalk.gray('Client disconnected'))
        }
      })

      ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), error.message)
      })
    })

    this.wss.on('error', (error) => {
      console.error(chalk.red('Server error:'), error.message)
    })

    console.log(chalk.cyan(`Agent server listening on port ${PORT}`))
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve()
        return
      }

      // Close active client first
      if (this.activeClient && this.activeClient.readyState === 1) {
        this.activeClient.close(1000, 'Server shutting down')
      }

      // Close the server and wait for completion
      this.wss.close(() => {
        console.log(chalk.gray('Server stopped'))
        resolve()
      })
    })
  }
}
