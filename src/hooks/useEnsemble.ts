import { useState, useEffect, useRef, useCallback } from 'react'

export interface PersonaState {
  personaId: number
  personaName: string
  text: string
  sources: Array<{ chunkId: number; content: string; videoTitle: string }>
  isDone: boolean
  isError: boolean
  errorMessage?: string
}

export interface EnsembleState {
  isLoading: boolean
  personas: Map<number, PersonaState>
  bestMatch: { personaId: number; personaName: string; score: number } | null
  isAllDone: boolean
  error: string | null
}

/**
 * Hook for managing ensemble query state and SSE parsing.
 *
 * When question is non-null, POSTs to /api/personas/ensemble
 * and parses SSE events to build up persona response state.
 *
 * @param question - The question to ask (null = no query)
 * @returns Ensemble state and reset function
 */
export function useEnsemble(question: string | null) {
  const [state, setState] = useState<EnsembleState>({
    isLoading: false,
    personas: new Map(),
    bestMatch: null,
    isAllDone: false,
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      personas: new Map(),
      bestMatch: null,
      isAllDone: false,
      error: null,
    })
  }, [])

  useEffect(() => {
    // Abort previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // If no question, don't query
    if (!question) {
      reset()
      return
    }

    // Create new abort controller
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Start loading
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }))

    // Query the ensemble endpoint
    async function queryEnsemble() {
      try {
        const response = await fetch('/api/personas/ensemble', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const body = response.body
        if (!body) {
          throw new Error('No response body')
        }

        // Parse SSE stream
        const reader = body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          // Decode chunk
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const dataStr = line.substring(5).trim()

              if (!dataStr) continue

              try {
                const event = JSON.parse(dataStr)

                // Handle different event types
                switch (event.type) {
                  case 'persona_start': {
                    const { personaId, personaName } = event
                    setState((prev) => {
                      const newPersonas = new Map(prev.personas)
                      newPersonas.set(personaId, {
                        personaId,
                        personaName,
                        text: '',
                        sources: [],
                        isDone: false,
                        isError: false,
                      })
                      return { ...prev, personas: newPersonas }
                    })
                    break
                  }

                  case 'delta': {
                    const { personaId, text } = event
                    setState((prev) => {
                      const newPersonas = new Map(prev.personas)
                      const persona = newPersonas.get(personaId)
                      if (persona) {
                        newPersonas.set(personaId, {
                          ...persona,
                          text: persona.text + text,
                        })
                      }
                      return { ...prev, personas: newPersonas }
                    })
                    break
                  }

                  case 'sources': {
                    const { personaId, chunks } = event
                    setState((prev) => {
                      const newPersonas = new Map(prev.personas)
                      const persona = newPersonas.get(personaId)
                      if (persona) {
                        newPersonas.set(personaId, {
                          ...persona,
                          sources: chunks.map((c: unknown) => {
                            const chunk = c as {
                              chunkId: number
                              content: string
                              videoTitle: string
                            }
                            return {
                              chunkId: chunk.chunkId,
                              content: chunk.content,
                              videoTitle: chunk.videoTitle,
                            }
                          }),
                        })
                      }
                      return { ...prev, personas: newPersonas }
                    })
                    break
                  }

                  case 'persona_done': {
                    const { personaId } = event
                    setState((prev) => {
                      const newPersonas = new Map(prev.personas)
                      const persona = newPersonas.get(personaId)
                      if (persona) {
                        newPersonas.set(personaId, {
                          ...persona,
                          isDone: true,
                        })
                      }
                      return { ...prev, personas: newPersonas }
                    })
                    break
                  }

                  case 'persona_error': {
                    const { personaId, error: errorMsg } = event
                    setState((prev) => {
                      const newPersonas = new Map(prev.personas)
                      const persona = newPersonas.get(personaId)
                      if (persona) {
                        newPersonas.set(personaId, {
                          ...persona,
                          isError: true,
                          errorMessage: errorMsg,
                        })
                      }
                      return { ...prev, personas: newPersonas }
                    })
                    break
                  }

                  case 'best_match': {
                    const { personaId, personaName, score } = event
                    setState((prev) => ({
                      ...prev,
                      bestMatch: { personaId, personaName, score },
                    }))
                    break
                  }

                  case 'all_done': {
                    setState((prev) => ({
                      ...prev,
                      isAllDone: true,
                      isLoading: false,
                    }))
                    break
                  }

                  default:
                    // Unknown event type, skip
                    break
                }
              } catch {
                // Skip malformed JSON
                continue
              }
            }
          }
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
          isLoading: false,
        }))
      }
    }

    queryEnsemble()

    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [question, reset])

  return {
    state,
    reset,
  }
}
