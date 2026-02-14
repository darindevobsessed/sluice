import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterPillBar } from '../FilterPillBar'
import type { FilterPill } from '../FilterPillBar'

describe('FilterPillBar', () => {
  it('renders pills with correct label: value format', () => {
    const pills: FilterPill[] = [
      {
        label: 'Creator',
        value: 'Fireship',
        onDismiss: vi.fn(),
      },
      {
        label: 'Status',
        value: 'Not Saved',
        onDismiss: vi.fn(),
      },
    ]

    render(<FilterPillBar pills={pills} />)

    expect(screen.getByText('Creator: Fireship')).toBeInTheDocument()
    expect(screen.getByText('Status: Not Saved')).toBeInTheDocument()
  })

  it('calls onDismiss for correct pill when dismiss button clicked', async () => {
    const user = userEvent.setup()
    const onDismiss1 = vi.fn()
    const onDismiss2 = vi.fn()

    const pills: FilterPill[] = [
      {
        label: 'Creator',
        value: 'Fireship',
        onDismiss: onDismiss1,
      },
      {
        label: 'Status',
        value: 'Not Saved',
        onDismiss: onDismiss2,
      },
    ]

    render(<FilterPillBar pills={pills} />)

    // Click the first dismiss button
    const dismissButtons = screen.getAllByRole('button')
    await user.click(dismissButtons[0]!)

    expect(onDismiss1).toHaveBeenCalledTimes(1)
    expect(onDismiss2).not.toHaveBeenCalled()
  })

  it('shows "Clear all" button when 2+ pills and onClearAll provided', () => {
    const pills: FilterPill[] = [
      {
        label: 'Creator',
        value: 'Fireship',
        onDismiss: vi.fn(),
      },
      {
        label: 'Status',
        value: 'Not Saved',
        onDismiss: vi.fn(),
      },
    ]

    render(<FilterPillBar pills={pills} onClearAll={vi.fn()} />)

    expect(screen.getByText('Clear all')).toBeInTheDocument()
  })

  it('hides "Clear all" button when only 1 pill', () => {
    const pills: FilterPill[] = [
      {
        label: 'Creator',
        value: 'Fireship',
        onDismiss: vi.fn(),
      },
    ]

    render(<FilterPillBar pills={pills} onClearAll={vi.fn()} />)

    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('hides "Clear all" button when no onClearAll provided', () => {
    const pills: FilterPill[] = [
      {
        label: 'Creator',
        value: 'Fireship',
        onDismiss: vi.fn(),
      },
      {
        label: 'Status',
        value: 'Not Saved',
        onDismiss: vi.fn(),
      },
    ]

    render(<FilterPillBar pills={pills} />)

    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('calls onClearAll when "Clear all" button clicked', async () => {
    const user = userEvent.setup()
    const onClearAll = vi.fn()

    const pills: FilterPill[] = [
      {
        label: 'Creator',
        value: 'Fireship',
        onDismiss: vi.fn(),
      },
      {
        label: 'Status',
        value: 'Not Saved',
        onDismiss: vi.fn(),
      },
    ]

    render(<FilterPillBar pills={pills} onClearAll={onClearAll} />)

    await user.click(screen.getByText('Clear all'))

    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('returns null when pills array is empty', () => {
    const { container } = render(<FilterPillBar pills={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('each dismiss button has correct aria-label', () => {
    const pills: FilterPill[] = [
      {
        label: 'Creator',
        value: 'Fireship',
        onDismiss: vi.fn(),
      },
      {
        label: 'Type',
        value: 'YouTube',
        onDismiss: vi.fn(),
      },
    ]

    render(<FilterPillBar pills={pills} />)

    expect(screen.getByLabelText('Remove Creator: Fireship filter')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove Type: YouTube filter')).toBeInTheDocument()
  })

  it('applies custom className when provided', () => {
    const pills: FilterPill[] = [
      {
        label: 'Creator',
        value: 'Fireship',
        onDismiss: vi.fn(),
      },
    ]

    const { container } = render(<FilterPillBar pills={pills} className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
