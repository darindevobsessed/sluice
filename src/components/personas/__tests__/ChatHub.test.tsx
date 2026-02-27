import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatHub } from '../ChatHub'
import type { Persona } from '../ChatHub'
import type { ChatStorageV2 } from '@/lib/personas/chat-storage'

// ── localStorage mock ──────────────────────────────────────────────────────────

function makeLocalStorageMock() {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k] }) },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
    _store: store,
  }
}

let mockStorage = makeLocalStorageMock()

beforeEach(() => {
  mockStorage = makeLocalStorageMock()
  Object.defineProperty(global, 'localStorage', {
    value: mockStorage,
    writable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function storePersonaChat(personaId: number, data: ChatStorageV2) {
  mockStorage.setItem(`persona-chat:${personaId}`, JSON.stringify(data))
}

const makeMessage = (
  question: string,
  answer: string,
  timestamp: number
) => ({ question, answer, timestamp })

// ── Fixtures ──────────────────────────────────────────────────────────────────

const persona1: Persona = {
  id: 1,
  name: 'Fireship',
  channelName: 'Fireship',
  expertiseTopics: ['React', 'TypeScript'],
}

const persona2: Persona = {
  id: 2,
  name: 'Theo Browne',
  channelName: 't3.gg',
  expertiseTopics: ['Next.js', 'tRPC'],
}

const persona3: Persona = {
  id: 3,
  name: 'ThePrimeagen',
  channelName: 'ThePrimeagen',
  expertiseTopics: ['Rust', 'Neovim'],
}

const defaultProps = {
  personas: [persona1, persona2, persona3],
  isLoading: false,
  onSelectPersona: vi.fn(),
  onClose: vi.fn(),
}

function renderHub(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(<ChatHub {...props} />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ChatHub', () => {
  beforeEach(() => {
    defaultProps.onSelectPersona = vi.fn()
    defaultProps.onClose = vi.fn()
  })

  // ── Loading state ────────────────────────────────────────────────────────

  it('shows loading skeleton when isLoading is true', () => {
    renderHub({ isLoading: true })
    const skeletons = screen.getAllByTestId('hub-skeleton-row')
    expect(skeletons).toHaveLength(3)
  })

  it('does not show personas while loading', () => {
    renderHub({ isLoading: true })
    expect(screen.queryByText('Fireship')).not.toBeInTheDocument()
  })

  // ── Empty states ─────────────────────────────────────────────────────────

  it('shows empty state when no personas exist', () => {
    renderHub({ personas: [] })
    expect(
      screen.getByText(/No personas available yet/)
    ).toBeInTheDocument()
  })

  it('shows "no conversations" empty state when personas exist but no history', () => {
    renderHub()
    expect(
      screen.getByText(/No conversations yet/)
    ).toBeInTheDocument()
  })

  // ── Available personas (no history) ─────────────────────────────────────

  it('lists all personas as "Pick a creator" pills when no history', () => {
    renderHub()
    // All 3 should appear as available pills
    expect(screen.getByRole('button', { name: /Fireship/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Theo Browne/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ThePrimeagen/ })).toBeInTheDocument()
  })

  it('shows "Pick a creator" section label when no conversations exist', () => {
    renderHub()
    expect(screen.getByText('Pick a creator')).toBeInTheDocument()
  })

  // ── Recent conversations ──────────────────────────────────────────────────

  it('shows recent conversations when localStorage has data', () => {
    storePersonaChat(1, {
      version: 2,
      entries: [makeMessage('What is React?', 'React is a UI library.', 1000000)],
    })
    renderHub()
    expect(screen.getByText('Fireship')).toBeInTheDocument()
  })

  it('shows message preview in conversation card', () => {
    storePersonaChat(1, {
      version: 2,
      entries: [makeMessage('What is React?', 'React is a UI library.', 1000000)],
    })
    renderHub()
    // Preview should show the question (truncated)
    expect(screen.getByText(/What is React\?/)).toBeInTheDocument()
  })

  it('shows "Recent" section label when conversations exist', () => {
    storePersonaChat(1, {
      version: 2,
      entries: [makeMessage('What is React?', 'React is a UI library.', 1000000)],
    })
    renderHub()
    expect(screen.getByText('Recent')).toBeInTheDocument()
  })

  it('shows "Start new" section label when some conversations and some without', () => {
    storePersonaChat(1, {
      version: 2,
      entries: [makeMessage('What is React?', 'React is a UI library.', 1000000)],
    })
    renderHub()
    // persona2 and persona3 have no history, should be in "Start new" section
    expect(screen.getByText('Start new')).toBeInTheDocument()
  })

  // ── Interactions ─────────────────────────────────────────────────────────

  it('calls onSelectPersona when conversation card clicked', async () => {
    const user = userEvent.setup()
    const onSelectPersona = vi.fn()
    storePersonaChat(1, {
      version: 2,
      entries: [makeMessage('What is React?', 'React is a UI library.', 1000000)],
    })
    renderHub({ onSelectPersona })
    // Find and click the Fireship conversation card
    const card = screen.getByRole('button', { name: /Fireship/ })
    await user.click(card)
    expect(onSelectPersona).toHaveBeenCalledWith(persona1)
  })

  it('calls onSelectPersona when available persona pill clicked', async () => {
    const user = userEvent.setup()
    const onSelectPersona = vi.fn()
    renderHub({ onSelectPersona })
    const pill = screen.getByRole('button', { name: /Fireship/ })
    await user.click(pill)
    expect(onSelectPersona).toHaveBeenCalledWith(persona1)
  })

  it('calls onClose when X button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderHub({ onClose })
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ── Separation of recent vs available ───────────────────────────────────

  it('separates personas with history from those without', () => {
    // Only persona1 has history
    storePersonaChat(1, {
      version: 2,
      entries: [makeMessage('Hello', 'Hi there!', 2000000)],
    })
    renderHub()

    // Fireship should appear under "Recent"
    const recentSection = screen.getByTestId('recent-section')
    expect(within(recentSection).getByText('Fireship')).toBeInTheDocument()

    // Theo Browne and ThePrimeagen should appear under "Start new"
    const startNewSection = screen.getByTestId('available-section')
    expect(within(startNewSection).getByText('Theo Browne')).toBeInTheDocument()
    expect(within(startNewSection).getByText('ThePrimeagen')).toBeInTheDocument()
  })

  // ── Orphaned conversation hiding ─────────────────────────────────────────

  it('hides orphaned conversations (persona not in list)', () => {
    // Store data for persona id=99 which is not in the personas list
    storePersonaChat(99, {
      version: 2,
      entries: [makeMessage('Who are you?', 'I am a ghost persona.', 1000000)],
    })
    renderHub()
    // The orphaned conversation should not appear
    expect(screen.queryByText(/ghost persona/)).not.toBeInTheDocument()
    // And no extra cards should appear beyond the 3 available personas
    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
  })

  // ── Sorting by recency ───────────────────────────────────────────────────

  it('sorts recent conversations by timestamp descending (newest first)', () => {
    // persona2 has newer message
    storePersonaChat(1, {
      version: 2,
      entries: [makeMessage('First question', 'First answer', 1000000)],
    })
    storePersonaChat(2, {
      version: 2,
      entries: [makeMessage('Second question', 'Second answer', 3000000)],
    })

    renderHub()

    const recentSection = screen.getByTestId('recent-section')
    const buttons = within(recentSection).getAllByRole('button')
    // Theo Browne (ts=3000000) should come before Fireship (ts=1000000)
    const names = buttons.map((b) => b.textContent ?? '')
    const fireshpIdx = names.findIndex((n) => n.includes('Fireship'))
    const theoIdx = names.findIndex((n) => n.includes('Theo Browne'))
    expect(theoIdx).toBeLessThan(fireshpIdx)
  })

  // ── Header ────────────────────────────────────────────────────────────────

  it('renders "Chats" title in header', () => {
    renderHub()
    expect(screen.getByText('Chats')).toBeInTheDocument()
  })

  // ── Persona initial avatar ───────────────────────────────────────────────

  it('renders persona initial in avatar', () => {
    renderHub()
    // 'F' for Fireship, 'T' for Theo Browne x2 (could be ambiguous — just check F)
    const avatars = screen.getAllByText('F')
    expect(avatars.length).toBeGreaterThan(0)
  })
})
