import { createMcpHandler } from 'mcp-handler'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerSearchRag, registerGetListOfCreators, registerChatWithPersona, registerEnsembleQuery } from '@/lib/mcp/tools'
import { validateMcpAuth } from '@/lib/mcp/auth'

/**
 * MCP Route Handler for Gold Miner
 *
 * Provides Model Context Protocol interface for Claude Code plugins.
 * Supports both SSE and HTTP transports via dynamic [transport] parameter.
 *
 * Available tools:
 * - search_rag: Search the knowledge base with optional creator filtering
 * - get_list_of_creators: List all creators with video counts
 * - chat_with_persona: Ask a question to a specific creator persona
 * - ensemble_query: Ask a question to all personas with "who's best" routing
 */

/**
 * Initialize the MCP server with registered tools
 * This function is called once when the handler is created
 */
async function initializeServer(server: McpServer): Promise<void> {
  registerSearchRag(server)
  registerGetListOfCreators(server)
  registerChatWithPersona(server)
  registerEnsembleQuery(server)
}

/**
 * Create the MCP handler with configuration
 */
const handler = createMcpHandler(
  initializeServer,
  {
    serverInfo: {
      name: 'gold-miner',
      version: '0.1.0',
    },
  },
  {
    streamableHttpEndpoint: '/api/mcp/mcp',
    sseEndpoint: '/api/mcp/sse',
    sseMessageEndpoint: '/api/mcp/message',
    maxDuration: 60,
    verboseLogs: true,
  }
)

/**
 * Export GET and POST handlers for Next.js App Router
 * MCP protocol requires both methods to be available
 */
async function wrappedHandler(request: Request): Promise<Response> {
  // Check authentication before processing
  const auth = validateMcpAuth(request)
  if (!auth.valid) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // MCP handler requires Accept header for streamable HTTP transport
  // Add it if missing
  if (!request.headers.get('accept')) {
    const headers = new Headers(request.headers)
    headers.set('accept', 'application/json, text/event-stream')

    request = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
      duplex: 'half',
    } as RequestInit)
  }

  return handler(request)
}

export { wrappedHandler as GET, wrappedHandler as POST }

/**
 * Configure route segment for Vercel
 * maxDuration allows longer-running MCP operations
 */
export const maxDuration = 60
