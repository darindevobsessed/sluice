import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('env validation', () => {
  let originalEnv: NodeJS.ProcessEnv
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Store original env
    originalEnv = { ...process.env }
    // Spy on console.warn
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Clear module cache to force re-evaluation
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original env
    process.env = originalEnv
    // Restore console.warn
    consoleWarnSpy.mockRestore()
  })

  it('throws error when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL

    await expect(async () => {
      await import('../env')
    }).rejects.toThrow('DATABASE_URL environment variable is required')
  })

  it('warns when AI_GATEWAY_KEY is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://test'
    delete process.env.AI_GATEWAY_KEY

    await import('../env')

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Warning: AI_GATEWAY_KEY not set. AI features will not work.'
    )
  })

  it('bridges AI_GATEWAY_KEY to ANTHROPIC_API_KEY for SDK compatibility', async () => {
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.AI_GATEWAY_KEY = 'test-gateway-key'
    delete process.env.ANTHROPIC_API_KEY

    await import('../env')

    expect(process.env.ANTHROPIC_API_KEY).toBe('test-gateway-key')
  })

  it('warns when CRON_SECRET is missing', async () => {
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.AI_GATEWAY_KEY = 'test-key'
    delete process.env.CRON_SECRET

    await import('../env')

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Warning: CRON_SECRET not set. Cron endpoints will not be secured.'
    )
  })

  it('does not warn when all required and optional env vars are set', async () => {
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.AI_GATEWAY_KEY = 'test-key'
    process.env.CRON_SECRET = 'test-secret'
    process.env.BETTER_AUTH_SECRET = 'test-auth-secret'

    await import('../env')

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('does not validate NEXT_PUBLIC_AGENT_PORT', async () => {
    process.env.DATABASE_URL = 'postgresql://test'
    delete process.env.NEXT_PUBLIC_AGENT_PORT

    await import('../env')

    // Should not throw or warn about this optional var
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('NEXT_PUBLIC_AGENT_PORT')
    )
  })
})
