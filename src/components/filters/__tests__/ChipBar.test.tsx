import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChipBar } from '../ChipBar'
import type { Chip } from '../ChipBar'

const mockChips: Chip[] = [
  { id: 'all', label: 'All', group: 'static' },
  { id: 'recent', label: 'Recently Added', group: 'static' },
  { id: 'duration-short', label: 'Short', group: 'duration' },
  { id: 'focus:1', label: 'AI/ML', group: 'focus' },
]

describe('ChipBar', () => {
  it('renders all chips as buttons', () => {
    render(<ChipBar chips={mockChips} activeIds={new Set()} onToggle={vi.fn()} />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Recently Added')).toBeInTheDocument()
    expect(screen.getByText('Short')).toBeInTheDocument()
    expect(screen.getByText('AI/ML')).toBeInTheDocument()
  })

  it('marks active chips with aria-pressed=true', () => {
    render(
      <ChipBar chips={mockChips} activeIds={new Set(['duration-short'])} onToggle={vi.fn()} />
    )
    expect(screen.getByText('Short')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('All')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggle with chip id when clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<ChipBar chips={mockChips} activeIds={new Set()} onToggle={onToggle} />)
    await user.click(screen.getByText('Short'))
    expect(onToggle).toHaveBeenCalledWith('duration-short')
  })

  it('applies active styling class to active chips', () => {
    render(<ChipBar chips={mockChips} activeIds={new Set(['all'])} onToggle={vi.fn()} />)
    const allChip = screen.getByText('All')
    expect(allChip.className).toContain('bg-primary')
  })

  it('applies inactive styling class to inactive chips', () => {
    render(<ChipBar chips={mockChips} activeIds={new Set(['all'])} onToggle={vi.fn()} />)
    const shortChip = screen.getByText('Short')
    expect(shortChip.className).toContain('bg-secondary')
  })

  it('renders nothing when chips array is empty', () => {
    const { container } = render(
      <ChipBar chips={[]} activeIds={new Set()} onToggle={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('applies custom className to wrapper', () => {
    const { container } = render(
      <ChipBar chips={mockChips} activeIds={new Set()} onToggle={vi.fn()} className="mb-4" />
    )
    expect(container.firstChild).toHaveClass('mb-4')
  })
})
