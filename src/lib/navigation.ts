/**
 * Builds a returnTo value by combining pathname and query params, then encoding.
 * Returns empty string for bare KB (no point returning to `/` with no filters).
 */
export function buildReturnTo(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString()

  // Bare KB with no filters — no point in returnTo
  if (pathname === '/' && !query) {
    return ''
  }

  const fullPath = query ? `${pathname}?${query}` : pathname
  return encodeURIComponent(fullPath)
}

/**
 * Parses and validates a returnTo parameter.
 * Returns null if invalid or if it's an open redirect attempt.
 */
export function parseReturnTo(returnTo: string | null): string | null {
  if (!returnTo) return null

  try {
    const decoded = decodeURIComponent(returnTo)

    // Validate it starts with / but not // (prevent open redirects)
    if (!decoded.startsWith('/') || decoded.startsWith('//')) {
      return null
    }

    return decoded
  } catch {
    // Invalid encoding
    return null
  }
}

/**
 * Maps a returnTo value to contextual label and href.
 * Returns navigation metadata for the success state back button.
 */
export function getReturnLabel(returnTo: string | null): { href: string; label: string } {
  if (!returnTo) {
    return {
      href: '/',
      label: 'Browse Knowledge Bank',
    }
  }

  // Discovery pages
  if (returnTo.startsWith('/discovery')) {
    return {
      href: returnTo,
      label: 'Back to Discovery',
    }
  }

  // KB with filters (has query params)
  if (returnTo.startsWith('/?')) {
    return {
      href: returnTo,
      label: 'Back to Knowledge Bank',
    }
  }

  // Any other non-bare KB path (e.g., /videos/123)
  if (returnTo !== '/') {
    return {
      href: returnTo,
      label: 'Back to Knowledge Bank',
    }
  }

  // Bare KB (default)
  return {
    href: '/',
    label: 'Browse Knowledge Bank',
  }
}
