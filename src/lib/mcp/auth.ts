/**
 * MCP Authentication
 *
 * Environment-based authentication for MCP endpoints.
 * Auth is disabled by default for local development.
 * Set MCP_AUTH_ENABLED=true and MCP_AUTH_TOKEN=<token> for production.
 */

export interface AuthResult {
  valid: boolean
  error?: string
}

/**
 * Validate MCP authentication based on environment configuration.
 *
 * @param request - The incoming HTTP request
 * @returns AuthResult with valid flag and optional error message
 */
export function validateMcpAuth(request: Request): AuthResult {
  const authEnabled = process.env.MCP_AUTH_ENABLED === 'true'

  // Auth is disabled by default
  if (!authEnabled) {
    return { valid: true }
  }

  // Auth is enabled - check for configured token
  const expectedToken = process.env.MCP_AUTH_TOKEN

  if (!expectedToken) {
    return { valid: false, error: 'MCP_AUTH_TOKEN not configured' }
  }

  // Check for authorization header
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header' }
  }

  // Extract token from Bearer header
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Invalid token' }
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  // Validate token
  if (token !== expectedToken) {
    return { valid: false, error: 'Invalid token' }
  }

  return { valid: true }
}
