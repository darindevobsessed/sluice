import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonaChatDrawer } from '../PersonaChatDrawer'
import type { PersonaChatState } from '@/hooks/usePersonaChat'

// Mutable state object so individual tests can modify it
let mockState: PersonaChatState = {
  messages: [],
  isStreaming: false,
  error: null,
}

const mockSendMessage = vi.fn()
const mockClearHistory = vi.fn()

vi.mock('@/hooks/usePersonaChat', () => ({
  usePersonaChat: () => ({
    state: mockState,
    sendMessage: mockSendMessage,
    clearHistory: mockClearHistory,
  }),
}))

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  personaId: 1,
  personaName: 'Fireship',
  expertiseTopics: ['React', 'TypeScript', 'Next.js', 'Svelte'],
}

function renderDrawer(props = {}) {
  return render(<PersonaChatDrawer {...defaultProps} {...props} />)
}

describe('PersonaChatDrawer', () => {
  beforeEach(() => {
    mockState = {
      messages: [],
      isStreaming: false,
      error: null,
    }
    mockSendMessage.mockClear()
    mockClearHistory.mockClear()
  })

  it('renders persona name in header', () => {
    renderDrawer()
    expect(screen.getByText('Fireship')).toBeInTheDocument()
  })

  it('renders expertise topics (first 3 joined by comma)', () => {
    renderDrawer()
    expect(screen.getByText('React, TypeScript, Next.js')).toBeInTheDocument()
  })

  it('shows avatar with first letter of persona name', () => {
    renderDrawer()
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('shows empty state when no messages', () => {
    renderDrawer()
    expect(screen.getByText('Ask Fireship anything...')).toBeInTheDocument()
  })

  it('shows independence disclaimer', () => {
    renderDrawer()
    expect(
      screen.getByText('Each question is independent — no conversation memory')
    ).toBeInTheDocument()
  })

  it('renders input placeholder with persona name', () => {
    renderDrawer()
    const input = screen.getByPlaceholderText('Ask Fireship anything...')
    expect(input).toBeInTheDocument()
  })

  it('disables send button when input is empty', () => {
    renderDrawer()
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()
  })

  it('enables send button when input has text', async () => {
    const user = userEvent.setup()
    renderDrawer()
    const input = screen.getByPlaceholderText('Ask Fireship anything...')
    await user.type(input, 'What is React?')
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).not.toBeDisabled()
  })

  it('calls sendMessage on form submit', async () => {
    const user = userEvent.setup()
    renderDrawer()
    const input = screen.getByPlaceholderText('Ask Fireship anything...')
    await user.type(input, 'What is React?')
    await user.keyboard('{Enter}')
    expect(mockSendMessage).toHaveBeenCalledWith('What is React?')
  })

  it('clears input after submit', async () => {
    const user = userEvent.setup()
    renderDrawer()
    const input = screen.getByPlaceholderText('Ask Fireship anything...')
    await user.type(input, 'What is React?')
    await user.keyboard('{Enter}')
    expect(input).toHaveValue('')
  })

  it('does not submit on Shift+Enter', async () => {
    const user = userEvent.setup()
    renderDrawer()
    const input = screen.getByPlaceholderText('Ask Fireship anything...')
    await user.type(input, 'What is React?')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('renders messages in thread', () => {
    mockState = {
      messages: [
        {
          question: 'What is React?',
          answer: 'React is a UI library.',
          timestamp: 1000000,
          isStreaming: false,
          isError: false,
        },
      ],
      isStreaming: false,
      error: null,
    }
    renderDrawer()
    expect(screen.getByText('What is React?')).toBeInTheDocument()
    expect(screen.getByText('React is a UI library.')).toBeInTheDocument()
  })

  it('shows streaming cursor during active stream', () => {
    mockState = {
      messages: [
        {
          question: 'What is React?',
          answer: 'React is',
          timestamp: 1000000,
          isStreaming: true,
          isError: false,
        },
      ],
      isStreaming: true,
      error: null,
    }
    renderDrawer()
    // The streaming cursor character should be present
    expect(screen.getByText(/▌/)).toBeInTheDocument()
  })

  it('disables input during streaming', () => {
    mockState = {
      messages: [],
      isStreaming: true,
      error: null,
    }
    renderDrawer()
    const input = screen.getByPlaceholderText('Ask Fireship anything...')
    expect(input).toBeDisabled()
  })

  it('shows error message with retry button when message has error', () => {
    mockState = {
      messages: [
        {
          question: 'What is React?',
          answer: '',
          timestamp: 1000000,
          isStreaming: false,
          isError: true,
        },
      ],
      isStreaming: false,
      error: 'Something went wrong',
    }
    renderDrawer()
    expect(screen.getByText('Something went wrong, try again')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('calls sendMessage with the failed question when retry is clicked', async () => {
    const user = userEvent.setup()
    mockState = {
      messages: [
        {
          question: 'What is React?',
          answer: '',
          timestamp: 1000000,
          isStreaming: false,
          isError: true,
        },
      ],
      isStreaming: false,
      error: 'Something went wrong',
    }
    renderDrawer()
    const retryButton = screen.getByRole('button', { name: /retry/i })
    await user.click(retryButton)
    expect(mockSendMessage).toHaveBeenCalledWith('What is React?')
  })

  it('shows clear history button when messages exist', () => {
    mockState = {
      messages: [
        {
          question: 'What is React?',
          answer: 'React is a UI library.',
          timestamp: 1000000,
          isStreaming: false,
          isError: false,
        },
      ],
      isStreaming: false,
      error: null,
    }
    renderDrawer()
    expect(screen.getByRole('button', { name: /clear history/i })).toBeInTheDocument()
  })

  it('does not show clear history button when no messages', () => {
    renderDrawer()
    expect(screen.queryByRole('button', { name: /clear history/i })).not.toBeInTheDocument()
  })

  it('calls clearHistory when clear button clicked', async () => {
    const user = userEvent.setup()
    mockState = {
      messages: [
        {
          question: 'What is React?',
          answer: 'React is a UI library.',
          timestamp: 1000000,
          isStreaming: false,
          isError: false,
        },
      ],
      isStreaming: false,
      error: null,
    }
    renderDrawer()
    const clearButton = screen.getByRole('button', { name: /clear history/i })
    await user.click(clearButton)
    expect(mockClearHistory).toHaveBeenCalledOnce()
  })

  it('does not render drawer content when open is false', () => {
    renderDrawer({ open: false })
    // Persona name should not be visible in the header when closed
    // The SheetTitle is inside a dialog that's not visible when closed
    expect(screen.queryByText('Ask Fireship anything...')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when streaming with no answer text yet', () => {
    mockState = {
      messages: [
        {
          question: 'What is React?',
          answer: '',
          timestamp: 1000000,
          isStreaming: true,
          isError: false,
        },
      ],
      isStreaming: true,
      error: null,
    }
    renderDrawer()
    // Skeleton elements should appear when streaming but no text yet
    const skeletons = screen.getAllByTestId('streaming-skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('handles missing expertiseTopics gracefully', () => {
    renderDrawer({ expertiseTopics: undefined })
    // Should render without crashing
    expect(screen.getByText('Fireship')).toBeInTheDocument()
  })

  it('shows only first 3 expertise topics', () => {
    renderDrawer()
    // Should show "React, TypeScript, Next.js" — NOT "Svelte"
    expect(screen.getByText('React, TypeScript, Next.js')).toBeInTheDocument()
    expect(screen.queryByText(/Svelte/)).not.toBeInTheDocument()
  })

  it('renders mobile back arrow', () => {
    renderDrawer()
    expect(screen.getByLabelText('Close chat')).toBeInTheDocument()
  })

  it('calls onOpenChange when back arrow clicked', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<PersonaChatDrawer {...defaultProps} onOpenChange={onOpenChange} />)
    await user.click(screen.getByLabelText('Close chat'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('has accessible labels on input and send button', () => {
    render(<PersonaChatDrawer {...defaultProps} personaName="Theo Browne" />)
    expect(screen.getByLabelText('Ask Theo Browne a question')).toBeInTheDocument()
    expect(screen.getByLabelText('Send message')).toBeInTheDocument()
  })

  it('renders error message in failed message bubble', () => {
    mockState.messages = [
      { question: 'Test', answer: '', timestamp: Date.now(), isError: true },
    ]
    renderDrawer()
    expect(screen.getByText('Something went wrong, try again')).toBeInTheDocument()
  })
})
