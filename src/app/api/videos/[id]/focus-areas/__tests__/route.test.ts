import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'

// Setup test database
const TEST_DATABASE_URL =
  process.env.DATABASE_URL?.replace(/\/goldminer$/, '/goldminer_test') ??
  'postgresql://goldminer:goldminer@localhost:5432/goldminer_test'

let pool: Pool
let testDb: ReturnType<typeof drizzle<typeof schema>>

// Mock the database module to use test database
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    get db() {
      return testDb
    },
  }
})

// Import after mocking
const { GET, POST, DELETE } = await import('../route')

describe('GET /api/videos/[id]/focus-areas', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE videos, focus_areas CASCADE')
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('returns empty array when video has no focus areas', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/focus-areas`)
    const response = await GET(request, { params: Promise.resolve({ id: String(video!.id) }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.focusAreas).toEqual([])
  })

  it('returns all focus areas for video', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const [reactArea] = await testDb.insert(schema.focusAreas).values({ name: 'React' }).returning()
    const [tsArea] = await testDb
      .insert(schema.focusAreas)
      .values({ name: 'TypeScript' })
      .returning()

    await testDb.insert(schema.videoFocusAreas).values([
      { videoId: video!.id, focusAreaId: reactArea!.id },
      { videoId: video!.id, focusAreaId: tsArea!.id },
    ])

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/focus-areas`)
    const response = await GET(request, { params: Promise.resolve({ id: String(video!.id) }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.focusAreas).toHaveLength(2)
    expect(data.focusAreas.map((fa: { name: string }) => fa.name).sort()).toEqual(['React', 'TypeScript'])
  })

  it('returns 404 when video does not exist', async () => {
    const request = new Request('http://localhost:3000/api/videos/99999/focus-areas')
    const response = await GET(request, { params: Promise.resolve({ id: '99999' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })
})

describe('POST /api/videos/[id]/focus-areas', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE videos, focus_areas CASCADE')
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('assigns focus area to video', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const [focusArea] = await testDb.insert(schema.focusAreas).values({ name: 'React' }).returning()

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/focus-areas`, {
      method: 'POST',
      body: JSON.stringify({ focusAreaId: focusArea!.id }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: String(video!.id) }) })

    expect(response.status).toBe(201)

    // Verify assignment
    const junctions = await testDb.select().from(schema.videoFocusAreas)
    expect(junctions).toHaveLength(1)
    expect(junctions[0]!.videoId).toBe(video!.id)
    expect(junctions[0]!.focusAreaId).toBe(focusArea!.id)
  })

  it('returns 400 when focusAreaId is missing', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/focus-areas`, {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request, { params: Promise.resolve({ id: String(video!.id) }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })

  it('returns 404 when video does not exist', async () => {

    const [focusArea] = await testDb.insert(schema.focusAreas).values({ name: 'React' }).returning()

    const request = new Request('http://localhost:3000/api/videos/99999/focus-areas', {
      method: 'POST',
      body: JSON.stringify({ focusAreaId: focusArea!.id }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: '99999' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Video not found')
  })

  it('returns 404 when focus area does not exist', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/focus-areas`, {
      method: 'POST',
      body: JSON.stringify({ focusAreaId: 99999 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: String(video!.id) }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Focus area not found')
  })

  it('returns 409 when assignment already exists', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const [focusArea] = await testDb.insert(schema.focusAreas).values({ name: 'React' }).returning()

    // Create existing assignment
    await testDb.insert(schema.videoFocusAreas).values({
      videoId: video!.id,
      focusAreaId: focusArea!.id,
    })

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/focus-areas`, {
      method: 'POST',
      body: JSON.stringify({ focusAreaId: focusArea!.id }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: String(video!.id) }) })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('already assigned')
  })
})

describe('DELETE /api/videos/[id]/focus-areas', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DATABASE_URL })
    testDb = drizzle(pool, { schema })
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE videos, focus_areas CASCADE')
  })

  afterAll(async () => {
    await pool?.end()
  })

  it('removes focus area from video', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const [focusArea] = await testDb.insert(schema.focusAreas).values({ name: 'React' }).returning()

    await testDb.insert(schema.videoFocusAreas).values({
      videoId: video!.id,
      focusAreaId: focusArea!.id,
    })

    const request = new Request(
      `http://localhost:3000/api/videos/${video!.id}/focus-areas?focusAreaId=${focusArea!.id}`,
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, { params: Promise.resolve({ id: String(video!.id) }) })

    expect(response.status).toBe(204)

    // Verify deletion
    const junctions = await testDb.select().from(schema.videoFocusAreas)
    expect(junctions).toHaveLength(0)
  })

  it('returns 400 when focusAreaId is missing', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const request = new Request(`http://localhost:3000/api/videos/${video!.id}/focus-areas`, {
      method: 'DELETE',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: String(video!.id) }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('focusAreaId')
  })

  it('returns 404 when video does not exist', async () => {
    const request = new Request(
      'http://localhost:3000/api/videos/99999/focus-areas?focusAreaId=1',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, { params: Promise.resolve({ id: '99999' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('Video not found')
  })

  it('returns 404 when assignment does not exist', async () => {

    const [video] = await testDb
      .insert(schema.videos)
      .values({
        youtubeId: 'test-123',
        title: 'Test Video',
        channel: 'Test Channel',
        transcript: 'Test transcript',
      })
      .returning()

    const [focusArea] = await testDb.insert(schema.focusAreas).values({ name: 'React' }).returning()

    const request = new Request(
      `http://localhost:3000/api/videos/${video!.id}/focus-areas?focusAreaId=${focusArea!.id}`,
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request, { params: Promise.resolve({ id: String(video!.id) }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not assigned')
  })
})
