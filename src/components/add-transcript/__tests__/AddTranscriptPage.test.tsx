import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddTranscriptPage } from '../AddTranscriptPage'

// Mock next/navigation for useSearchParams
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('AddTranscriptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form fields', () => {
    render(<AddTranscriptPage />)

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/source/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/transcript/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
  })

  it('shows character count for transcript field', () => {
    render(<AddTranscriptPage />)

    // Character count should be visible
    expect(screen.getByText(/0 characters/i)).toBeInTheDocument()
  })

  it('updates character count as user types', async () => {
    const user = userEvent.setup()
    render(<AddTranscriptPage />)

    const textarea = screen.getByLabelText(/transcript/i)
    await user.type(textarea, 'Test transcript content')

    expect(screen.getByText(/23 characters/i)).toBeInTheDocument()
  })

  it('submit button is disabled when form is empty', () => {
    render(<AddTranscriptPage />)

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    expect(submitButton).toBeDisabled()
  })

  it('submit button is disabled when title is missing', async () => {
    const user = userEvent.setup()
    render(<AddTranscriptPage />)

    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(sourceInput, 'Test Source')
    await user.type(transcriptInput, 'This is a long enough transcript content that meets the minimum requirement')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    expect(submitButton).toBeDisabled()
  })

  it('submit button is enabled when source is empty (optional field)', async () => {
    const user = userEvent.setup()
    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Title')
    await user.type(transcriptInput, 'This is a long enough transcript content that meets the minimum requirement')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    expect(submitButton).toBeEnabled()
  })

  it('submit button is disabled when transcript is too short', async () => {
    const user = userEvent.setup()
    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Title')
    await user.type(sourceInput, 'Test Source')
    await user.type(transcriptInput, 'Short')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    expect(submitButton).toBeDisabled()
  })

  it('submit button is enabled when all required fields are valid', async () => {
    const user = userEvent.setup()
    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Title')
    await user.type(sourceInput, 'Test Source')
    await user.type(transcriptInput, 'This is a long enough transcript content that meets the minimum requirement')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('submits form with correct data structure', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123' }),
    } as Response)

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)
    const tagsInput = screen.getByLabelText(/tags/i)
    const notesInput = screen.getByLabelText(/notes/i)

    await user.type(titleInput, 'Test Meeting Notes')
    await user.type(sourceInput, 'Internal Team Meeting')
    await user.type(transcriptInput, 'This is the full meeting transcript with sufficient content')
    await user.type(tagsInput, 'meeting, planning')
    await user.type(notesInput, 'Q1 planning discussion')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/videos',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType: 'transcript',
            title: 'Test Meeting Notes',
            channel: 'Internal Team Meeting',
            transcript: 'This is the full meeting transcript with sufficient content',
            tags: ['meeting', 'planning'],
            notes: 'Q1 planning discussion',
          }),
        })
      )
    })
  })

  it('submits without tags and notes when optional fields are empty', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123' }),
    } as Response)

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Meeting Notes')
    await user.type(sourceInput, 'Internal Team Meeting')
    await user.type(transcriptInput, 'This is the full meeting transcript with sufficient content')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/videos',
        expect.objectContaining({
          body: JSON.stringify({
            sourceType: 'transcript',
            title: 'Test Meeting Notes',
            channel: 'Internal Team Meeting',
            transcript: 'This is the full meeting transcript with sufficient content',
            tags: [],
            notes: '',
          }),
        })
      )
    })
  })

  it('submits without channel when source is empty', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123' }),
    } as Response)

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Meeting Notes')
    await user.type(transcriptInput, 'This is the full meeting transcript with sufficient content')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/videos',
        expect.objectContaining({
          body: JSON.stringify({
            sourceType: 'transcript',
            title: 'Test Meeting Notes',
            transcript: 'This is the full meeting transcript with sufficient content',
            tags: [],
            notes: '',
          }),
        })
      )
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ id: '123' }),
          } as Response)
        }, 1000)
      })
    )

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Title')
    await user.type(sourceInput, 'Test Source')
    await user.type(transcriptInput, 'This is a long enough transcript content that meets the minimum requirement')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    // Should show loading state
    expect(screen.getByText(/adding to your knowledge bank/i)).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('shows success state after successful submission', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123' }),
    } as Response)

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Meeting')
    await user.type(sourceInput, 'Team Call')
    await user.type(transcriptInput, 'This is the full meeting transcript with sufficient content')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/added to your knowledge bank/i)).toBeInTheDocument()
    })
  })

  it('shows error message on submission failure', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Database error' }),
    } as Response)

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Title')
    await user.type(sourceInput, 'Test Source')
    await user.type(transcriptInput, 'This is a long enough transcript content that meets the minimum requirement')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/database error/i)).toBeInTheDocument()
    })
  })

  it('allows reset after successful submission', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123' }),
    } as Response)

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const sourceInput = screen.getByLabelText(/source/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Meeting')
    await user.type(sourceInput, 'Team Call')
    await user.type(transcriptInput, 'This is the full meeting transcript with sufficient content')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/added to your knowledge bank/i)).toBeInTheDocument()
    })

    const addAnotherButton = screen.getByRole('button', { name: /add another/i })
    await user.click(addAnotherButton)

    // Should return to form
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
  })
})

describe('AddTranscriptPage - returnTo Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete('returnTo')
  })

  it('passes returnTo to SuccessState when present in URL', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    // Set returnTo param
    mockSearchParams.set('returnTo', encodeURIComponent('/discovery?channel=abc'))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123' }),
    } as Response)

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Meeting')
    await user.type(transcriptInput, 'This is the full meeting transcript with sufficient content')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/added to your knowledge bank/i)).toBeInTheDocument()
    })

    // Should show "Back to Discovery" label
    expect(screen.getByText(/back to discovery/i)).toBeInTheDocument()
  })

  it('shows "Browse Knowledge Bank" when no returnTo present', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.mocked(global.fetch)

    // No returnTo param

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123' }),
    } as Response)

    render(<AddTranscriptPage />)

    const titleInput = screen.getByLabelText(/title/i)
    const transcriptInput = screen.getByLabelText(/transcript/i)

    await user.type(titleInput, 'Test Meeting')
    await user.type(transcriptInput, 'This is the full meeting transcript with sufficient content')

    const submitButton = screen.getByRole('button', { name: /add to knowledge bank/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/added to your knowledge bank/i)).toBeInTheDocument()
    })

    // Should show default label
    expect(screen.getByText(/browse knowledge bank/i)).toBeInTheDocument()
  })
})
