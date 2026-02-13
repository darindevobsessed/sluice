'use client'

import { useState, useEffect, useMemo } from 'react'

export function useRotatingMessages(
  messages: string[],
  intervalMs = 3000,
): string {
  // Track messages array identity to detect changes
  const messagesKey = useMemo(() => messages, [messages])

  const [state, setState] = useState({
    index: 0,
    messagesKey,
  })

  // Reset index when messages array reference changes
  if (state.messagesKey !== messagesKey) {
    setState({ index: 0, messagesKey })
  }

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) return

    const timer = setInterval(() => {
      setState(prev => ({
        index: (prev.index + 1) % messages.length,
        messagesKey: prev.messagesKey,
      }))
    }, intervalMs)

    return () => clearInterval(timer)
  }, [messages.length, intervalMs, messagesKey])

  return messages[state.index] ?? messages[0] ?? ''
}
