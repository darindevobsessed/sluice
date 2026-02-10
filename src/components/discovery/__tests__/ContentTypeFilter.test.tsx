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

  it('renders with "Videos" trigger text when selected is "videos"', () => {
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="videos" onChange={onChange} />)

    expect(screen.getByText('Videos')).toBeInTheDocument()
  })

  it('renders with "Transcripts" trigger text when selected is "transcripts"', () => {
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="transcripts" onChange={onChange} />)

    expect(screen.getByText('Transcripts')).toBeInTheDocument()
  })

  it('opens menu and displays all three options', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="all" onChange={onChange} />)

    await user.click(screen.getByText('All'))

    // Should have two "All" — one in trigger, one in menu
    const allItems = screen.getAllByText('All')
    expect(allItems.length).toBeGreaterThanOrEqual(2)

    expect(screen.getByText('Videos')).toBeInTheDocument()
    expect(screen.getByText('Transcripts')).toBeInTheDocument()
  })

  it('calls onChange with "all" when "All" is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="videos" onChange={onChange} />)

    await user.click(screen.getByText('Videos'))

    // Click the "All" menu item
    const allItems = screen.getAllByText('All')
    const menuItem = allItems.find((el) => el.closest('[role="menuitem"]'))
    expect(menuItem).toBeDefined()

    await user.click(menuItem!)

    expect(onChange).toHaveBeenCalledWith('all')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange with "videos" when "Videos" is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="all" onChange={onChange} />)

    await user.click(screen.getByText('All'))
    await user.click(screen.getByText('Videos'))

    expect(onChange).toHaveBeenCalledWith('videos')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange with "transcripts" when "Transcripts" is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ContentTypeFilter selected="all" onChange={onChange} />)

    await user.click(screen.getByText('All'))
    await user.click(screen.getByText('Transcripts'))

    expect(onChange).toHaveBeenCalledWith('transcripts')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('renders ChevronDown icon in trigger', () => {
    const onChange = vi.fn()
    const { container } = render(<ContentTypeFilter selected="all" onChange={onChange} />)

    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })
})
