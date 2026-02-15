'use client'

import { useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export function useURLParams() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const updateParams = useCallback((
    updates: Record<string, string | null>,
    method: 'replace' | 'push' = 'replace'
  ) => {
    // Read current params from window.location.search for referential stability
    const params = new URLSearchParams(window.location.search)

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    // Construct URL
    const queryString = params.toString()
    const url = queryString ? `${pathname}?${queryString}` : pathname

    // Navigate
    router[method](url)
  }, [pathname, router])

  return { searchParams, updateParams }
}
