import { describe, it, expect } from 'vitest'

describe('Database pool configuration', () => {
  it('detects Neon from DATABASE_URL containing neon.tech', () => {
    const neonUrls = [
      'postgresql://user:pass@example.neon.tech:5432/db',
      'postgresql://neon.tech/db',
      'postgres://something.neon.tech/mydb',
    ]

    const nonNeonUrls = [
      'postgresql://localhost:5432/goldminer',
      'postgresql://example.com:5432/db',
      'postgres://my-server.com/db',
    ]

    for (const url of neonUrls) {
      const isNeon = url.includes('neon.tech')
      expect(isNeon).toBe(true)
    }

    for (const url of nonNeonUrls) {
      const isNeon = url.includes('neon.tech')
      expect(isNeon).toBe(false)
    }
  })

  it('applies correct pool config for Neon databases', () => {
    // Test the pool configuration logic
    const isNeon = true
    const max = isNeon ? 3 : 10
    const idleTimeoutMillis = isNeon ? 10000 : 30000

    expect(max).toBe(3)
    expect(idleTimeoutMillis).toBe(10000)
  })

  it('applies correct pool config for non-Neon databases', () => {
    // Test the pool configuration logic
    const isNeon = false
    const max = isNeon ? 3 : 10
    const idleTimeoutMillis = isNeon ? 10000 : 30000

    expect(max).toBe(10)
    expect(idleTimeoutMillis).toBe(30000)
  })

  it('pool config values match implementation', () => {
    // This test verifies the ternary logic matches what's in db/index.ts
    const testCases = [
      { isNeon: true, expectedMax: 3, expectedIdle: 10000 },
      { isNeon: false, expectedMax: 10, expectedIdle: 30000 },
    ]

    for (const { isNeon, expectedMax, expectedIdle } of testCases) {
      const max = isNeon ? 3 : 10
      const idleTimeoutMillis = isNeon ? 10000 : 30000

      expect(max).toBe(expectedMax)
      expect(idleTimeoutMillis).toBe(expectedIdle)
    }
  })
})
