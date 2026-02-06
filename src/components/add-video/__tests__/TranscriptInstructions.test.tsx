import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { TranscriptInstructions } from '../TranscriptInstructions';

describe('TranscriptInstructions', () => {
  it('renders expanded state when collapsed prop is false', () => {
    render(<TranscriptInstructions collapsed={false} />);

    // Should show toggle button
    const button = screen.getByRole('button', { name: /how do i get this/i });
    expect(button).toBeInTheDocument();

    // Should show instructions list
    expect(screen.getByText(/Open the video on YouTube/i)).toBeInTheDocument();
    expect(screen.getByText(/Show transcript/i)).toBeInTheDocument();
  });

  it('renders collapsed state when collapsed prop is true', () => {
    render(<TranscriptInstructions collapsed={true} />);

    // Should show small link
    const link = screen.getByRole('button', { name: /how to get a transcript manually/i });
    expect(link).toBeInTheDocument();

    // Should NOT show instructions list
    expect(screen.queryByText(/Open the video on YouTube/i)).not.toBeInTheDocument();
  });

  it('toggles between collapsed and expanded states on click when collapsed=false', async () => {
    const user = userEvent.setup();
    render(<TranscriptInstructions collapsed={false} />);

    // Initially open (expanded)
    expect(screen.getByText(/Open the video on YouTube/i)).toBeInTheDocument();

    // Click to close
    const button = screen.getByRole('button', { name: /how do i get this/i });
    await user.click(button);

    // Should now be hidden
    expect(screen.queryByText(/Open the video on YouTube/i)).not.toBeInTheDocument();
  });

  it('toggles between collapsed and expanded states on click when collapsed=true', async () => {
    const user = userEvent.setup();
    render(<TranscriptInstructions collapsed={true} />);

    // Initially collapsed (small link)
    expect(screen.queryByText(/Open the video on YouTube/i)).not.toBeInTheDocument();

    // Click to expand
    const link = screen.getByRole('button', { name: /how to get a transcript manually/i });
    await user.click(link);

    // Should now show full instructions
    expect(screen.getByText(/Open the video on YouTube/i)).toBeInTheDocument();
  });
});
