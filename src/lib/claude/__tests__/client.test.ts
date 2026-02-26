import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Track constructor calls
const constructorSpy = vi.fn()

// Mock Anthropic SDK before importing client
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      constructor(opts: { apiKey?: string }) {
        constructorSpy(opts)
      }
      messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'mock response' }],
        }),
        stream: vi.fn().mockReturnValue({
          on: vi.fn().mockReturnThis(),
          finalMessage: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'mock response' }],
          }),
        }),
      }
    },
  }
})

describe('client API key trimming', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.resetModules()
    constructorSpy.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('trims trailing newline from API key when creating Anthropic client', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key\n'

    const { generateText } = await import('../client')
    await generateText('test prompt')

    expect(constructorSpy).toHaveBeenCalledWith({ apiKey: 'sk-ant-test-key' })
  })

  it('trims spaces and newlines from AI_GATEWAY_KEY fallback', async () => {
    delete process.env.ANTHROPIC_API_KEY
    process.env.AI_GATEWAY_KEY = '  sk-ant-gateway-key  \r\n'

    const { generateText } = await import('../client')
    await generateText('test prompt')

    expect(constructorSpy).toHaveBeenCalledWith({ apiKey: 'sk-ant-gateway-key' })
  })

  it('passes clean key through unchanged', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-clean-key'

    const { generateText } = await import('../client')
    await generateText('test prompt')

    expect(constructorSpy).toHaveBeenCalledWith({ apiKey: 'sk-ant-clean-key' })
  })
})
