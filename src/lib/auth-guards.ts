import { timingSafeEqual } from 'crypto'

/**
 * Result of a cron secret verification.
 * If valid is false, response contains a pre-built 401 Response to return immediately.
 */
type CronVerifyResult =
  | { valid: true }
  | { valid: false; response: Response }

/**
 * Verify that the request's Authorization header matches the CRON_SECRET env var.
 * Uses timing-safe comparison to prevent timing attacks.
 * Returns 401 if CRON_SECRET is unset (prevents Bearer undefined bypass).
 */
export function verifyCronSecret(request: Request): CronVerifyResult {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return {
      valid: false,
      response: new Response('Unauthorized', { status: 401 }),
    }
  }

  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${cronSecret}`

  if (!authHeader) {
    return {
      valid: false,
      response: new Response('Unauthorized', { status: 401 }),
    }
  }

  // Timing-safe comparison: both strings must be same length for timingSafeEqual.
  // If lengths differ, the comparison is already false, but we still call
  // timingSafeEqual on padded buffers to avoid leaking length information.
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)

  const isEqual = a.length === b.length && timingSafeEqual(a, b)

  if (!isEqual) {
    return {
      valid: false,
      response: new Response('Unauthorized', { status: 401 }),
    }
  }

  return { valid: true }
}

/**
 * Timing-safe string comparison.
 * Returns true only if both strings are identical.
 * Safe against timing attacks on secret comparison.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}
