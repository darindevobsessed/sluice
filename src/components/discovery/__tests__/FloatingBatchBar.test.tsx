import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FloatingBatchBar } from '../FloatingBatchBar'

describe('FloatingBatchBar', () => {
  const mockOnAdd = vi.fn()
  const mockOnClear = vi.fn()

  it('should not render when selectedCount is 0', () => {
    const { container } = render(
      <FloatingBatchBar
        selectedCount={0}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render when selectedCount is greater than 0', () => {
    render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    expect(screen.getByText('3 selected')).toBeInTheDocument()
  })

  it('should display correct count text', () => {
    render(
      <FloatingBatchBar
        selectedCount={1}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('should display correct count text for multiple items', () => {
    render(
      <FloatingBatchBar
        selectedCount={42}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    expect(screen.getByText('42 selected')).toBeInTheDocument()
  })

  it('should render Clear button', () => {
    render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
  })

  it('should render Add button with count', () => {
    render(
      <FloatingBatchBar
        selectedCount={5}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    expect(screen.getByRole('button', { name: 'Add 5 to Bank' })).toBeInTheDocument()
  })

  it('should call onClear when Clear button is clicked', () => {
    render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    const clearButton = screen.getByRole('button', { name: 'Clear' })
    clearButton.click()
    expect(mockOnClear).toHaveBeenCalledTimes(1)
  })

  it('should call onAdd when Add button is clicked', () => {
    render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    const addButton = screen.getByRole('button', { name: 'Add 3 to Bank' })
    addButton.click()
    expect(mockOnAdd).toHaveBeenCalledTimes(1)
  })

  it('should disable Add button when isAdding is true', () => {
    render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
        isAdding={true}
      />
    )
    const addButton = screen.getByRole('button', { name: /Add 3 to Bank/ })
    expect(addButton).toBeDisabled()
  })

  it('should disable Clear button when isAdding is true', () => {
    render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
        isAdding={true}
      />
    )
    const clearButton = screen.getByRole('button', { name: 'Clear' })
    expect(clearButton).toBeDisabled()
  })

  it('should not disable buttons when isAdding is false', () => {
    render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
        isAdding={false}
      />
    )
    const addButton = screen.getByRole('button', { name: 'Add 3 to Bank' })
    const clearButton = screen.getByRole('button', { name: 'Clear' })
    expect(addButton).not.toBeDisabled()
    expect(clearButton).not.toBeDisabled()
  })

  it('should not disable buttons when isAdding is undefined', () => {
    render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    const addButton = screen.getByRole('button', { name: 'Add 3 to Bank' })
    const clearButton = screen.getByRole('button', { name: 'Clear' })
    expect(addButton).not.toBeDisabled()
    expect(clearButton).not.toBeDisabled()
  })

  it('should have fixed position at bottom center', () => {
    const { container } = render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    const bar = container.firstChild as HTMLElement
    expect(bar).toHaveClass('fixed')
    expect(bar).toHaveClass('bottom-6')
    expect(bar).toHaveClass('left-1/2')
    expect(bar).toHaveClass('-translate-x-1/2')
  })

  it('should have correct z-index for floating above content', () => {
    const { container } = render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    const bar = container.firstChild as HTMLElement
    expect(bar).toHaveClass('z-50')
  })

  it('should have card styling with shadow', () => {
    const { container } = render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    const bar = container.firstChild as HTMLElement
    expect(bar).toHaveClass('bg-card')
    expect(bar).toHaveClass('border')
    expect(bar).toHaveClass('rounded-xl')
    expect(bar).toHaveClass('shadow-xl')
  })

  it('should use flex layout with gap', () => {
    const { container } = render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    const bar = container.firstChild as HTMLElement
    expect(bar).toHaveClass('flex')
    expect(bar).toHaveClass('items-center')
    expect(bar).toHaveClass('gap-4')
  })

  it('should have animation classes for slide-up entrance', () => {
    const { container } = render(
      <FloatingBatchBar
        selectedCount={3}
        onAdd={mockOnAdd}
        onClear={mockOnClear}
      />
    )
    const bar = container.firstChild as HTMLElement
    expect(bar).toHaveClass('animate-in')
    expect(bar).toHaveClass('slide-in-from-bottom-4')
    expect(bar).toHaveClass('duration-200')
  })
})
