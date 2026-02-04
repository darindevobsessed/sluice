/**
 * Token generation and validation for agent authentication.
 * Tokens are short, readable strings used to authenticate WebSocket connections.
 */

/**
 * Generate a readable token in the format: abc-123-xyz
 * Uses only unambiguous characters (no 0/O, 1/l/I)
 */
export function generateToken(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let g = 0; g < 3; g++) {
    if (g > 0) token += '-'
    for (let i = 0; i < 3; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return token
}

/**
 * Validate a provided token against the expected token.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false

  let result = 0
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return result === 0
}
