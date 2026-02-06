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

    // Should show a loading indicator
    expect(screen.getByText(/fetching transcript/i)).toBeInTheDocument();
  });

  it('shows auto-fetched badge when source is auto', () => {
    render(<TranscriptSection {...defaultProps} source="auto" />);

    // Should show success indicator
    expect(screen.getByText(/auto-fetched from youtube/i)).toBeInTheDocument();
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
});
