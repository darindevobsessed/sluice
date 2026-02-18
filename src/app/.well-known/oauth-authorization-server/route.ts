import { oAuthDiscoveryMetadata } from 'better-auth/plugins'
import { auth } from '@/lib/auth'

/**
 * OAuth Authorization Server Metadata (RFC 8414)
 *
 * MCP clients fetch this endpoint to discover the OAuth server configuration,
 * including the authorization and token endpoints. Better Auth also serves this
 * at /api/auth/.well-known/oauth-authorization-server, but MCP clients look at
 * the root-level .well-known path by default.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8414
 */
export const GET = oAuthDiscoveryMetadata(auth)
