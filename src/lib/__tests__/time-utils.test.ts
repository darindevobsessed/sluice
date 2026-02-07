import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatRelativeTime } from '../time-utils'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should format seconds ago', () => {
    const date = new Date('2024-01-15T11:59:30Z')
    expect(formatRelativeTime(date)).toBe('30s ago')
  })

  it('should format minutes ago', () => {
    const date = new Date('2024-01-15T11:55:00Z')
    expect(formatRelativeTime(date)).toBe('5m ago')
  })

  it('should format hours ago', () => {
    const date = new Date('2024-01-15T10:00:00Z')
    expect(formatRelativeTime(date)).toBe('2h ago')
  })

  it('should format days ago', () => {
    const date = new Date('2024-01-13T12:00:00Z')
    expect(formatRelativeTime(date)).toBe('2d ago')
  })

  it('should format weeks ago', () => {
    const date = new Date('2024-01-01T12:00:00Z')
    expect(formatRelativeTime(date)).toBe('2w ago')
  })

  it('should format months ago', () => {
    const date = new Date('2023-11-15T12:00:00Z')
    expect(formatRelativeTime(date)).toBe('2mo ago')
  })

  it('should format years ago', () => {
    const date = new Date('2022-01-15T12:00:00Z')
    expect(formatRelativeTime(date)).toBe('2y ago')
  })

  it('should handle just now for very recent dates', () => {
    const date = new Date('2024-01-15T11:59:55Z')
    expect(formatRelativeTime(date)).toBe('5s ago')
  })

  it('should handle edge case of 1 unit', () => {
    const date = new Date('2024-01-15T11:00:00Z')
    expect(formatRelativeTime(date)).toBe('1h ago')
  })

  it('should handle future dates as 0s ago', () => {
    const date = new Date('2024-01-15T13:00:00Z')
    expect(formatRelativeTime(date)).toBe('0s ago')
  })
})
