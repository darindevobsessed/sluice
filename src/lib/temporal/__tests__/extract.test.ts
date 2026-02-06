import { describe, it, expect } from 'vitest'
import { extractTemporalMetadata } from '../extract'

describe('extractTemporalMetadata', () => {
  describe('version extraction', () => {
    it('extracts semantic version numbers', () => {
      const content = 'We released v2.0 and then updated to v2.0.1'
      const result = extractTemporalMetadata(content)

      expect(result.versions).toContain('2.0')
      expect(result.versions).toContain('2.0.1')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('extracts versions without v prefix', () => {
      const content = 'Updated to 3.2.1 from 3.2.0'
      const result = extractTemporalMetadata(content)

      expect(result.versions).toContain('3.2.1')
      expect(result.versions).toContain('3.2.0')
    })

    it('extracts version keyword patterns', () => {
      const content = 'version 4.0 was released, then ver. 4.1'
      const result = extractTemporalMetadata(content)

      expect(result.versions).toContain('4.0')
      expect(result.versions).toContain('4.1')
    })

    it('extracts technology version patterns', () => {
      const content = 'Using React 18 and Node 20.5'
      const result = extractTemporalMetadata(content)

      expect(result.versions).toContain('React 18')
      expect(result.versions).toContain('Node 20.5')
    })

    it('avoids false positives from scores', () => {
      const content = 'I give this 10/10 and rate it 8.5/10'
      const result = extractTemporalMetadata(content)

      // Should not extract scores as versions
      expect(result.versions.filter(v => v.includes('10/10'))).toHaveLength(0)
      expect(result.versions.filter(v => v.includes('8.5/10'))).toHaveLength(0)
    })

    it('handles content with no versions', () => {
      const content = 'This is just regular text without any version numbers'
      const result = extractTemporalMetadata(content)

      expect(result.versions).toHaveLength(0)
    })
  })

  describe('date extraction', () => {
    it('extracts release year mentions', () => {
      const content = 'Released in 2024 and updated in 2025'
      const result = extractTemporalMetadata(content)

      expect(result.dates).toContain('2024')
      expect(result.dates).toContain('2025')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('extracts month and year patterns', () => {
      const content = 'Announced January 2024 and shipped February 2024'
      const result = extractTemporalMetadata(content)

      expect(result.dates.some(d => d.includes('January') && d.includes('2024'))).toBe(true)
      expect(result.dates.some(d => d.includes('February') && d.includes('2024'))).toBe(true)
    })

    it('extracts year prefix patterns', () => {
      const content = '2024 release brought new features, 2025 update coming'
      const result = extractTemporalMetadata(content)

      expect(result.dates).toContain('2024')
      expect(result.dates).toContain('2025')
    })

    it('handles content with no dates', () => {
      const content = 'This content has no date mentions'
      const result = extractTemporalMetadata(content)

      expect(result.dates).toHaveLength(0)
    })
  })

  describe('combined extraction', () => {
    it('extracts both versions and dates', () => {
      const content = 'React 18 was released in 2022, then v18.1 came in early 2023'
      const result = extractTemporalMetadata(content)

      expect(result.versions.length).toBeGreaterThan(0)
      expect(result.dates.length).toBeGreaterThan(0)
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it('returns high confidence for multiple temporal signals', () => {
      const content = 'version 3.0 released January 2024, v3.1 in 2024, v3.2 coming soon'
      const result = extractTemporalMetadata(content)

      expect(result.versions.length).toBeGreaterThanOrEqual(2)
      expect(result.dates.length).toBeGreaterThanOrEqual(1)
      expect(result.confidence).toBeCloseTo(1.0, 1)
    })

    it('returns medium confidence for single version mention', () => {
      const content = 'We are using v2.0 for this project'
      const result = extractTemporalMetadata(content)

      expect(result.versions).toContain('2.0')
      expect(result.dates).toHaveLength(0)
      expect(result.confidence).toBeCloseTo(0.7, 1)
    })

    it('returns low confidence for ambiguous mentions', () => {
      const content = 'Updated to version 2'
      const result = extractTemporalMetadata(content)

      expect(result.confidence).toBeCloseTo(0.4, 1)
    })

    it('returns zero confidence for no temporal signals', () => {
      const content = 'This is just regular content with no temporal information'
      const result = extractTemporalMetadata(content)

      expect(result.versions).toHaveLength(0)
      expect(result.dates).toHaveLength(0)
      expect(result.confidence).toBe(0.0)
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = extractTemporalMetadata('')

      expect(result.versions).toHaveLength(0)
      expect(result.dates).toHaveLength(0)
      expect(result.confidence).toBe(0.0)
    })

    it('handles case-insensitive patterns', () => {
      const content = 'VERSION 3.0 RELEASED IN JANUARY 2024'
      const result = extractTemporalMetadata(content)

      expect(result.versions.length).toBeGreaterThan(0)
      expect(result.dates.length).toBeGreaterThan(0)
    })

    it('deduplicates extracted versions', () => {
      const content = 'version 2.0 and v2.0 are the same'
      const result = extractTemporalMetadata(content)

      const version20Count = result.versions.filter(v => v === '2.0').length
      expect(version20Count).toBe(1)
    })

    it('handles multiple spaces and newlines', () => {
      const content = `React 18 released

      in 2022    with version 18.0.0`
      const result = extractTemporalMetadata(content)

      expect(result.versions.length).toBeGreaterThan(0)
      expect(result.dates.length).toBeGreaterThan(0)
    })
  })
})
