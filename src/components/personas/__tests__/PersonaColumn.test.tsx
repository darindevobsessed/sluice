import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PersonaColumn } from '../PersonaColumn'
import type { PersonaState } from '@/hooks/useEnsemble'

describe('PersonaColumn', () => {
  const createPersonaState = (overrides?: Partial<PersonaState>): PersonaState => ({
    personaId: 1,
    personaName: 'Fireship',
    text: '',
    sources: [],
    isDone: false,
    isError: false,
    ...overrides,
  })

  it('renders persona name', () => {
    const persona = createPersonaState({ personaName: 'ThePrimeagen' })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    expect(screen.getByText('ThePrimeagen')).toBeInTheDocument()
  })

  it('displays best match star badge when isBestMatch is true', () => {
    const persona = createPersonaState()
    render(<PersonaColumn persona={persona} isBestMatch={true} />)

    // Check for star symbol
    expect(screen.getByText(/★|⭐/)).toBeInTheDocument()
  })

  it('does not display star badge when isBestMatch is false', () => {
    const persona = createPersonaState()
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    // Star should not be present
    expect(screen.queryByText(/★|⭐/)).not.toBeInTheDocument()
  })

  it('renders loading state when not done and no error', () => {
    const persona = createPersonaState({ isDone: false, isError: false, text: '' })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    // Should have shimmer skeleton lines while waiting
    const element = screen.getByTestId('persona-text')
    const shimmerLines = element.querySelectorAll('.animate-pulse')
    expect(shimmerLines.length).toBeGreaterThan(0)
  })

  it('renders streaming text with cursor', () => {
    const persona = createPersonaState({ text: 'React Server Components are...', isDone: false })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    expect(screen.getByText(/React Server Components are\.\.\./)).toBeInTheDocument()
    // Should have typewriter cursor
    expect(screen.getByText('▌')).toBeInTheDocument()
  })

  it('removes cursor when done', () => {
    const persona = createPersonaState({ text: 'Complete response.', isDone: true })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    expect(screen.getByText('Complete response.')).toBeInTheDocument()
    expect(screen.queryByText('▌')).not.toBeInTheDocument()
  })

  it('displays source count when sources are available and done', () => {
    const persona = createPersonaState({
      isDone: true,
      text: 'Response text',
      sources: [
        { chunkId: 1, content: 'Content 1', videoTitle: 'Video 1' },
        { chunkId: 2, content: 'Content 2', videoTitle: 'Video 2' },
        { chunkId: 3, content: 'Content 3', videoTitle: 'Video 3' },
      ],
    })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    expect(screen.getByText(/3 sources?/i)).toBeInTheDocument()
  })

  it('handles singular source count', () => {
    const persona = createPersonaState({
      isDone: true,
      text: 'Response text',
      sources: [{ chunkId: 1, content: 'Content 1', videoTitle: 'Video 1' }],
    })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    expect(screen.getByText(/1 source/i)).toBeInTheDocument()
  })

  it('hides sources while still streaming', () => {
    const persona = createPersonaState({
      isDone: false,
      text: 'Streaming...',
      sources: [
        { chunkId: 1, content: 'Content 1', videoTitle: 'Video 1' },
      ],
    })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    expect(screen.queryByText(/1 source/i)).not.toBeInTheDocument()
  })

  it('renders error state when isError is true', () => {
    const persona = createPersonaState({
      isError: true,
      errorMessage: 'Rate limit exceeded',
    })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    expect(screen.getByText(/error/i)).toBeInTheDocument()
    expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument()
  })

  it('renders fallback error message when no errorMessage provided', () => {
    const persona = createPersonaState({
      isError: true,
    })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    expect(screen.getByText(/Error/i)).toBeInTheDocument()
    expect(screen.getByText(/Unable to generate response/i)).toBeInTheDocument()
  })

  it('displays empty text when no text has arrived yet', () => {
    const persona = createPersonaState({ text: '', isDone: false })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    // Should render without error, text area should be empty
    const element = screen.getByTestId('persona-text')
    expect(element.textContent).toBe('')
  })

  it('marks as done when isDone is true', () => {
    const persona = createPersonaState({
      text: 'Complete response',
      isDone: true,
    })
    render(<PersonaColumn persona={persona} isBestMatch={false} />)

    // Should NOT have loading/pulse animation
    const element = screen.getByTestId('persona-column')
    expect(element.className).not.toMatch(/animate-pulse/)
  })
})
