import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FreshnessBadge } from '../FreshnessBadge'

describe('FreshnessBadge', () => {
  it('should render nothing when publishedAt is null', () => {
    const { container } = render(<FreshnessBadge publishedAt={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render nothing when publishedAt is undefined', () => {
    const { container } = render(<FreshnessBadge publishedAt={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render "Fresh" badge for content < 90 days old', () => {
    // 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={thirtyDaysAgo} />)

    const badge = screen.getByText('Fresh')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-emerald-500/10')
    expect(badge).toHaveClass('text-emerald-600')
  })

  it('should render "Fresh" badge for content exactly at 89 days', () => {
    const eightyNineDaysAgo = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={eightyNineDaysAgo} />)

    expect(screen.getByText('Fresh')).toBeInTheDocument()
  })

  it('should render month badge for content 90-364 days old', () => {
    // 120 days ago (4 months)
    const fourMonthsAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={fourMonthsAgo} />)

    const badge = screen.getByText('4mo')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-amber-500/10')
    expect(badge).toHaveClass('text-amber-600')
  })

  it('should render month badge for content at 364 days', () => {
    const almostOneYear = new Date(Date.now() - 364 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={almostOneYear} />)

    // 364 days = 12 months
    expect(screen.getByText('12mo')).toBeInTheDocument()
  })

  it('should render year badge for content >= 365 days old', () => {
    // 400 days ago (1+ year)
    const oneYearAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={oneYearAgo} />)

    const badge = screen.getByText('1y old')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('text-muted-foreground')
  })

  it('should render correct year count for content 2+ years old', () => {
    // 800 days ago (2+ years)
    const twoYearsAgo = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={twoYearsAgo} />)

    expect(screen.getByText('2y old')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={thirtyDaysAgo} className="custom-class" />)

    const badge = screen.getByText('Fresh')
    expect(badge).toHaveClass('custom-class')
  })

  it('should handle Date object input', () => {
    const date = new Date('2024-01-01')
    const { container } = render(<FreshnessBadge publishedAt={date} />)

    expect(container.firstChild).toBeInTheDocument()
  })

  it('should render correct badge at boundary: 90 days', () => {
    // Exactly 90 days ago
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={ninetyDaysAgo} />)

    // At 90 days, should show months (3mo)
    expect(screen.getByText('3mo')).toBeInTheDocument()
  })

  it('should render correct badge at boundary: 365 days', () => {
    // Exactly 365 days ago
    const oneYearExact = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    render(<FreshnessBadge publishedAt={oneYearExact} />)

    // At 365 days, should show "1y old"
    expect(screen.getByText('1y old')).toBeInTheDocument()
  })
})
