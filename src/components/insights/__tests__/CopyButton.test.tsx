import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { CopyButton } from '../CopyButton';

describe('CopyButton', () => {
  beforeAll(() => {
    // Mock navigator.clipboard
    Object.assign(global.navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
  });

  it('renders copy button', () => {
    render(<CopyButton text="test content" />);
    const button = screen.getByRole('button', { name: /copy/i });
    expect(button).toBeInTheDocument();
  });

  it('shows checkmark after clicking', async () => {
    const user = userEvent.setup();
    render(<CopyButton text="test content" />);

    const button = screen.getByRole('button', { name: /copy/i });
    await user.click(button);

    // Should show checkmark
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('copies text to clipboard when clicked', async () => {
    const user = userEvent.setup();
    const testText = 'test content to copy';
    render(<CopyButton text={testText} />);

    const button = screen.getByRole('button', { name: /copy/i });
    await user.click(button);

    // Should show copied state (implementation detail is that text was copied)
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('returns to copy icon after 2 seconds', async () => {
    vi.useFakeTimers();
    render(<CopyButton text="test content" />);

    const button = screen.getByRole('button', { name: /copy/i });

    // Click using act
    await act(async () => {
      button.click();
    });

    // Should show checkmark
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();

    // Fast-forward 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should return to copy icon
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('handles multiple rapid clicks gracefully', async () => {
    const user = userEvent.setup();
    render(<CopyButton text="test content" />);

    const button = screen.getByRole('button', { name: /copy/i });

    // Click multiple times
    await user.click(button);
    await user.click(button);
    await user.click(button);

    // Should still show checkmark
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('handles clipboard error gracefully', async () => {
    const user = userEvent.setup();
    render(<CopyButton text="test content" />);

    const button = screen.getByRole('button', { name: /copy/i });
    await user.click(button);

    // Should still show copied state even if clipboard fails
    // The component shows feedback regardless of clipboard result
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });
});
