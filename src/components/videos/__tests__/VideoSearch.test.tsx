import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoSearch } from '../VideoSearch';

describe('VideoSearch', () => {
  it('renders search input with correct placeholder', () => {
    const onSearch = vi.fn();
    render(<VideoSearch onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search videos and transcripts...');
    expect(input).toBeInTheDocument();
  });

  it('renders search input with custom placeholder', () => {
    const onSearch = vi.fn();
    render(<VideoSearch onSearch={onSearch} placeholder="Custom search..." />);

    const input = screen.getByPlaceholderText('Custom search...');
    expect(input).toBeInTheDocument();
  });

  it('displays search icon', () => {
    const onSearch = vi.fn();
    const { container } = render(<VideoSearch onSearch={onSearch} />);

    const searchIcon = container.querySelector('svg');
    expect(searchIcon).toBeInTheDocument();
  });

  it('calls onSearch with debounced value after typing', async () => {
    const onSearch = vi.fn();

    render(<VideoSearch onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search videos and transcripts...');

    // Type into input
    fireEvent.change(input, { target: { value: 'react' } });

    // Should not call immediately
    expect(onSearch).not.toHaveBeenCalled();

    // Wait for debounce (300ms + a bit extra)
    await waitFor(
      () => {
        expect(onSearch).toHaveBeenCalledWith('react');
      },
      { timeout: 500 }
    );
  });

  it('shows clear button when input has value', () => {
    const onSearch = vi.fn();

    render(<VideoSearch onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search videos and transcripts...');

    // Initially no clear button
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

    // Type something
    fireEvent.change(input, { target: { value: 'react' } });

    // Clear button should appear
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears input when clear button clicked', async () => {
    const onSearch = vi.fn();

    render(<VideoSearch onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search videos and transcripts...');

    // Type something
    fireEvent.change(input, { target: { value: 'react' } });

    // Find and click clear button
    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    // Input should be cleared
    expect(input).toHaveValue('');

    // Wait for debounce and check it called with empty string
    await waitFor(
      () => {
        expect(onSearch).toHaveBeenCalledWith('');
      },
      { timeout: 500 }
    );
  });

  it('debounces multiple rapid changes', async () => {
    const onSearch = vi.fn();

    render(<VideoSearch onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search videos and transcripts...');

    // Type rapidly with multiple changes
    fireEvent.change(input, { target: { value: 'r' } });
    fireEvent.change(input, { target: { value: 're' } });
    fireEvent.change(input, { target: { value: 'rea' } });
    fireEvent.change(input, { target: { value: 'reac' } });
    fireEvent.change(input, { target: { value: 'react' } });

    // Should not have called yet
    expect(onSearch).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(
      () => {
        expect(onSearch).toHaveBeenCalledTimes(1);
        expect(onSearch).toHaveBeenCalledWith('react');
      },
      { timeout: 500 }
    );
  });

  it('updates search when value changes', () => {
    const onSearch = vi.fn();

    render(<VideoSearch onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search videos and transcripts...');

    // Type first value
    fireEvent.change(input, { target: { value: 'react' } });
    expect(input).toHaveValue('react');

    // Type second value
    fireEvent.change(input, { target: { value: 'typescript' } });
    expect(input).toHaveValue('typescript');
  });
});
