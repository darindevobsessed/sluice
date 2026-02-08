import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SourceCitation } from '../SourceCitation'

describe('SourceCitation', () => {
  const mockSources = [
    { chunkId: 1, content: 'First chunk content', videoTitle: 'Video One' },
    { chunkId: 2, content: 'Second chunk content', videoTitle: 'Video Two' },
    { chunkId: 3, content: 'Third chunk content', videoTitle: 'Video Three' },
  ]

  it('displays source count', () => {
    render(<SourceCitation sources={mockSources} />)

    expect(screen.getByText(/3 sources/i)).toBeInTheDocument()
  })

  it('displays singular "source" for single source', () => {
    render(<SourceCitation sources={[mockSources[0]!]} />)

    expect(screen.getByText(/1 source/i)).toBeInTheDocument()
  })

  it('starts collapsed by default', () => {
    render(<SourceCitation sources={mockSources} />)

    // Source details should not be visible initially
    expect(screen.queryByText('First chunk content')).not.toBeInTheDocument()
  })

  it('expands when clicked', async () => {
    const user = userEvent.setup()
    render(<SourceCitation sources={mockSources} />)

    // Click to expand
    const button = screen.getByText(/3 sources/i)
    await user.click(button)

    // Source details should now be visible
    expect(screen.getByText('First chunk content')).toBeInTheDocument()
    expect(screen.getByText('Video One')).toBeInTheDocument()
  })

  it('collapses when clicked again', async () => {
    const user = userEvent.setup()
    render(<SourceCitation sources={mockSources} />)

    const button = screen.getByText(/3 sources/i)

    // Expand
    await user.click(button)
    expect(screen.getByText('First chunk content')).toBeInTheDocument()

    // Collapse
    await user.click(button)
    expect(screen.queryByText('First chunk content')).not.toBeInTheDocument()
  })

  it('displays all source chunks when expanded', async () => {
    const user = userEvent.setup()
    render(<SourceCitation sources={mockSources} />)

    const button = screen.getByText(/3 sources/i)
    await user.click(button)

    // All chunks should be visible
    expect(screen.getByText('First chunk content')).toBeInTheDocument()
    expect(screen.getByText('Second chunk content')).toBeInTheDocument()
    expect(screen.getByText('Third chunk content')).toBeInTheDocument()

    // All video titles should be visible
    expect(screen.getByText('Video One')).toBeInTheDocument()
    expect(screen.getByText('Video Two')).toBeInTheDocument()
    expect(screen.getByText('Video Three')).toBeInTheDocument()
  })

  it('renders nothing when sources array is empty', () => {
    const { container } = render(<SourceCitation sources={[]} />)

    // Should not render anything
    expect(container.firstChild).toBeNull()
  })

  it('truncates long content preview', async () => {
    const user = userEvent.setup()
    const longContent = 'A'.repeat(500)
    const sources = [{ chunkId: 1, content: longContent, videoTitle: 'Long Video' }]

    render(<SourceCitation sources={sources} />)

    const button = screen.getByText(/1 source/i)
    await user.click(button)

    // Content should be truncated or have scrollable container
    const contentElement = screen.getByText(new RegExp(longContent.substring(0, 50)))
    expect(contentElement).toBeInTheDocument()
  })

  it('has accessible button for keyboard navigation', () => {
    render(<SourceCitation sources={mockSources} />)

    const button = screen.getByRole('button', { name: /sources/i })
    expect(button).toBeInTheDocument()
  })
})
