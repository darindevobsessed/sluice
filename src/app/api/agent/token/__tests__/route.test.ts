/**
 * Tests for agent token API route
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '../route'
import fs from 'fs'
import path from 'path'

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
}))

describe('GET /api/agent/token', () => {
  const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>
  const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns token when file exists and is valid', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('abc-123-xyz')

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      token: 'abc-123-xyz',
      available: true
    })
  })

  it('trims whitespace from token', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('  abc-123-xyz  \n')

    const response = await GET()
    const data = await response.json()

    expect(data.token).toBe('abc-123-xyz')
  })

  it('returns 503 when file does not exist', async () => {
    mockExistsSync.mockReturnValue(false)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      error: 'Agent not running',
      available: false
    })
  })

  it('returns 503 when token file is empty', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('')

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      error: 'Token file is empty',
      available: false
    })
  })

  it('returns 503 when token file is only whitespace', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('   \n  \t  ')

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      error: 'Token file is empty',
      available: false
    })
  })

  it('returns 503 when file read fails', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => {
      throw new Error('Permission denied')
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data).toEqual({
      error: 'Failed to read token: Permission denied',
      available: false
    })
  })

  it('reads from correct file path', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('abc-123-xyz')

    await GET()

    const expectedPath = path.join(process.cwd(), '.agent-token')
    expect(mockExistsSync).toHaveBeenCalledWith(expectedPath)
    expect(mockReadFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8')
  })

  it('handles non-Error exceptions', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => {
      throw 'String error'
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toBe('Failed to read token: Unknown error')
  })
})
