import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsHeader, StatsHeaderSkeleton } from '../StatsHeader';

describe('StatsHeader', () => {
  it('renders video count', () => {
    render(<StatsHeader count={12} totalHours={4.2} channels={8} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/videos/i)).toBeInTheDocument();
  });

  it('renders total hours', () => {
    render(<StatsHeader count={12} totalHours={4.2} channels={8} />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText(/hrs of content/i)).toBeInTheDocument();
  });

  it('renders channel count', () => {
    render(<StatsHeader count={12} totalHours={4.2} channels={8} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText(/channels/i)).toBeInTheDocument();
  });

  it('uses singular form for 1 video', () => {
    render(<StatsHeader count={1} totalHours={0.5} channels={1} />);
    expect(screen.getByText(/video$/i)).toBeInTheDocument();
  });

  it('uses singular form for 1 channel', () => {
    render(<StatsHeader count={1} totalHours={0.5} channels={1} />);
    expect(screen.getByText(/channel$/i)).toBeInTheDocument();
  });

  it('handles zero values', () => {
    render(<StatsHeader count={0} totalHours={0} channels={0} />);
    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});

describe('StatsHeaderSkeleton', () => {
  it('renders skeleton placeholder', () => {
    render(<StatsHeaderSkeleton />);
    expect(document.querySelector('[data-testid="stats-header-skeleton"]')).toBeInTheDocument();
  });

  it('has mb-6 bottom margin class', () => {
    render(<StatsHeaderSkeleton />);
    const skeleton = screen.getByTestId('stats-header-skeleton');
    expect(skeleton).toHaveClass('mb-6');
  });
});
