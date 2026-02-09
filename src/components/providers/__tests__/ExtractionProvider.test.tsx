import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ExtractionProvider, useExtractionStore } from '../ExtractionProvider'
import { AgentProvider } from '@/lib/agent/AgentProvider'
import type { AgentConnection } from '@/lib/agent/connection'

interface InsightCallbacks {
  onStart?: () => void
  onText?: (text: string) => void
  onDone?: (fullContent: string) => void
  onError?: (error: string) => void
  onCancel?: () => void
}

// Mock AgentProvider
vi.mock('@/lib/agent/AgentProvider', () => ({
  AgentProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAgent: () => ({
    agent: mockAgent,
    status: 'connected' as const,
    error: null,
  }),
}))

// Mock fetch
global.fetch = vi.fn()

const mockAgent: Partial<AgentConnection> = {
  generateInsight: vi.fn(),
  cancelInsight: vi.fn(),
}

function TestConsumer() {
  const { startExtraction, cancelExtraction, getState } = useExtractionStore()

  return (
    <div>
      <button onClick={() => startExtraction(1, { title: 'Test', channel: 'Test Channel', transcript: 'Test transcript' })}>
        Start
      </button>
      <button onClick={() => cancelExtraction(1)}>Cancel</button>
      <div data-testid="state">{JSON.stringify(getState(1) || null)}</div>
    </div>
  )
}

describe('ExtractionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockAgent.generateInsight as ReturnType<typeof vi.fn>)?.mockReturnValue('insight-123')
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('throws error when useExtractionStore is used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestConsumer />)
    }).toThrow('useExtractionStore must be used within an ExtractionProvider')

    consoleError.mockRestore()
  })

  it('provides context when inside provider', () => {
    render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    expect(screen.getByTestId('state')).toHaveTextContent('null')
  })

  it('updates store when startExtraction is called', async () => {
    const { getByText } = render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    const startButton = getByText('Start')
    startButton.click()

    await waitFor(() => {
      const stateEl = screen.getByTestId('state')
      const state = JSON.parse(stateEl.textContent || 'null')
      expect(state).not.toBeNull()
      expect(state.overall).toBe('extracting')
    })

    expect(mockAgent.generateInsight).toHaveBeenCalledWith(
      expect.objectContaining({
        insightType: 'extraction',
        prompt: expect.stringContaining('Test'),
        systemPrompt: expect.any(String),
      }),
      expect.objectContaining({
        onStart: expect.any(Function),
        onText: expect.any(Function),
        onDone: expect.any(Function),
        onError: expect.any(Function),
        onCancel: expect.any(Function),
      })
    )
  })

  it('does not start duplicate extraction for same videoId', async () => {
    const { getByText } = render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    const startButton = getByText('Start')
    startButton.click()
    startButton.click()

    await waitFor(() => {
      expect(mockAgent.generateInsight).toHaveBeenCalledTimes(1)
    })
  })

  it('calls cancelInsight and resets state when cancelExtraction is called', async () => {
    const { getByText } = render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    const startButton = getByText('Start')
    startButton.click()

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent || 'null')
      expect(state?.overall).toBe('extracting')
    })

    const cancelButton = getByText('Cancel')
    cancelButton.click()

    expect(mockAgent.cancelInsight).toHaveBeenCalledWith('insight-123')
  })

  it('accumulates text and updates partial state on onText callback', async () => {
    let capturedCallbacks: InsightCallbacks | undefined

    ;(mockAgent.generateInsight as ReturnType<typeof vi.fn>)?.mockImplementation((options, callbacks) => {
      capturedCallbacks = callbacks
      return 'insight-123'
    })

    const { getByText } = render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    const startButton = getByText('Start')
    startButton.click()

    await waitFor(() => {
      expect(capturedCallbacks).toBeDefined()
    })

    // Simulate streaming JSON
    capturedCallbacks?.onText?.('{"contentType": "dev"')
    capturedCallbacks?.onText?.(', "summary": {"tldr": "Test"')

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent || 'null')
      expect(state.partial.contentType).toBe('dev')
    })
  })

  it('persists to DB and evicts from store on successful onDone', async () => {
    let capturedCallbacks: InsightCallbacks | undefined

    ;(mockAgent.generateInsight as ReturnType<typeof vi.fn>)?.mockImplementation((options, callbacks) => {
      capturedCallbacks = callbacks
      return 'insight-123'
    })

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })

    const { getByText } = render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    const startButton = getByText('Start')
    startButton.click()

    await waitFor(() => {
      expect(capturedCallbacks).toBeDefined()
    })

    // Complete extraction
    const completeJSON = JSON.stringify({
      contentType: 'dev',
      summary: { tldr: 'Test', overview: 'Test overview', keyPoints: ['Point 1'] },
      insights: [{ title: 'Insight 1', timestamp: '00:00', explanation: 'Test', actionable: 'Do this' }],
      actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
      claudeCode: { applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] },
    })

    capturedCallbacks?.onDone?.(completeJSON)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/videos/1/insights',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('contentType'),
        })
      )
    })

    // State should be evicted after successful persist
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent || 'null')
      expect(state).toBeNull()
    })
  })

  it('handles error callback by setting error state', async () => {
    let capturedCallbacks: InsightCallbacks | undefined

    ;(mockAgent.generateInsight as ReturnType<typeof vi.fn>)?.mockImplementation((options, callbacks) => {
      capturedCallbacks = callbacks
      return 'insight-123'
    })

    const { getByText } = render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    const startButton = getByText('Start')
    startButton.click()

    await waitFor(() => {
      expect(capturedCallbacks).toBeDefined()
    })

    capturedCallbacks?.onError?.('Test error')

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent || 'null')
      expect(state.overall).toBe('error')
      expect(state.error).toBe('Test error')
    })
  })

  it('tracks knowledgePrompt section status during streaming', async () => {
    let capturedCallbacks: InsightCallbacks | undefined

    ;(mockAgent.generateInsight as ReturnType<typeof vi.fn>)?.mockImplementation((options, callbacks) => {
      capturedCallbacks = callbacks
      return 'insight-123'
    })

    const { getByText } = render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    const startButton = getByText('Start')
    startButton.click()

    await waitFor(() => {
      expect(capturedCallbacks).toBeDefined()
    })

    // Initially all sections are pending
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent || 'null')
      expect(state.sections.knowledgePrompt).toBe('pending')
    })

    // After claudeCode is done, knowledgePrompt should be working
    capturedCallbacks?.onText?.(JSON.stringify({
      contentType: 'dev',
      summary: { tldr: 'Test', overview: 'Test', keyPoints: [] },
      insights: [],
      actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
      claudeCode: { applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] },
    }))

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent || 'null')
      expect(state.sections.claudeCode).toBe('done')
      expect(state.sections.knowledgePrompt).toBe('working')
    })

    // After knowledgePrompt is present, section should be done
    capturedCallbacks?.onText?.(', "knowledgePrompt": "Test knowledge prompt"')

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent || 'null')
      expect(state.sections.knowledgePrompt).toBe('done')
      expect(state.partial.knowledgePrompt).toBe('Test knowledge prompt')
    })
  })

  it('includes knowledgePrompt in completeness check', async () => {
    let capturedCallbacks: InsightCallbacks | undefined

    ;(mockAgent.generateInsight as ReturnType<typeof vi.fn>)?.mockImplementation((options, callbacks) => {
      capturedCallbacks = callbacks
      return 'insight-123'
    })

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })

    const { getByText } = render(
      <AgentProvider>
        <ExtractionProvider>
          <TestConsumer />
        </ExtractionProvider>
      </AgentProvider>
    )

    const startButton = getByText('Start')
    startButton.click()

    await waitFor(() => {
      expect(capturedCallbacks).toBeDefined()
    })

    // Complete extraction with knowledgePrompt
    const completeJSON = JSON.stringify({
      contentType: 'dev',
      summary: { tldr: 'Test', overview: 'Test overview', keyPoints: ['Point 1'] },
      insights: [{ title: 'Insight 1', timestamp: '00:00', explanation: 'Test', actionable: 'Do this' }],
      actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
      knowledgePrompt: 'Knowledge prompt content',
      claudeCode: { applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] },
    })

    capturedCallbacks?.onDone?.(completeJSON)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/videos/1/insights',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('knowledgePrompt'),
        })
      )
    })

    // State should be evicted after successful persist
    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('state').textContent || 'null')
      expect(state).toBeNull()
    })
  })
})
