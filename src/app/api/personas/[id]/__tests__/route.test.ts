import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DELETE } from '../route'
import { db } from '@/lib/db'

vi.mock('@/lib/auth-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-guards')>()
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(null),
  }
})

// Mock dependencies
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual('@/lib/db')
  return {
    ...actual,
    db: {
      delete: vi.fn(),
    },
  }
})

const mockDb = vi.mocked(db)

describe('DELETE /api/personas/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deletes a persona by id', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            channelName: 'Test Creator',
            name: 'Test Creator',
            systemPrompt: 'You are Test Creator...',
            expertiseTopics: ['React'],
            expertiseEmbedding: new Array(384).fill(0.5),
            transcriptCount: 50,
            createdAt: new Date(),
          },
        ]),
      }),
    } as never)

    const request = new Request('http://localhost:3000/api/personas/1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      success: true,
    })
    expect(mockDb.delete).toHaveBeenCalled()
  })

  it('returns 404 when persona not found', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const request = new Request('http://localhost:3000/api/personas/999', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: '999' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toEqual({ error: 'Persona not found' })
  })

  it('returns 400 when id is not a number', async () => {
    const request = new Request('http://localhost:3000/api/personas/abc', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: 'abc' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({ error: 'Invalid persona ID' })
    expect(mockDb.delete).not.toHaveBeenCalled()
  })

  it('returns 500 on database error', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error('Database error')),
      }),
    } as never)

    const request = new Request('http://localhost:3000/api/personas/1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to delete persona' })
  })
})
