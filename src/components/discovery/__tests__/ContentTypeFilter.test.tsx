import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContentTypeFilter } from '../ContentTypeFilter'

describe('ContentTypeFilter', () => {
  it('renders with "All" trigger text when selected is "all"', () => {
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="all" onChange={onChange} />)

    expect(screen.getByText('All')).toBeInTheDocument()
  })

  it('renders with "Not Saved" trigger text when selected is "not-saved"', () => {
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="not-saved" onChange={onChange} />)

    expect(screen.getByText('Not Saved')).toBeInTheDocument()
  })

  it('renders with "Saved" trigger text when selected is "saved"', () => {
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="saved" onChange={onChange} />)

    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('opens menu and displays all three options', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="all" onChange={onChange} />)

    await user.click(screen.getByText('All'))

    // Should have two "All" — one in trigger, one in menu
    const allItems = screen.getAllByText('All')
    expect(allItems.length).toBeGreaterThanOrEqual(2)

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Not Saved')).toBeInTheDocument()
  })

  it('calls onChange with "all" when "All" is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="not-saved" onChange={onChange} />)

    await user.click(screen.getByText('Not Saved'))

    // Click the "All" menu item
    const allItems = screen.getAllByText('All')
    const menuItem = allItems.find((el) => el.closest('[role="menuitem"]'))
    expect(menuItem).toBeDefined()

    await user.click(menuItem!)

    expect(onChange).toHaveBeenCalledWith('all')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange with "not-saved" when "Not Saved" is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="all" onChange={onChange} />)

    await user.click(screen.getByText('All'))
    await user.click(screen.getByText('Not Saved'))

    expect(onChange).toHaveBeenCalledWith('not-saved')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange with "saved" when "Saved" is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="all" onChange={onChange} />)

    await user.click(screen.getByText('All'))
    await user.click(screen.getByText('Saved'))

    expect(onChange).toHaveBeenCalledWith('saved')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('renders ChevronDown icon in trigger', () => {
    const onChange = vi.fn()
    const { container } = render(<ContentTypeFilter selected="all" onChange={onChange} />)

    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })
})
