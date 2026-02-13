import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SuccessState } from '../SuccessState'

describe('SuccessState', () => {
  const mockOnReset = vi.fn()

  it('renders success heading and video title', () => {
    render(
      <SuccessState
        title="Test Video Title"
        onReset={mockOnReset}
      />
    )

    expect(screen.getByText('Added to your Knowledge Bank!')).toBeInTheDocument()
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('shows milestone for totalVideos=1 (first video)', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        milestones={{
          totalVideos: 1,
          channelVideoCount: 1,
          isNewChannel: true,
        }}
      />
    )

    expect(screen.getByText('Your first video — welcome to your knowledge bank')).toBeInTheDocument()
  })

  it('shows milestone for isNewChannel=true (not first video)', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        milestones={{
          totalVideos: 5,
          channelVideoCount: 1,
          isNewChannel: true,
        }}
      />
    )

    expect(screen.getByText('A new creator in your knowledge bank')).toBeInTheDocument()
  })

  it('shows milestone for totalVideos=5', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        milestones={{
          totalVideos: 5,
          channelVideoCount: 2,
          isNewChannel: false,
        }}
      />
    )

    expect(screen.getByText('5 videos strong — your collection is taking shape')).toBeInTheDocument()
  })

  it('shows milestone for totalVideos=10', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        milestones={{
          totalVideos: 10,
          channelVideoCount: 3,
          isNewChannel: false,
        }}
      />
    )

    expect(screen.getByText('10 videos and counting — building something valuable')).toBeInTheDocument()
  })

  it('shows milestone for totalVideos=25', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        milestones={{
          totalVideos: 25,
          channelVideoCount: 5,
          isNewChannel: false,
        }}
      />
    )

    expect(screen.getByText('25 videos — your knowledge bank is a real resource')).toBeInTheDocument()
  })

  it('shows milestone for totalVideos=50', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        milestones={{
          totalVideos: 50,
          channelVideoCount: 10,
          isNewChannel: false,
        }}
      />
    )

    expect(screen.getByText('50 videos — impressive dedication')).toBeInTheDocument()
  })

  it('shows milestone for totalVideos=100', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        milestones={{
          totalVideos: 100,
          channelVideoCount: 20,
          isNewChannel: false,
        }}
      />
    )

    expect(screen.getByText('100 videos — a serious knowledge base')).toBeInTheDocument()
  })

  it('shows no milestone for count=7 (non-milestone)', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        milestones={{
          totalVideos: 7,
          channelVideoCount: 2,
          isNewChannel: false,
        }}
      />
    )

    // Success heading should be present
    expect(screen.getByText('Added to your Knowledge Bank!')).toBeInTheDocument()

    // But no milestone text should be present
    expect(screen.queryByText(/videos strong/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/your first video/i)).not.toBeInTheDocument()
  })

  it('renders 3 "What\'s next?" action items', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        videoId={123}
      />
    )

    expect(screen.getByText('What\'s next?')).toBeInTheDocument()
    expect(screen.getByText('View video details')).toBeInTheDocument()
    expect(screen.getByText('Add another video')).toBeInTheDocument()
    expect(screen.getByText('Browse Knowledge Bank')).toBeInTheDocument()
  })

  it('"View video" links to /videos/[id]', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        videoId={456}
      />
    )

    const link = screen.getByRole('link', { name: /view video details/i })
    expect(link).toHaveAttribute('href', '/videos/456')
  })

  it('"Add another" calls onReset on click', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()

    render(
      <SuccessState
        title="Test Video"
        onReset={onReset}
        videoId={123}
      />
    )

    const button = screen.getByRole('button', { name: /add another video/i })
    await user.click(button)

    expect(onReset).toHaveBeenCalledOnce()
  })

  it('"Browse Knowledge Bank" links to /', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
        videoId={123}
      />
    )

    const link = screen.getByRole('link', { name: /browse knowledge bank/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('is backward-compatible with no milestones prop', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
      />
    )

    // Should render without error
    expect(screen.getByText('Added to your Knowledge Bank!')).toBeInTheDocument()

    // No milestone should be shown
    expect(screen.queryByText(/your first video/i)).not.toBeInTheDocument()
  })

  it('does not show "View video details" when no videoId provided', () => {
    render(
      <SuccessState
        title="Test Video"
        onReset={mockOnReset}
      />
    )

    // "View video details" should not be present
    expect(screen.queryByText('View video details')).not.toBeInTheDocument()

    // But other actions should still be there
    expect(screen.getByText('Add another video')).toBeInTheDocument()
    expect(screen.getByText('Browse Knowledge Bank')).toBeInTheDocument()
  })
})
