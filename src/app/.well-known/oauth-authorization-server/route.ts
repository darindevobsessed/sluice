import { oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider'
import { auth } from '@/lib/auth'

/**
 * OAuth Authorization Server Metadata (RFC 8414)
 *
 * MCP clients fetch this endpoint to discover the OAuth server configuration,
 * including the authorization and token endpoints.
 *
 * Dev mode: Returns 404 so MCP clients fall back to unauthenticated connection.
 * Production: Returns OAuth metadata from Better Auth.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8414
 */
export async function GET(request: Request): Promise<Response> {
  // Dev mode: no OAuth needed — 404 tells MCP clients to skip auth
  if (process.env.NODE_ENV !== 'production') {
    return new Response(null, { status: 404 })
  }

  // Production: serve OAuth discovery metadata
  try {
    const handler = oauthProviderAuthServerMetadata(auth)
    return await handler(request)
  } catch {
    return new Response(
      JSON.stringify({ error: 'OAuth not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
