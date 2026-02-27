import { useState, useEffect, useRef, useCallback } from 'react'

export interface ChatMessage {
  question: string
  answer: string
  timestamp: number
  isStreaming?: boolean
  isError?: boolean
}

export interface PersonaChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
}

const STORAGE_KEY_PREFIX = 'persona-chat:'

function storageKey(personaId: number): string {
  return `${STORAGE_KEY_PREFIX}${personaId}`
}

/**
 * Reads Q&A history for a persona from localStorage.
 * Returns an empty array on any parse/validation error.
 */
function loadMessages(personaId: number): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(personaId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as ChatMessage[]
  } catch {
    return []
  }
}

/**
 * Persists only completed (non-streaming, non-error) messages to localStorage.
 */
function saveMessages(personaId: number, messages: ChatMessage[]): void {
  const completed = messages.filter(
    (m) => m.isStreaming !== true && m.isError !== true
  )
  try {
    localStorage.setItem(storageKey(personaId), JSON.stringify(completed))
  } catch {
    // Ignore quota exceeded or other storage errors
  }
}

interface UsePersonaChatReturn {
  state: PersonaChatState
  sendMessage: (question: string) => Promise<void>
  clearHistory: () => void
}

/**
 * Manages single-persona chat state: sending questions, parsing SSE streams,
 * accumulating text, and persisting Q&A history to localStorage.
 *
 * SSE format from POST /api/personas/[id]/query:
 *   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
 *   data: {"type":"done"}
 *
 * @param personaId - The persona to chat with
 */
export function usePersonaChat(personaId: number): UsePersonaChatReturn {
  const [state, setState] = useState<PersonaChatState>(() => ({
    messages: loadMessages(personaId),
    isStreaming: false,
    error: null,
  }))

  const abortControllerRef = useRef<AbortController | null>(null)

  // Reload messages when personaId changes
  useEffect(() => {
    setState({
      messages: loadMessages(personaId),
      isStreaming: false,
      error: null,
    })
  }, [personaId])

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const sendMessage = useCallback(
    async (question: string): Promise<void> => {
      // Abort any previous in-flight request
      abortControllerRef.current?.abort()

      const controller = new AbortController()
      abortControllerRef.current = controller

      const newMessage: ChatMessage = {
        question,
        answer: '',
        timestamp: Date.now(),
        isStreaming: true,
        isError: false,
      }

      // Append the new message (streaming placeholder) and set global state
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage],
        isStreaming: true,
        error: null,
      }))

      try {
        const response = await fetch(`/api/personas/${personaId}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        })

        if (!response.ok) {
          let errorMessage = 'Failed to query persona. Please try again.'
          try {
            const errorData = await response.json()
            if (errorData.error) {
              errorMessage = errorData.error
            }
          } catch {
            // Use default message if JSON parse fails
          }
          throw new Error(errorMessage)
        }

        const body = response.body
        if (!body) {
          throw new Error('Unable to reach the server. Check your connection.')
        }

        const reader = body.getReader()
        const decoder = new TextDecoder()

        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data:')) continue

              const dataStr = line.substring(5).trim()
              if (!dataStr) continue

              let event: unknown
              try {
                event = JSON.parse(dataStr)
              } catch {
                // Skip malformed JSON lines
                continue
              }

              if (
                typeof event !== 'object' ||
                event === null ||
                !('type' in event)
              ) {
                continue
              }

              const typedEvent = event as Record<string, unknown>

              if (typedEvent['type'] === 'content_block_delta') {
                const delta = typedEvent['delta']
                if (
                  typeof delta === 'object' &&
                  delta !== null &&
                  (delta as Record<string, unknown>)['type'] === 'text_delta'
                ) {
                  const text = (delta as Record<string, unknown>)['text']
                  if (typeof text === 'string') {
                    setState((prev) => {
                      const messages = prev.messages.map((m, idx) =>
                        idx === prev.messages.length - 1
                          ? { ...m, answer: m.answer + text }
                          : m
                      )
                      return { ...prev, messages }
                    })
                  }
                }
              } else if (typedEvent['type'] === 'done') {
                // Finalize the message
                setState((prev) => {
                  const messages = prev.messages.map((m, idx) =>
                    idx === prev.messages.length - 1
                      ? { ...m, isStreaming: false }
                      : m
                  )
                  saveMessages(personaId, messages)
                  return { ...prev, messages, isStreaming: false }
                })
              }
            }
          }
        } finally {
          reader.releaseLock()
          // Ensure isStreaming is cleared if stream closed without done event
          setState((prev) => {
            if (prev.isStreaming) {
              return { ...prev, isStreaming: false }
            }
            return prev
          })
        }
      } catch (error) {
        // Ignore abort errors — they're intentional
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        let errorMessage = 'An error occurred. Please try again.'
        if (error instanceof Error) {
          errorMessage = error.message
        }

        // Mark the last message as an error
        setState((prev) => {
          const messages = prev.messages.map((m, idx) =>
            idx === prev.messages.length - 1
              ? { ...m, isStreaming: false, isError: true }
              : m
          )
          return { ...prev, messages, isStreaming: false, error: errorMessage }
        })
      }
    },
    [personaId]
  )

  const clearHistory = useCallback(() => {
    localStorage.removeItem(storageKey(personaId))
    setState({ messages: [], isStreaming: false, error: null })
  }, [personaId])

  return { state, sendMessage, clearHistory }
}
