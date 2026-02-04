import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptView } from '../TranscriptView';

describe('TranscriptView', () => {
  it('renders transcript segments', () => {
    const transcript = `0:00
Introduction to the topic
1:30
Main content begins
3:45
Conclusion`;

    const onSeek = vi.fn();

    render(<TranscriptView transcript={transcript} onSeek={onSeek} />);

    // Check that all timestamps are rendered
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('1:30')).toBeInTheDocument();
    expect(screen.getByText('3:45')).toBeInTheDocument();

    // Check that all text segments are rendered
    expect(screen.getByText('Introduction to the topic')).toBeInTheDocument();
    expect(screen.getByText('Main content begins')).toBeInTheDocument();
    expect(screen.getByText('Conclusion')).toBeInTheDocument();
  });

  it('calls onSeek when timestamp is clicked', () => {
    const transcript = `0:00
Start
1:30
Middle
3:45
End`;

    const onSeek = vi.fn();

    render(<TranscriptView transcript={transcript} onSeek={onSeek} />);

    // Click the first timestamp (0:00 = 0 seconds)
    const firstTimestamp = screen.getByText('0:00');
    fireEvent.click(firstTimestamp);
    expect(onSeek).toHaveBeenCalledWith(0);

    // Click the second timestamp (1:30 = 90 seconds)
    const secondTimestamp = screen.getByText('1:30');
    fireEvent.click(secondTimestamp);
    expect(onSeek).toHaveBeenCalledWith(90);

    // Click the third timestamp (3:45 = 225 seconds)
    const thirdTimestamp = screen.getByText('3:45');
    fireEvent.click(thirdTimestamp);
    expect(onSeek).toHaveBeenCalledWith(225);

    expect(onSeek).toHaveBeenCalledTimes(3);
  });

  it('handles empty transcript', () => {
    const onSeek = vi.fn();

    render(<TranscriptView transcript="" onSeek={onSeek} />);

    // Should show empty state message
    expect(screen.getByText('No transcript available')).toBeInTheDocument();

    // Should not call onSeek
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('handles transcript with no timestamps', () => {
    const transcript = 'Just some plain text without any timestamps';
    const onSeek = vi.fn();

    render(<TranscriptView transcript={transcript} onSeek={onSeek} />);

    // Should render the text as a single segment with default 0:00 timestamp
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText(transcript)).toBeInTheDocument();
  });

  it('handles multi-line segments', () => {
    const transcript = `0:00
Line one
Line two
Line three
1:30
Next segment`;

    const onSeek = vi.fn();

    render(<TranscriptView transcript={transcript} onSeek={onSeek} />);

    // Should combine multi-line text into one segment
    expect(screen.getByText(/Line one/)).toBeInTheDocument();
    expect(screen.getByText(/Line two/)).toBeInTheDocument();
    expect(screen.getByText(/Line three/)).toBeInTheDocument();
  });

  it('handles hour-format timestamps', () => {
    const transcript = `1:00:00
One hour in
1:30:45
One hour thirty minutes in`;

    const onSeek = vi.fn();

    render(<TranscriptView transcript={transcript} onSeek={onSeek} />);

    // Check timestamps are rendered
    expect(screen.getByText('1:00:00')).toBeInTheDocument();
    expect(screen.getByText('1:30:45')).toBeInTheDocument();

    // Click the first timestamp (1:00:00 = 3600 seconds)
    const firstTimestamp = screen.getByText('1:00:00');
    fireEvent.click(firstTimestamp);
    expect(onSeek).toHaveBeenCalledWith(3600);

    // Click the second timestamp (1:30:45 = 5445 seconds)
    const secondTimestamp = screen.getByText('1:30:45');
    fireEvent.click(secondTimestamp);
    expect(onSeek).toHaveBeenCalledWith(5445);
  });
});
