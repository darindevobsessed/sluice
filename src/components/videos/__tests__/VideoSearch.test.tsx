import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoSearch } from '../VideoSearch';

describe('VideoSearch', () => {
  it('renders search input with correct placeholder', () => {
    const onSearch = vi.fn();
    render(<VideoSearch onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Ask a question or search...');
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

    const input = screen.getByPlaceholderText('Ask a question or search...');

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

    const input = screen.getByPlaceholderText('Ask a question or search...');

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

    const input = screen.getByPlaceholderText('Ask a question or search...');

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

    const input = screen.getByPlaceholderText('Ask a question or search...');

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

    const input = screen.getByPlaceholderText('Ask a question or search...');

    // Type first value
    fireEvent.change(input, { target: { value: 'react' } });
    expect(input).toHaveValue('react');

    // Type second value
    fireEvent.change(input, { target: { value: 'typescript' } });
    expect(input).toHaveValue('typescript');
  });

  it('initializes with defaultValue when provided', () => {
    const onSearch = vi.fn();

    render(<VideoSearch onSearch={onSearch} defaultValue="initial query" />);

    const input = screen.getByPlaceholderText('Ask a question or search...');
    expect(input).toHaveValue('initial query');
  });

  it('syncs with external defaultValue changes (browser back/forward)', () => {
    const onSearch = vi.fn();

    const { rerender } = render(
      <VideoSearch onSearch={onSearch} defaultValue="first query" />
    );

    const input = screen.getByPlaceholderText('Ask a question or search...');
    expect(input).toHaveValue('first query');

    // Simulate browser back/forward by changing defaultValue
    rerender(<VideoSearch onSearch={onSearch} defaultValue="second query" />);

    expect(input).toHaveValue('second query');
  });

  it('does not sync when defaultValue is undefined', () => {
    const onSearch = vi.fn();

    const { rerender } = render(<VideoSearch onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Ask a question or search...');

    // User types
    fireEvent.change(input, { target: { value: 'user typed' } });
    expect(input).toHaveValue('user typed');

    // Rerender without defaultValue should not change input
    rerender(<VideoSearch onSearch={onSearch} />);
    expect(input).toHaveValue('user typed');
  });
});
