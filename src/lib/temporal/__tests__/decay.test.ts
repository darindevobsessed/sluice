import { describe, it, expect } from 'vitest'
import { calculateTemporalDecay } from '../decay'

describe('calculateTemporalDecay', () => {
  describe('exponential decay with default half-life (365 days)', () => {
    it('returns 1.0 for brand new content (0 days old)', () => {
      const now = new Date()
      const decay = calculateTemporalDecay(now)

      expect(decay).toBeCloseTo(1.0, 2)
    })

    it('returns ~0.71 for 6-month-old content (182.5 days)', () => {
      const sixMonthsAgo = new Date(Date.now() - 182.5 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(sixMonthsAgo)

      // At half of half-life, decay should be ~0.71 (sqrt(0.5))
      expect(decay).toBeCloseTo(0.71, 2)
    })

    it('returns 0.5 for 1-year-old content (365 days)', () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(oneYearAgo)

      expect(decay).toBeCloseTo(0.5, 2)
    })

    it('returns 0.25 for 2-year-old content (730 days)', () => {
      const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(twoYearsAgo)

      expect(decay).toBeCloseTo(0.25, 2)
    })

    it('returns ~0.125 for 3-year-old content (1095 days)', () => {
      const threeYearsAgo = new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(threeYearsAgo)

      expect(decay).toBeCloseTo(0.125, 2)
    })
  })

  describe('custom half-life', () => {
    it('respects custom half-life of 180 days', () => {
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(sixMonthsAgo, 180)

      // Should be close to 0.5 since we're near the half-life
      expect(decay).toBeCloseTo(0.5, 1)
    })

    it('respects custom half-life of 90 days', () => {
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(threeMonthsAgo, 90)

      expect(decay).toBeCloseTo(0.5, 1)
    })

    it('respects custom half-life of 730 days (2 years)', () => {
      const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(twoYearsAgo, 730)

      expect(decay).toBeCloseTo(0.5, 2)
    })
  })

  describe('edge cases', () => {
    it('returns 1.0 when publishedAt is null', () => {
      const decay = calculateTemporalDecay(null)

      expect(decay).toBe(1.0)
    })

    it('returns 1.0 when publishedAt is undefined', () => {
      const decay = calculateTemporalDecay(undefined as any)

      expect(decay).toBe(1.0)
    })

    it('handles future dates (returns >= 1.0)', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(tomorrow)

      // Future content should not have decay applied
      expect(decay).toBeGreaterThanOrEqual(0.99)
    })

    it('handles very old content (10 years)', () => {
      const tenYearsAgo = new Date(Date.now() - 3650 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(tenYearsAgo)

      // 10 half-lives = 2^10 = 1024x decay, so ~0.001
      expect(decay).toBeLessThan(0.01)
      expect(decay).toBeGreaterThan(0)
    })

    it('returns positive decay even for ancient content', () => {
      const ancientDate = new Date('2000-01-01')
      const decay = calculateTemporalDecay(ancientDate)

      expect(decay).toBeGreaterThan(0)
      expect(decay).toBeLessThan(1)
    })
  })

  describe('lambda calculation', () => {
    it('calculates correct lambda from half-life', () => {
      // Lambda should be ln(2) / half-life
      // For 365 days: lambda ≈ 0.693147 / 365 ≈ 0.0019

      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      const decay = calculateTemporalDecay(oneYearAgo, 365)

      // This verifies the internal lambda calculation is correct
      // Because we should get exactly 0.5 at the half-life point
      expect(decay).toBeCloseTo(0.5, 3)
    })
  })

  describe('monotonic decay property', () => {
    it('decay decreases as content gets older', () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

      const decayWeek = calculateTemporalDecay(oneWeekAgo)
      const decayMonth = calculateTemporalDecay(oneMonthAgo)
      const decayYear = calculateTemporalDecay(oneYearAgo)

      expect(decayWeek).toBeGreaterThan(decayMonth)
      expect(decayMonth).toBeGreaterThan(decayYear)
    })
  })
})
