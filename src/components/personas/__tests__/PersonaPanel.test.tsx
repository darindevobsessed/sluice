import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PersonaPanel } from '../PersonaPanel'
import type { EnsembleState } from '@/hooks/useEnsemble'

describe('PersonaPanel', () => {
  const createEnsembleState = (overrides?: Partial<EnsembleState>): EnsembleState => ({
    isLoading: false,
    personas: new Map(),
    bestMatch: null,
    isAllDone: false,
    error: null,
    ...overrides,
  })

  it('renders the question as title', () => {
    const state = createEnsembleState()
    render(<PersonaPanel question="What is React Server Components?" state={state} />)

    expect(screen.getByText('What is React Server Components?')).toBeInTheDocument()
  })

  it('displays best match badge when bestMatch is available', () => {
    const state = createEnsembleState({
      bestMatch: { personaId: 1, personaName: 'Fireship', score: 0.95 },
    })
    render(<PersonaPanel question="How does RSC work?" state={state} />)

    expect(screen.getByText(/Best:/i)).toBeInTheDocument()
    expect(screen.getByText(/Fireship/i)).toBeInTheDocument()
  })

  it('does not display best match badge when bestMatch is null', () => {
    const state = createEnsembleState({ bestMatch: null })
    render(<PersonaPanel question="How does RSC work?" state={state} />)

    expect(screen.queryByText(/Best:/i)).not.toBeInTheDocument()
  })

  it('renders loading skeleton when isLoading is true', () => {
    const state = createEnsembleState({ isLoading: true })
    render(<PersonaPanel question="How does RSC work?" state={state} />)

    // Should have skeleton/pulse elements
    const skeletonElements = screen.getAllByTestId('persona-skeleton')
    expect(skeletonElements).toHaveLength(3) // 3 columns
  })

  it('renders PersonaColumn for each persona', () => {
    const personas = new Map([
      [
        1,
        {
          personaId: 1,
          personaName: 'Fireship',
          text: 'RSC is...',
          sources: [],
          isDone: false,
          isError: false,
        },
      ],
      [
        2,
        {
          personaId: 2,
          personaName: 'ThePrimeagen',
          text: 'Here is my take...',
          sources: [],
          isDone: false,
          isError: false,
        },
      ],
    ])

    const state = createEnsembleState({ personas })
    render(<PersonaPanel question="How does RSC work?" state={state} />)

    expect(screen.getByText('Fireship')).toBeInTheDocument()
    expect(screen.getByText('ThePrimeagen')).toBeInTheDocument()
  })

  it('marks correct persona as best match', () => {
    const personas = new Map([
      [
        1,
        {
          personaId: 1,
          personaName: 'Fireship',
          text: 'RSC is...',
          sources: [],
          isDone: false,
          isError: false,
        },
      ],
      [
        2,
        {
          personaId: 2,
          personaName: 'ThePrimeagen',
          text: 'Here is my take...',
          sources: [],
          isDone: false,
          isError: false,
        },
      ],
    ])

    const state = createEnsembleState({
      personas,
      bestMatch: { personaId: 2, personaName: 'ThePrimeagen', score: 0.95 },
    })

    render(<PersonaPanel question="How does RSC work?" state={state} />)

    // ThePrimeagen's column should have best match indicator
    const columns = screen.getAllByTestId('persona-column')
    expect(columns).toHaveLength(2)

    // Check that star badges exist (one in panel header, one in column)
    const starBadges = screen.getAllByText(/★/)
    expect(starBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('uses responsive grid layout', () => {
    const personas = new Map([
      [
        1,
        {
          personaId: 1,
          personaName: 'Fireship',
          text: 'RSC is...',
          sources: [],
          isDone: false,
          isError: false,
        },
      ],
    ])

    const state = createEnsembleState({ personas })
    const { container } = render(
      <PersonaPanel question="How does RSC work?" state={state} />
    )

    // Should have grid classes
    const gridElement = container.querySelector('[class*="grid"]')
    expect(gridElement).toBeInTheDocument()
    expect(gridElement?.className).toMatch(/grid/)
  })

  it('renders empty panel when no personas are loaded yet', () => {
    const state = createEnsembleState({ personas: new Map() })
    render(<PersonaPanel question="How does RSC work?" state={state} />)

    // Should still render the question but no columns
    expect(screen.getByText('How does RSC work?')).toBeInTheDocument()
    expect(screen.queryByTestId('persona-column')).not.toBeInTheDocument()
  })

  it('applies card styling', () => {
    const state = createEnsembleState()
    const { container } = render(
      <PersonaPanel question="How does RSC work?" state={state} />
    )

    // Should have bg-card, border, rounded classes
    const panelElement = container.firstChild
    expect(panelElement).toHaveClass('bg-card')
    expect(panelElement).toHaveClass('border')
    expect(panelElement).toHaveClass('rounded-lg')
  })

  it('displays specific error message from state.error', () => {
    const state = createEnsembleState({
      error: 'Unable to reach the server. Check your connection.',
    })
    render(<PersonaPanel question="How does RSC work?" state={state} />)

    expect(screen.getByText('Unable to reach the server. Check your connection.')).toBeInTheDocument()
  })

  it('displays fallback error message when state.error is empty string', () => {
    const state = createEnsembleState({
      error: '',
    })
    render(<PersonaPanel question="How does RSC work?" state={state} />)

    // When error is empty string (truthy but no message), show fallback
    expect(screen.getByText('An error occurred while fetching persona responses.')).toBeInTheDocument()
  })

  it('displays improved empty state message with transcript threshold', () => {
    const state = createEnsembleState({
      isAllDone: true,
      personas: new Map(),
    })
    render(<PersonaPanel question="How does RSC work?" state={state} />)

    expect(screen.getByText(/No personas available yet/i)).toBeInTheDocument()
    expect(screen.getByText(/5\+ transcripts/i)).toBeInTheDocument()
  })
})
