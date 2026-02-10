import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonaStatus } from '../PersonaStatus'

// Mock fetch globally
global.fetch = vi.fn()

describe('PersonaStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state on initial mount', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<PersonaStatus />)

    // Should show shimmer/loading indicator
    expect(screen.getByTestId('persona-status-loading')).toBeInTheDocument()
  })

  it('does not render when no channels exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ channels: [], threshold: 5 }),
    } as Response)

    const { container } = render(<PersonaStatus />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/personas/status')
    })

    // Component should not render at all
    expect(container.firstChild).toBeNull()
  })

  it('renders section header with active and building counts', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          { channelName: 'Fireship', transcriptCount: 10, personaId: 1, personaCreatedAt: new Date() },
          { channelName: 'ThePrimeagen', transcriptCount: 8, personaId: 2, personaCreatedAt: new Date() },
          { channelName: 'Theo', transcriptCount: 3, personaId: null, personaCreatedAt: null },
        ],
        threshold: 5,
      }),
    } as Response)

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByText(/Personas/i)).toBeInTheDocument()
    })

    // Should show "2 active · 1 building"
    expect(screen.getByText(/2 active/i)).toBeInTheDocument()
    expect(screen.getByText(/1 building/i)).toBeInTheDocument()
  })

  it('renders active persona with checkmark badge', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          { channelName: 'Fireship', transcriptCount: 10, personaId: 1, personaCreatedAt: new Date() },
        ],
        threshold: 5,
      }),
    } as Response)

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByText('@Fireship')).toBeInTheDocument()
    })

    // Should show checkmark
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('renders ready-to-create channel with transcript count and Create button', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          { channelName: 'Theo', transcriptCount: 6, personaId: null, personaCreatedAt: null },
        ],
        threshold: 5,
      }),
    } as Response)

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByText('@Theo')).toBeInTheDocument()
    })

    // Should show transcript count
    expect(screen.getByText(/6 transcripts/i)).toBeInTheDocument()

    // Should show Create button
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('renders building channel with progress bar and "more needed" text', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          { channelName: 'Web Dev Simplified', transcriptCount: 2, personaId: null, personaCreatedAt: null },
        ],
        threshold: 5,
      }),
    } as Response)

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByText('@Web Dev Simplified')).toBeInTheDocument()
    })

    // Should show progress (2/5)
    expect(screen.getByText('2/5')).toBeInTheDocument()

    // Should show "3 more needed"
    expect(screen.getByText(/3 more needed/i)).toBeInTheDocument()

    // Should have a progress bar
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders mix of active, ready, and building channels', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          { channelName: 'Fireship', transcriptCount: 10, personaId: 1, personaCreatedAt: new Date() },
          { channelName: 'Theo', transcriptCount: 6, personaId: null, personaCreatedAt: null },
          { channelName: 'Web Dev Simplified', transcriptCount: 2, personaId: null, personaCreatedAt: null },
        ],
        threshold: 5,
      }),
    } as Response)

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByText('@Fireship')).toBeInTheDocument()
    })

    // Active persona with checkmark
    expect(screen.getByText('✓')).toBeInTheDocument()

    // Ready to create with Create button
    expect(screen.getByText('@Theo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()

    // Building with progress
    expect(screen.getByText('@Web Dev Simplified')).toBeInTheDocument()
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('calls POST /api/personas when Create button is clicked', async () => {
    const user = userEvent.setup()

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          channels: [
            { channelName: 'Theo', transcriptCount: 6, personaId: null, personaCreatedAt: null },
          ],
          threshold: 5,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    })

    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/personas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channelName: 'Theo' }),
      })
    })
  })

  it('updates card to active state after successful persona creation', async () => {
    const user = userEvent.setup()

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          channels: [
            { channelName: 'Theo', transcriptCount: 6, personaId: null, personaCreatedAt: null },
          ],
          threshold: 5,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ personaId: 42 }),
      } as Response)

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    })

    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    // After creation, card should update to active state (checkmark)
    await waitFor(() => {
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    // Create button should be gone
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument()
  })

  it('shows loading state on Create button while creating', async () => {
    const user = userEvent.setup()

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          channels: [
            { channelName: 'Theo', transcriptCount: 6, personaId: null, personaCreatedAt: null },
          ],
          threshold: 5,
        }),
      } as Response)
      .mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    })

    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText(/creating/i)).toBeInTheDocument()
    })
  })

  it('shows error message when persona creation fails', async () => {
    const user = userEvent.setup()

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          channels: [
            { channelName: 'Theo', transcriptCount: 6, personaId: null, personaCreatedAt: null },
          ],
          threshold: 5,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to create persona' }),
      } as Response)

    render(<PersonaStatus />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    })

    const createButton = screen.getByRole('button', { name: /create/i })
    await user.click(createButton)

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText(/failed to create persona/i)).toBeInTheDocument()
    })
  })

  it('passes hasActivePersonas prop to callback when personas exist', async () => {
    const onActivePersonasChange = vi.fn()

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          { channelName: 'Fireship', transcriptCount: 10, personaId: 1, personaCreatedAt: new Date() },
        ],
        threshold: 5,
      }),
    } as Response)

    render(<PersonaStatus onActivePersonasChange={onActivePersonasChange} />)

    await waitFor(() => {
      expect(onActivePersonasChange).toHaveBeenCalledWith(true)
    })
  })

  it('calls callback with false when no active personas exist', async () => {
    const onActivePersonasChange = vi.fn()

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        channels: [
          { channelName: 'Theo', transcriptCount: 3, personaId: null, personaCreatedAt: null },
        ],
        threshold: 5,
      }),
    } as Response)

    render(<PersonaStatus onActivePersonasChange={onActivePersonasChange} />)

    await waitFor(() => {
      expect(onActivePersonasChange).toHaveBeenCalledWith(false)
    })
  })
})
