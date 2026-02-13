import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TranscriptSection } from '../TranscriptSection';

describe('TranscriptSection', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  it('renders textarea with value and change handler', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TranscriptSection {...defaultProps} value="test transcript" onChange={onChange} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('test transcript');

    await user.type(textarea, ' more text');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows loading spinner when isFetching is true', () => {
    render(<TranscriptSection {...defaultProps} isFetching={true} />);

    // Should show a loading indicator with first rotating message
    expect(screen.getByText(/fetching transcript from youtube/i)).toBeInTheDocument();
  });

  it('shows auto-fetched badge when source is auto', () => {
    render(<TranscriptSection {...defaultProps} source="auto" />);

    // Should show success indicator with new celebratory copy
    expect(screen.getByText(/transcript ready/i)).toBeInTheDocument();
  });

  it('shows error alert with retry button when fetchError exists', () => {
    const onRetryFetch = vi.fn();
    render(
      <TranscriptSection
        {...defaultProps}
        fetchError="Failed to fetch transcript"
        onRetryFetch={onRetryFetch}
      />
    );

    // Should show error message
    expect(screen.getByText(/failed to fetch transcript/i)).toBeInTheDocument();

    // Should show retry button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('calls onRetryFetch when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetryFetch = vi.fn();
    render(
      <TranscriptSection
        {...defaultProps}
        fetchError="Failed to fetch transcript"
        onRetryFetch={onRetryFetch}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(onRetryFetch).toHaveBeenCalledOnce();
  });

  it('collapses instructions when source is auto', () => {
    render(<TranscriptSection {...defaultProps} source="auto" />);

    // Instructions should be collapsed (small link visible, not full instructions)
    expect(screen.queryByText(/Open the video on YouTube/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /how to get a transcript manually/i })).toBeInTheDocument();
  });

  it('shows "Your transcript:" label when source is auto', () => {
    render(<TranscriptSection {...defaultProps} source="auto" />);

    // Should show warmer label copy
    expect(screen.getByText(/your transcript:/i)).toBeInTheDocument();
  });

  it('shows "Now paste the transcript:" label when source is not auto', () => {
    render(<TranscriptSection {...defaultProps} source="manual" />);

    // Should show instructional label copy
    expect(screen.getByText(/now paste the transcript:/i)).toBeInTheDocument();
  });

  it('applies entrance animation to success indicator', () => {
    const { container } = render(<TranscriptSection {...defaultProps} source="auto" />);

    // Find the success indicator span
    const successIndicator = container.querySelector('.animate-in');
    expect(successIndicator).toBeInTheDocument();
    expect(successIndicator).toHaveClass('fade-in', 'duration-200');
  });

  it('applies green border to textarea when source is auto', () => {
    render(<TranscriptSection {...defaultProps} source="auto" />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('border-green-300');
  });

  it('does not apply green border to textarea when source is not auto', () => {
    render(<TranscriptSection {...defaultProps} source="manual" />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).not.toHaveClass('border-green-300');
  });

  it('shows expanded instructions when source is manual or null', () => {
    render(<TranscriptSection {...defaultProps} source="manual" />);

    // Instructions should be expandable (toggle visible)
    expect(screen.getByRole('button', { name: /how do i get this/i })).toBeInTheDocument();
  });

  it('disables textarea when fetching', () => {
    render(<TranscriptSection {...defaultProps} isFetching={true} />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('shows character count', () => {
    render(<TranscriptSection {...defaultProps} value="Hello world" />);

    expect(screen.getByText(/11 characters?/i)).toBeInTheDocument();
  });

  it('applies max height and overflow classes to textarea for long content scrolling', () => {
    render(<TranscriptSection {...defaultProps} />);

    const textarea = screen.getByRole('textbox');

    // Verify existing min-height class
    expect(textarea).toHaveClass('min-h-[300px]');

    // Verify new max-height class (caps growth at 500px)
    expect(textarea).toHaveClass('max-h-[500px]');

    // Verify overflow scroll class (enables inner scrolling)
    expect(textarea).toHaveClass('overflow-y-auto');
  });
});
