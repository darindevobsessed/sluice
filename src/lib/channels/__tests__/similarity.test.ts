/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computeChannelCentroid, findSimilarChannels } from '../similarity'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '@/lib/db/schema'

/**
 * Creates a mock db that supports fluent chaining for all Drizzle query
 * patterns used by the similarity module:
 *   select().from()                       (channels list)
 *   select().from().innerJoin().where()   (computeChannelCentroid)
 *   select().from().where().limit()       (sample titles)
 *   selectDistinct().from()               (all channel names from videos)
 *   selectDistinct().from().innerJoin().where()  (video count)
 */
const createFluentMock = () => {
  // Each call to select/selectDistinct pushes a resolver here;
  // the final method (where/from/limit that resolves) pops and uses it.
  const resolvers: Array<() => Promise<any>> = []

  const makeChain = (): any => {
    const chain: any = {}
    const fluent = (name: string) => {
      chain[name] = vi.fn((..._args: any[]) => chain)
      return chain
    }
    // All possible chain methods - they all return the chain
    fluent('from')
    fluent('innerJoin')
    fluent('leftJoin')
    fluent('where')
    fluent('orderBy')

    // Terminal methods that resolve
    chain.limit = vi.fn(async () => {
      const resolver = resolvers.shift()
      return resolver ? resolver() : []
    })

    // Make where also work as terminal (some queries end at where)
    const origWhere = chain.where
    chain.where = vi.fn((...args: any[]) => {
      // Return chain but also store the original for terminal use
      origWhere(...args)
      return chain
    })

    // Override from to also work as terminal when it's the last call
    chain.from = vi.fn((..._args: any[]) => chain)

    return chain
  }

  // Override the chain so that await on the chain itself resolves
  const makeTerminalChain = (): any => {
    const chain = makeChain()
    // Make the chain itself thenable so `await db.select().from()` works
    // This is needed for queries that don't end with limit/where
    chain.then = (resolve: any, reject: any) => {
      const resolver = resolvers.shift()
      const promise = resolver ? resolver() : Promise.resolve([])
      return promise.then(resolve, reject)
    }
    return chain
  }

  const db = {
    select: vi.fn(() => makeTerminalChain()),
    selectDistinct: vi.fn(() => makeTerminalChain()),
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  }

  return { db, resolvers }
}

type MockDb = ReturnType<typeof createFluentMock>['db']

describe('computeChannelCentroid', () => {
  let db: MockDb
  let resolvers: Array<() => Promise<any>>

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createFluentMock()
    db = mock.db
    resolvers = mock.resolvers
  })

  it('computes average embedding vector for a channel', async () => {
    const embedding1 = new Array(384).fill(0.5)
    const embedding2 = new Array(384).fill(0.7)

    // computeChannelCentroid: select().from().innerJoin().where() -> resolves via chain.then
    resolvers.push(async () => [
      { embedding: embedding1 },
      { embedding: embedding2 },
    ])

    const centroid = await computeChannelCentroid(
      'Test Channel',
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(centroid).not.toBeNull()
    expect(centroid!.length).toBe(384)
    expect(centroid![0]).toBeCloseTo(0.6, 5)
  })

  it('computes centroid across multiple videos from same channel', async () => {
    const embedding = new Array(384).fill(0.8)

    resolvers.push(async () => [
      { embedding: [...embedding] },
      { embedding: [...embedding] },
    ])

    const centroid = await computeChannelCentroid(
      'Multi Video Channel',
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(centroid).not.toBeNull()
    expect(centroid!.length).toBe(384)
    expect(centroid![0]).toBeCloseTo(0.8, 5)
  })

  it('returns null for channel with no videos', async () => {
    resolvers.push(async () => [])

    const centroid = await computeChannelCentroid(
      'Nonexistent Channel',
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(centroid).toBeNull()
  })

  it('returns null for channel with no embeddings', async () => {
    resolvers.push(async () => [])

    const centroid = await computeChannelCentroid(
      'No Embeddings Channel',
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(centroid).toBeNull()
  })

  it('handles chunks with null embeddings', async () => {
    // SQL WHERE filters out null embeddings; only non-null returned
    resolvers.push(async () => [
      { embedding: new Array(384).fill(0.5) },
    ])

    const centroid = await computeChannelCentroid(
      'Partial Embeddings Channel',
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(centroid).toBeDefined()
    expect(centroid!.length).toBe(384)
    expect(centroid![0]).toBeCloseTo(0.5, 5)
  })
})

describe('findSimilarChannels', () => {
  let db: MockDb
  let resolvers: Array<() => Promise<any>>

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = createFluentMock()
    db = mock.db
    resolvers = mock.resolvers
  })

  it('returns empty array when no followed channels', async () => {
    const result = await findSimilarChannels(
      [],
      undefined,
      db as unknown as NodePgDatabase<typeof schema>,
    )
    expect(result).toEqual([])
  })

  it('returns empty array when followed channel has no embeddings', async () => {
    // 1. select channels table -> followed channel records
    resolvers.push(async () => [{ name: 'Followed Channel' }])
    // 2. computeChannelCentroid -> no embeddings
    resolvers.push(async () => [])

    const result = await findSimilarChannels(
      ['Followed Channel'],
      undefined,
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(result).toEqual([])
  })

  it('finds similar channels based on content similarity', async () => {
    const followedEmbedding = new Array(384).fill(0.9)
    const similarEmbedding = new Array(384).fill(0.85)

    // 1. select channels -> followed channel records
    resolvers.push(async () => [{ name: 'Followed Channel' }])
    // 2. computeChannelCentroid for 'Followed Channel'
    resolvers.push(async () => [{ embedding: followedEmbedding }])
    // 3. selectDistinct: all channel names from videos
    resolvers.push(async () => [{ channel: 'Similar Channel' }])
    // 4. selectDistinct: videoCount for 'Similar Channel' (3 distinct videos)
    resolvers.push(async () => [{ videoId: 1 }, { videoId: 2 }, { videoId: 3 }])
    // 5. computeChannelCentroid for 'Similar Channel'
    resolvers.push(async () => [{ embedding: similarEmbedding }])
    // 6. sample titles (select().from().where().limit())
    resolvers.push(async () => [{ title: 'Similar Video 0' }, { title: 'Similar Video 1' }])

    const similar = await findSimilarChannels(
      ['Followed Channel'],
      undefined,
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(similar.length).toBeGreaterThan(0)
    expect(similar[0]!.channelName).toBe('Similar Channel')
    expect(similar[0]!.similarity).toBeGreaterThan(0.6)
    expect(similar[0]!.videoCount).toBe(3)
    expect(similar[0]!.sampleTitles.length).toBeGreaterThan(0)
  })

  it('filters out already-followed channels', async () => {
    const embedding = new Array(384).fill(0.9)

    // 1. select channels -> both followed channels in channels table
    resolvers.push(async () => [
      { name: 'Followed Channel 1' },
      { name: 'Followed Channel 2' },
    ])
    // 2. computeChannelCentroid for 'Followed Channel 1'
    resolvers.push(async () => [{ embedding }])
    // 3. selectDistinct from videos -> only Followed Channel 2 as candidate
    resolvers.push(async () => [{ channel: 'Followed Channel 2' }])
    // Followed Channel 2 is in followedChannelNames (from channels table), so it's filtered out

    const similar = await findSimilarChannels(
      ['Followed Channel 1'],
      undefined,
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(similar.find(c => c.channelName === 'Followed Channel 2')).toBeUndefined()
  })

  it('excludes channels with fewer than 3 embedded videos', async () => {
    const embedding = new Array(384).fill(0.9)

    // 1. select channels -> followed
    resolvers.push(async () => [{ name: 'Followed Channel' }])
    // 2. computeChannelCentroid for followed
    resolvers.push(async () => [{ embedding }])
    // 3. selectDistinct: candidate channels
    resolvers.push(async () => [{ channel: 'Few Videos Channel' }])
    // 4. selectDistinct: videoCount for candidate -> only 2
    resolvers.push(async () => [{ videoId: 1 }, { videoId: 2 }])
    // Skipped (< 3 videos)

    const similar = await findSimilarChannels(
      ['Followed Channel'],
      undefined,
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(similar.find(c => c.channelName === 'Few Videos Channel')).toBeUndefined()
  })

  it('respects custom threshold', async () => {
    const followedEmbedding = new Array(384).fill(0.9)
    const candidateEmbedding = new Array(384).fill(0.85)

    // Setup for low threshold test
    resolvers.push(async () => [{ name: 'Followed Channel' }])
    resolvers.push(async () => [{ embedding: followedEmbedding }])
    resolvers.push(async () => [{ channel: 'Candidate Channel' }])
    resolvers.push(async () => [{ videoId: 1 }, { videoId: 2 }, { videoId: 3 }])
    resolvers.push(async () => [{ embedding: candidateEmbedding }])
    resolvers.push(async () => [{ title: 'Sample' }])

    // With low threshold 0.5, should appear
    const similarLow = await findSimilarChannels(
      ['Followed Channel'],
      { threshold: 0.5 },
      db as unknown as NodePgDatabase<typeof schema>,
    )
    expect(similarLow.find(c => c.channelName === 'Candidate Channel')).toBeDefined()

    // Setup for high threshold test
    resolvers.push(async () => [{ name: 'Followed Channel' }])
    resolvers.push(async () => [{ embedding: followedEmbedding }])
    resolvers.push(async () => [{ channel: 'Candidate Channel' }])
    resolvers.push(async () => [{ videoId: 1 }, { videoId: 2 }, { videoId: 3 }])
    resolvers.push(async () => [{ embedding: candidateEmbedding }])

    // With threshold 1.0, should not appear
    const similarHigh = await findSimilarChannels(
      ['Followed Channel'],
      { threshold: 1.0 },
      db as unknown as NodePgDatabase<typeof schema>,
    )
    expect(similarHigh.find(c => c.channelName === 'Candidate Channel')).toBeUndefined()
  })

  it('respects custom limit', async () => {
    const embedding = new Array(384).fill(0.9)

    // 1. channels table
    resolvers.push(async () => [{ name: 'Followed Channel' }])
    // 2. computeChannelCentroid for followed
    resolvers.push(async () => [{ embedding }])
    // 3. all channel names
    resolvers.push(async () => [
      { channel: 'Channel 0' },
      { channel: 'Channel 1' },
      { channel: 'Channel 2' },
      { channel: 'Channel 3' },
      { channel: 'Channel 4' },
    ])

    // For each candidate: videoCount (3), centroid, titles
    for (let i = 0; i < 5; i++) {
      resolvers.push(async () => [{ videoId: i * 3 + 1 }, { videoId: i * 3 + 2 }, { videoId: i * 3 + 3 }])
      resolvers.push(async () => [{ embedding }])
      resolvers.push(async () => [{ title: `Video ${i}` }])
    }

    const similar = await findSimilarChannels(
      ['Followed Channel'],
      { limit: 2 },
      db as unknown as NodePgDatabase<typeof schema>,
    )
    expect(similar.length).toBeLessThanOrEqual(2)
  })

  it('returns empty array when no similar channels found', async () => {
    const embedding = new Array(384).fill(0.9)

    resolvers.push(async () => [{ name: 'Followed Channel' }])
    resolvers.push(async () => [{ embedding }])
    // No other channels
    resolvers.push(async () => [])

    const similar = await findSimilarChannels(
      ['Followed Channel'],
      undefined,
      db as unknown as NodePgDatabase<typeof schema>,
    )

    expect(similar).toEqual([])
  })
})
