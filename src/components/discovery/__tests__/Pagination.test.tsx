import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
  it('should render page numbers correctly', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />)

    // Should show page 1, 2, 3, 4, 5
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
  })

  it('should mark current page with aria-current', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />)

    const currentPageButton = screen.getByRole('button', { name: '3' })
    expect(currentPageButton).toHaveAttribute('aria-current', 'page')
  })

  it('should call onPageChange when page number clicked', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: '3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('should not call onPageChange when current page clicked', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />)

    await user.click(screen.getByRole('button', { name: '2' }))
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('should render prev button and navigate to previous page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />)

    const prevButton = screen.getByRole('button', { name: /previous/i })
    expect(prevButton).toBeInTheDocument()
    expect(prevButton).not.toBeDisabled()

    await user.click(prevButton)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('should render next button and navigate to next page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />)

    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toBeInTheDocument()
    expect(nextButton).not.toBeDisabled()

    await user.click(nextButton)
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('should disable prev button on first page', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />)

    const prevButton = screen.getByRole('button', { name: /previous/i })
    expect(prevButton).toBeDisabled()
  })

  it('should disable next button on last page', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={5} totalPages={5} onPageChange={onPageChange} />)

    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toBeDisabled()
  })

  it('should show ellipsis for large page counts', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={5} totalPages={15} onPageChange={onPageChange} />)

    // Should show: 1 ... 4 5 6 ... 15 (7 buttons + ellipsis)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()

    // Should have ellipsis (text content, not button)
    expect(screen.getAllByText('...')).toHaveLength(2)
  })

  it('should show all pages when totalPages <= 7', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={7} onPageChange={onPageChange} />)

    // Should show all 7 pages
    for (let i = 1; i <= 7; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument()
    }

    // Should have no ellipsis
    expect(screen.queryByText('...')).not.toBeInTheDocument()
  })

  it('should show correct pages when current page is near start', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={2} totalPages={15} onPageChange={onPageChange} />)

    // Should show: 1 2 3 4 5 ... 15
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument()

    // Only one ellipsis at the end
    expect(screen.getAllByText('...')).toHaveLength(1)
  })

  it('should show correct pages when current page is near end', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={14} totalPages={15} onPageChange={onPageChange} />)

    // Should show: 1 ... 11 12 13 14 15
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '11' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '13' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '14' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument()

    // Only one ellipsis at the start
    expect(screen.getAllByText('...')).toHaveLength(1)
  })

  it('should be keyboard navigable', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />)

    // Focus first button (prev)
    const prevButton = screen.getByRole('button', { name: /previous/i })
    prevButton.focus()
    expect(prevButton).toHaveFocus()

    // Tab to page 1 button
    await user.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus()

    // Press Enter to activate
    await user.keyboard('{Enter}')
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('should not render when totalPages is 1', () => {
    const onPageChange = vi.fn()
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={onPageChange} />
    )

    // Should render nothing
    expect(container.firstChild).toBeNull()
  })

  it('should not render when totalPages is 0', () => {
    const onPageChange = vi.fn()
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={onPageChange} />
    )

    // Should render nothing
    expect(container.firstChild).toBeNull()
  })
})
