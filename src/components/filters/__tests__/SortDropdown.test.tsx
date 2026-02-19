import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortDropdown } from '../SortDropdown'

describe('SortDropdown', () => {
  it('renders trigger with current sort label', () => {
    render(<SortDropdown value="added" onChange={vi.fn()} />)
    expect(screen.getByText('Date Added')).toBeInTheDocument()
  })

  it('renders trigger with "Duration" label when value is duration', () => {
    render(<SortDropdown value="duration" onChange={vi.fn()} />)
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })

  it('opens menu and shows all four sort options', async () => {
    const user = userEvent.setup()
    render(<SortDropdown value="added" onChange={vi.fn()} />)

    await user.click(screen.getByText('Date Added'))

    // Trigger text + menu item
    expect(screen.getAllByText('Date Added').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Date Published')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Title A-Z')).toBeInTheDocument()
  })

  it('calls onChange with selected option id', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SortDropdown value="added" onChange={onChange} />)

    await user.click(screen.getByText('Date Added'))
    await user.click(screen.getByText('Title A-Z'))

    expect(onChange).toHaveBeenCalledWith('title')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('shows check icon next to the active sort option', async () => {
    const user = userEvent.setup()
    render(<SortDropdown value="duration" onChange={vi.fn()} />)

    await user.click(screen.getByText('Duration'))

    // The check icon should be rendered -- we look for the svg inside the Duration menu item
    const durationItems = screen.getAllByText('Duration')
    const menuItem = durationItems.find(el => el.closest('[role="menuitem"]'))
    expect(menuItem).toBeDefined()
    // Check icon is an SVG sibling
    const svg = menuItem!.closest('[role="menuitem"]')?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies custom className to trigger', () => {
    const { container } = render(
      <SortDropdown value="added" onChange={vi.fn()} className="ml-auto" />
    )
    // The trigger is the button element
    const trigger =
      container.querySelector('[data-slot="dropdown-menu-trigger"]') ||
      container.querySelector('button')
    expect(trigger?.className).toContain('ml-auto')
  })

  it('renders ChevronDown icon in trigger', () => {
    const { container } = render(<SortDropdown value="added" onChange={vi.fn()} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
